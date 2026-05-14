import { sessionsDb } from '@/modules/database/index.js';
import { WS_OPEN_STATE, connectedClients } from '@/modules/websocket/index.js';
import type { RealtimeClientConnection } from '@/shared/types.js';
import { generateSessionTitle } from './claude-title-generator.service.js';

const UNTITLED_SENTINEL = 'Untitled Claude Session';
const CONCURRENCY = 3;

type QueueItem = {
  sessionId: string;
  jsonlPath: string;
};

type QueueProgress = {
  queued: number;
  inFlight: number;
  completed: number;
  failed: number;
};

function broadcastTitleUpdate(sessionId: string, title: string): void {
  const message = JSON.stringify({ type: 'session-title-updated', sessionId, title });
  connectedClients.forEach((client: RealtimeClientConnection) => {
    if (client.readyState === WS_OPEN_STATE) {
      client.send(message);
    }
  });
}

class TitleGenerationQueue {
  private readonly queue: QueueItem[] = [];
  private readonly inFlight = new Set<string>();
  private readonly enqueuedIds = new Set<string>();
  private completed = 0;
  private failed = 0;

  enqueue(sessionId: string, jsonlPath: string): void {
    if (this.enqueuedIds.has(sessionId) || this.inFlight.has(sessionId)) {
      return;
    }
    this.enqueuedIds.add(sessionId);
    this.queue.push({ sessionId, jsonlPath });
    this.drain();
  }

  getProgress(): QueueProgress {
    return {
      queued: this.queue.length,
      inFlight: this.inFlight.size,
      completed: this.completed,
      failed: this.failed,
    };
  }

  private drain(): void {
    while (this.queue.length > 0 && this.inFlight.size < CONCURRENCY) {
      const item = this.queue.shift();
      if (!item) {
        break;
      }
      this.enqueuedIds.delete(item.sessionId);
      this.inFlight.add(item.sessionId);
      this.processItem(item).catch(() => {
        // processItem handles its own errors internally
      });
    }
  }

  private async processItem(item: QueueItem): Promise<void> {
    try {
      // Idempotency check: re-read current custom_name from DB before generating
      const existingSession = sessionsDb.getSessionById(item.sessionId);
      if (!existingSession) {
        this.inFlight.delete(item.sessionId);
        this.failed += 1;
        this.drain();
        return;
      }

      const currentName = existingSession.custom_name;
      const titleSource = existingSession.title_source;
      // Skip if already named by user or LLM — don't overwrite good titles
      if ((currentName && currentName !== UNTITLED_SENTINEL && titleSource === 'user') ||
          titleSource === 'llm' || titleSource === 'ai-event') {
        this.inFlight.delete(item.sessionId);
        this.completed += 1;
        this.drain();
        return;
      }

      const title = await generateSessionTitle(item.sessionId, item.jsonlPath);

      if (title) {
        sessionsDb.updateSessionCustomName(item.sessionId, title);
        sessionsDb.setSessionTitleSource(item.sessionId, 'llm');
        broadcastTitleUpdate(item.sessionId, title);
        this.completed += 1;
      } else {
        this.failed += 1;
      }
    } catch (error) {
      console.error('[TitleQueue] Error processing session', item.sessionId, error);
      this.failed += 1;
    } finally {
      this.inFlight.delete(item.sessionId);
      this.drain();
    }
  }
}

export const titleGenerationQueue = new TitleGenerationQueue();
