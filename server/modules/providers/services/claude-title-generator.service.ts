import { readFile } from 'node:fs/promises';
import { query, type Options as SdkOptions } from '@anthropic-ai/claude-agent-sdk';
import { resolveClaudeCodeExecutablePath } from '@/shared/claude-cli-path.js';

const TITLE_GENERATION_TIMEOUT_MS = 60_000;
const UNTITLED_SENTINEL = 'Untitled Claude Session';

type ConversationEntry = {
  role: 'user' | 'assistant';
  text: string;
};

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((block: unknown) => {
        if (typeof block === 'object' && block !== null) {
          const b = block as Record<string, unknown>;
          if (b.type === 'text' && typeof b.text === 'string') {
            return b.text;
          }
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }

  return '';
}

async function parseConversationEntries(jsonlPath: string): Promise<ConversationEntry[]> {
  const content = await readFile(jsonlPath, 'utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const entries: ConversationEntry[] = [];

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const data = parsed as Record<string, unknown>;
    const msgType = typeof data.type === 'string' ? data.type : '';

    if (msgType !== 'user' && msgType !== 'assistant') {
      continue;
    }

    const messageObj = data.message as Record<string, unknown> | undefined;
    const rawContent = messageObj?.content ?? data.content;
    const text = extractTextFromContent(rawContent).trim();

    if (!text) {
      continue;
    }

    entries.push({ role: msgType as 'user' | 'assistant', text });
  }

  return entries;
}

type SelectedMessages = { head: ConversationEntry[]; tail: ConversationEntry[] };

function selectMessages(entries: ConversationEntry[]): SelectedMessages {
  if (entries.length <= 6) {
    return { head: entries, tail: [] };
  }
  return { head: entries.slice(0, 3), tail: entries.slice(-3) };
}

function formatEntry(entry: ConversationEntry): string {
  const role = entry.role === 'user' ? 'User' : 'Assistant';
  return `${role}: ${entry.text.slice(0, 300)}`;
}

function buildPrompt({ head, tail }: SelectedMessages): string {
  if (tail.length === 0) {
    return (
      'Conversation:\n\n' +
      head.map(formatEntry).join('\n\n') +
      '\n\nGenerate a short title.'
    );
  }
  return (
    'Initial messages (the original goal):\n\n' +
    head.map(formatEntry).join('\n\n') +
    '\n\nLatest messages (current progress):\n\n' +
    tail.map(formatEntry).join('\n\n') +
    '\n\nGenerate a short title reflecting both the goal and latest progress.'
  );
}

function normalizeTitle(raw: string): string {
  // Strip surrounding quotes/backticks, collapse whitespace to single line
  return raw
    .replace(/^[\s`"']+|[\s`"']+$/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 60)
    .trim();
}

/**
 * Generates a short AI title for a Claude session by reading its JSONL file
 * and invoking the Claude Agent SDK with the Haiku model.
 *
 * Returns null on any failure or when the title cannot be determined.
 */
export async function generateSessionTitle(
  _sessionId: string,
  jsonlPath: string,
): Promise<string | null> {
  try {
    const entries = await parseConversationEntries(jsonlPath);
    if (entries.length === 0) {
      return null;
    }

    const selected = selectMessages(entries);
    const userPrompt = buildPrompt(selected);

    const sdkOptions: SdkOptions = {
      env: { ...process.env } as Record<string, string>,
      pathToClaudeCodeExecutable: resolveClaudeCodeExecutablePath(process.env.CLAUDE_CLI_PATH),
      model: 'claude-haiku-4-5',
      systemPrompt:
        'You generate concise session titles for a chat history sidebar. Rules: ' +
        '(1) Respond with ONLY the title — no quotes, no explanation, no markdown, no trailing punctuation. ' +
        '(2) 4–8 words in English, or 6–14 characters in Chinese. Single line. ' +
        '(3) Match the language used by the user in the conversation. ' +
        '(4) Describe what the conversation is about — should reflect both the initial goal and the latest progress when both are provided. ' +
        '(5) No newlines.',
      allowedTools: [],
      disallowedTools: ['*'],
      permissionMode: 'bypassPermissions',
      settingSources: [],
    };

    let titleText = '';

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Title generation timed out')), TITLE_GENERATION_TIMEOUT_MS),
    );

    const generatePromise = (async () => {
      const stream = query({ prompt: userPrompt, options: sdkOptions });
      for await (const event of stream) {
        const e = event as Record<string, unknown>;
        if (e.type === 'assistant') {
          const msg = e.message as Record<string, unknown> | undefined;
          const content = msg?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              const b = block as Record<string, unknown>;
              if (b.type === 'text' && typeof b.text === 'string') {
                titleText += b.text;
              }
            }
          }
        }
      }
    })();

    await Promise.race([generatePromise, timeoutPromise]);

    const normalized = normalizeTitle(titleText);

    if (!normalized || normalized === UNTITLED_SENTINEL) {
      return null;
    }

    return normalized;
  } catch (error) {
    console.error('[TitleGenerator] Failed to generate session title:', error);
    return null;
  }
}
