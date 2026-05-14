import os from 'node:os';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

import { projectsDb, sessionsDb } from '@/modules/database/index.js';
import {
  buildLookupMap,
  extractFirstValidJsonlData,
  findFilesRecursivelyCreatedAfter,
  normalizeSessionName,
  readFileTimestamps,
} from '@/shared/utils.js';
import type { IProviderSessionSynchronizer } from '@/shared/interfaces.js';
import { titleGenerationQueue } from '@/modules/providers/services/title-generation-queue.service.js';

type ParsedSession = {
  sessionId: string;
  projectPath: string;
  sessionName?: string;
};

/**
 * Returns true when a project cwd is an ephemeral agent-spawned workspace
 * that should never appear in the sidebar.
 *
 * Patterns:
 *   - Claude Code agent worktrees: …/.claude/worktrees/agent-…
 *   - Claude Code agents dir:      …/.claude/agents  (with or without trailing slash)
 *   - claude-mem plugin storage:   …/.claude-mem/…
 *   - slock agent workspaces:      …/.slock/agents   (with or without trailing slash)
 *
 * We append '/' to cwd before testing so that a path ending exactly in the
 * segment (no trailing slash) is still matched — e.g. "/foo/.claude/agents"
 * becomes "/foo/.claude/agents/" which contains "/.claude/agents/".
 */
function isEphemeralProjectPath(cwd: string): boolean {
  const normalized = cwd + '/';
  return (
    normalized.includes('/.claude/worktrees/agent-') ||
    normalized.includes('/.claude/agents/') ||
    normalized.includes('/.claude-mem/') ||
    normalized.includes('/.slock/agents/')
  );
}

/**
 * Returns true when filePath belongs to a Claude sub-agent transcript.
 * Sub-agent files live under a `subagents` directory segment or have
 * basenames starting with `agent-`.
 */
function isSubAgentFile(filePath: string): boolean {
  const segments = filePath.split(path.sep);
  if (segments.includes('subagents')) {
    return true;
  }
  return path.basename(filePath).startsWith('agent-');
}

/**
 * Returns true when a JSONL file is a claude-mem "observer session".
 * These files are created by the claude-mem plugin inside regular project
 * directories and are indistinguishable by path alone.  The tell-tale sign
 * is that their FIRST non-empty line has `"type":"queue-operation"`.
 *
 * Real Claude sessions always start with "last-prompt", "user", "system", etc.
 * On any read/parse error the function returns false so legit sessions are
 * never blocked.
 */
async function isClaudeMemSession(filePath: string): Promise<boolean> {
  try {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      rl.close();
      try {
        const data = JSON.parse(trimmed) as Record<string, unknown>;
        return data.type === 'queue-operation';
      } catch {
        return false;
      }
    }
  } catch {
    // Unreadable file — treat as non-queue-operation (don't block)
  }
  return false;
}

/**
 * Session indexer for Claude transcript artifacts.
 */
export class ClaudeSessionSynchronizer implements IProviderSessionSynchronizer {
  private readonly provider = 'claude' as const;
  private readonly claudeHome = path.join(os.homedir(), '.claude');

  /**
   * Removes any previously-indexed ephemeral project rows (and all their
   * sessions) from the DB.  Returns counts of deleted projects and sessions.
   */
  private cleanupEphemeralProjectRows(): { projects: number; sessions: number } {
    const allProjects = [
      ...projectsDb.getProjectPaths(),
      ...projectsDb.getArchivedProjectPaths(),
    ];
    let deletedProjects = 0;
    let deletedSessions = 0;
    for (const project of allProjects) {
      if (!isEphemeralProjectPath(project.project_path)) {
        continue;
      }
      const sessions = sessionsDb.getSessionsByProjectPathIncludingArchived(project.project_path);
      for (const session of sessions) {
        sessionsDb.deleteSessionById(session.session_id);
        deletedSessions += 1;
      }
      projectsDb.deleteProjectById(project.project_id);
      deletedProjects += 1;
    }
    return { projects: deletedProjects, sessions: deletedSessions };
  }

  /**
   * Removes any previously-indexed sub-agent session rows from the DB.
   * Returns the number of rows deleted.
   */
  private cleanupSubAgentRows(): number {
    const allSessions = [
      ...sessionsDb.getAllSessions(),
      ...sessionsDb.getArchivedSessions(),
    ];
    let deleted = 0;
    for (const session of allSessions) {
      if (session.provider !== 'claude') continue;
      if (!session.jsonl_path) continue;
      if (isSubAgentFile(session.jsonl_path)) {
        sessionsDb.deleteSessionById(session.session_id);
        deleted += 1;
      }
    }
    return deleted;
  }

  /**
   * Scans all stored claude session rows, reads the first JSONL line of each,
   * and deletes rows whose file is a claude-mem observer session.
   * Processes in batches of 20 to bound concurrency.
   */
  private async cleanupClaudeMemRows(): Promise<number> {
    const allSessions = [
      ...sessionsDb.getAllSessions(),
      ...sessionsDb.getArchivedSessions(),
    ];
    const claudeSessions = allSessions.filter(
      (s) => s.provider === 'claude' && !!s.jsonl_path
    );

    let deleted = 0;
    const batchSize = 20;
    for (let i = 0; i < claudeSessions.length; i += batchSize) {
      const batch = claudeSessions.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((s) => isClaudeMemSession(s.jsonl_path!))
      );
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result && result.status === 'fulfilled' && result.value) {
          sessionsDb.deleteSessionById(batch[j]!.session_id);
          deleted += 1;
        }
      }
    }
    return deleted;
  }

  /**
   * Scans ~/.claude/projects and upserts discovered sessions into DB.
   */
  async synchronize(since?: Date): Promise<number> {
    const ephemeral = this.cleanupEphemeralProjectRows();
    if (ephemeral.projects > 0 || ephemeral.sessions > 0) {
      console.log(`[ClaudeSync] Removed ${ephemeral.projects} ephemeral projects (${ephemeral.sessions} sessions)`);
    }

    const removed = this.cleanupSubAgentRows();
    if (removed > 0) {
      console.log(`[ClaudeSync] Removed ${removed} sub-agent session rows`);
    }

    const removedMem = await this.cleanupClaudeMemRows();
    if (removedMem > 0) {
      console.log(`[ClaudeSync] Removed ${removedMem} claude-mem observer session rows`);
    }

    const nameMap = await buildLookupMap(path.join(this.claudeHome, 'history.jsonl'), 'sessionId', 'display');
    const files = await findFilesRecursivelyCreatedAfter(
      path.join(this.claudeHome, 'projects'),
      '.jsonl',
      since ?? null
    );

    let skippedMem = 0;
    let processed = 0;
    for (const filePath of files) {
      if (isSubAgentFile(filePath)) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      if (await isClaudeMemSession(filePath)) {
        skippedMem += 1;
        continue;
      }

      const parsed = await this.processSessionFile(filePath, nameMap);
      if (!parsed) {
        continue;
      }

      const timestamps = await readFileTimestamps(filePath);
      sessionsDb.createSession(
        parsed.sessionId,
        this.provider,
        parsed.projectPath,
        parsed.sessionName,
        timestamps.createdAt,
        timestamps.updatedAt,
        filePath
      );
      processed += 1;
    }

    if (skippedMem > 0) {
      console.log(`[ClaudeSync] Skipped ${skippedMem} claude-mem observer session files during scan`);
    }

    return processed;
  }

  /**
   * Reads the JSONL from the top and returns the first user message text
   * (up to 60 chars), or undefined if no usable message is found.
   *
   * Skips:
   *  - Records that aren't type=user
   *  - Content that starts with `<` (system-generated stubs)
   *  - Empty content after trimming
   */
  private async extractFirstUserMessagePreview(filePath: string): Promise<string | undefined> {
    try {
      const rl = createInterface({
        input: createReadStream(filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          continue;
        }

        const data = parsed as Record<string, unknown>;

        if (data.type !== 'user') {
          continue;
        }

        const messageObj = data.message as Record<string, unknown> | undefined;
        const rawContent = messageObj?.content ?? data.content;

        let text = '';
        if (typeof rawContent === 'string') {
          text = rawContent;
        } else if (Array.isArray(rawContent)) {
          for (const block of rawContent) {
            const b = block as Record<string, unknown>;
            if (b.type === 'text' && typeof b.text === 'string') {
              text = b.text;
              break;
            }
          }
        }

        // Normalize whitespace
        text = text.replace(/\s+/g, ' ').trim();

        if (!text) {
          continue;
        }

        // Skip system-generated stubs
        if (text.startsWith('<')) {
          continue;
        }

        rl.close();
        return text.slice(0, 60);
      }
    } catch {
      // Ignore unreadable files
    }

    return undefined;
  }

  /**
   * Parses and upserts one Claude session JSONL file.
   */
  async synchronizeFile(filePath: string): Promise<string | null> {
    if (!filePath.endsWith('.jsonl')) {
      return null;
    }

    if (isSubAgentFile(filePath)) {
      return null;
    }

    if (await isClaudeMemSession(filePath)) {
      return null;
    }

    const nameMap = await buildLookupMap(path.join(this.claudeHome, 'history.jsonl'), 'sessionId', 'display');
    const parsed = await this.processSessionFile(filePath, nameMap);
    if (!parsed) {
      return null;
    }

    const timestamps = await readFileTimestamps(filePath);
    return sessionsDb.createSession(
      parsed.sessionId,
      this.provider,
      parsed.projectPath,
      parsed.sessionName,
      timestamps.createdAt,
      timestamps.updatedAt,
      filePath
    );
  }

  /**
   * Extracts session metadata from one Claude JSONL session file.
   */
  private async processSessionFile(
    filePath: string,
    nameMap: Map<string, string>
  ): Promise<ParsedSession | null> {
    const parsed = await extractFirstValidJsonlData(filePath, (rawData) => {
      const data = rawData as Record<string, unknown>;

      // Content-level safety net: skip sub-agent sidechains.
      if (data.isSidechain === true) {
        return null;
      }

      const sessionId = typeof data.sessionId === 'string' ? data.sessionId : undefined;
      const projectPath = typeof data.cwd === 'string' ? data.cwd : undefined;

      if (!sessionId || !projectPath) {
        return null;
      }

      if (isEphemeralProjectPath(projectPath)) {
        return null;
      }

      return {
        sessionId,
        projectPath,
      };
    });

    if (!parsed) {
      return null;
    }

    const existingSession = sessionsDb.getSessionById(parsed.sessionId);
    const existingSessionName = existingSession?.custom_name;
    const existingTitleSource = existingSession?.title_source;

    // 1. User-assigned name — preserve as-is
    if (existingSessionName && existingSessionName !== 'Untitled Claude Session' && existingTitleSource === 'user') {
      return {
        ...parsed,
        sessionName: normalizeSessionName(existingSessionName, 'Untitled Claude Session'),
      };
    }

    // 2. nameMap (history.jsonl)
    let sessionName = nameMap.get(parsed.sessionId);
    if (sessionName) {
      sessionsDb.setSessionTitleSource(parsed.sessionId, 'ai-event');
    }

    // 3. ai-title / last-prompt / custom-title events in the JSONL
    if (!sessionName) {
      sessionName = await this.extractSessionAiTitleFromEnd(filePath, parsed.sessionId);
      if (sessionName) {
        sessionsDb.setSessionTitleSource(parsed.sessionId, 'ai-event');
      }
    }

    // 4. First user message preview (Phase A fallback)
    if (!sessionName) {
      const preview = await this.extractFirstUserMessagePreview(filePath);
      if (preview) {
        sessionName = preview;
        sessionsDb.setSessionTitleSource(parsed.sessionId, 'first-message');
      }
    }

    const resolvedName = normalizeSessionName(sessionName, 'Untitled Claude Session');

    // Track fallback sentinel so Phase B knows to regenerate
    if (resolvedName === 'Untitled Claude Session') {
      sessionsDb.setSessionTitleSource(parsed.sessionId, 'fallback');

      // Enqueue LLM title generation if the file has meaningful content
      try {
        const fileStat = await stat(filePath);
        if (fileStat.size > 1024) {
          titleGenerationQueue.enqueue(parsed.sessionId, filePath);
        }
      } catch {
        // Ignore stat errors — file may have been removed between sync and now
      }
    }

    return {
      ...parsed,
      sessionName: resolvedName,
    };
  }

  private async extractSessionAiTitleFromEnd(
    filePath: string,
    sessionId: string
  ): Promise<string | undefined> {
    try {
      const content = await readFile(filePath, 'utf8');
      const lines = content.split(/\r?\n/);

      for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index]?.trim();
        if (!line) {
          continue;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        const data = parsed as Record<string, unknown>;
        const eventType = typeof data.type === 'string' ? data.type : undefined;
        const eventSessionId = typeof data.sessionId === 'string' ? data.sessionId : undefined;
        const aiTitle = typeof data.aiTitle === 'string' ? data.aiTitle : undefined;
        const lastPrompt = typeof data.lastPrompt === 'string' ? data.lastPrompt : undefined;
        const claudeRenamedTitle = typeof data.customTitle === 'string' ? data.customTitle : undefined;

        if (
          (eventType === 'ai-title' && eventSessionId === sessionId && aiTitle?.trim()) ||
          (eventType === 'last-prompt' && eventSessionId === sessionId && lastPrompt?.trim()) ||
          (eventType === "custom-title" && eventSessionId === sessionId && claudeRenamedTitle?.trim())
        ) {
          return aiTitle || lastPrompt || claudeRenamedTitle;
        }
      }
    } catch {
      // Ignore missing/unreadable files so sync can continue.
    }

    return undefined;
  }
}
