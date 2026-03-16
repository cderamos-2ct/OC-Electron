import { EventEmitter } from 'events';
import { gws, gwsCheckAuth, GwsError } from './gws-adapter.js';
import type { APIWorker } from './worker-manager.js';
import type { APIWorkerStatus, GmailMessage, GmailDraft } from '../../shared/types.js';
import { getMainPool } from '../db-pool.js';
import { upsertGmailMessages } from './db/gmail-repo.js';

const BACKOFF_SEQUENCE_MS = [1000, 2000, 4000, 8000, 30000];

function getBackoffMs(consecutiveErrors: number): number {
  const idx = Math.min(consecutiveErrors, BACKOFF_SEQUENCE_MS.length - 1);
  return BACKOFF_SEQUENCE_MS[idx];
}

/**
 * Encode a plain-text email as base64url RFC 2822 message.
 */
function encodeRfc2822(to: string, subject: string, body: string): string {
  const raw = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    body,
  ].join('\r\n');
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Gmail worker backed by the `gws` CLI instead of the googleapis SDK.
 * Same public interface as the old GmailWorker.
 */
export class GwsGmailWorker extends EventEmitter implements APIWorker {
  readonly name = 'gmail';
  readonly pollIntervalMs = 60_000;

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private lastPollAt: string | null = null;
  private errorCount = 0;
  private consecutiveErrors = 0;
  private authenticated = false;

  constructor() {
    super();
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Check auth asynchronously — don't block start
    void gwsCheckAuth().then((ok) => {
      this.authenticated = ok;
      if (!ok) {
        console.warn('[GwsGmailWorker] gws not authenticated — run `gws auth login` first. Worker will not poll.');
        return;
      }
      console.log('[GwsGmailWorker] gws authenticated, starting poll loop.');
      this.schedulePoll(0);
    });
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getStatus(): APIWorkerStatus {
    return {
      name: this.name,
      isRunning: this.running,
      lastPollAt: this.lastPollAt,
      errorCount: this.errorCount,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  private schedulePoll(delayMs: number): void {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => {
      void this.poll();
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.running) return;
    try {
      const messages = await this.listMessages('is:unread', 10);
      this.lastPollAt = new Date().toISOString();
      this.consecutiveErrors = 0;
      this.emit('new-messages', messages.length);

      // Persist poll results to Postgres (best-effort — don't fail the poll on DB error)
      if (messages.length > 0) {
        try {
          await upsertGmailMessages(getMainPool(), messages);
        } catch (dbErr) {
          console.warn('[GwsGmailWorker] DB persist failed (non-fatal):', dbErr);
        }
      }

      this.schedulePoll(this.pollIntervalMs);
    } catch (err) {
      this.errorCount++;
      this.consecutiveErrors++;
      this.emit('error', err);
      const backoff = getBackoffMs(this.consecutiveErrors - 1);
      console.error(`[GwsGmailWorker] Poll error (consecutive: ${this.consecutiveErrors}), retrying in ${backoff}ms:`, err);
      this.schedulePoll(backoff);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async listMessages(query?: string, maxResults = 20): Promise<GmailMessage[]> {
    const params: Record<string, unknown> = { userId: 'me', maxResults };
    if (query) {
      params['q'] = query;
    }
    const result = await gws([
      'gmail', 'users', 'messages', 'list',
      '--params', JSON.stringify(params),
    ]);
    const items = Array.isArray(result)
      ? result
      : ((result as Record<string, unknown>)?.messages as unknown[] ?? []);
    return items.map(toGmailMessage);
  }

  async getMessage(messageId: string): Promise<GmailMessage> {
    const result = await gws([
      'gmail', 'users', 'messages', 'get',
      '--params', JSON.stringify({ userId: 'me', id: messageId, format: 'full' }),
    ]);
    return toGmailMessage(result);
  }

  async archiveMessage(messageId: string): Promise<void> {
    await gws([
      'gmail', 'users', 'messages', 'modify',
      '--params', JSON.stringify({ userId: 'me', id: messageId }),
      '--json', JSON.stringify({ removeLabelIds: ['INBOX'] }),
    ]);
  }

  async labelMessage(messageId: string, addLabels: string[], removeLabels: string[] = []): Promise<void> {
    await gws([
      'gmail', 'users', 'messages', 'modify',
      '--params', JSON.stringify({ userId: 'me', id: messageId }),
      '--json', JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels }),
    ]);
  }

  async createDraft(to: string, subject: string, body: string): Promise<GmailDraft> {
    const raw = encodeRfc2822(to, subject, body);
    const result = await gws([
      'gmail', 'users', 'drafts', 'create',
      '--params', JSON.stringify({ userId: 'me' }),
      '--json', JSON.stringify({ message: { raw } }),
    ]);
    return toGmailDraft(result);
  }

  async sendDraft(draftId: string): Promise<void> {
    await gws([
      'gmail', 'users', 'drafts', 'send',
      '--params', JSON.stringify({ userId: 'me' }),
      '--json', JSON.stringify({ id: draftId }),
    ]);
  }

  async deleteMessage(messageId: string): Promise<void> {
    await gws([
      'gmail', 'users', 'messages', 'trash',
      '--params', JSON.stringify({ userId: 'me', id: messageId }),
    ]);
  }

  async batchModify(messageIds: string[], addLabels: string[], removeLabels: string[]): Promise<void> {
    await gws([
      'gmail', 'users', 'messages', 'batchModify',
      '--params', JSON.stringify({ userId: 'me' }),
      '--json', JSON.stringify({ ids: messageIds, addLabelIds: addLabels, removeLabelIds: removeLabels }),
    ]);
  }
}

// ── Mapping helpers ────────────────────────────────────────────────────────

function toGmailMessage(raw: unknown): GmailMessage {
  const r = (raw ?? {}) as Record<string, unknown>;
  const payload = r.payload as Record<string, unknown> | undefined;
  const headers = (r.headers ?? payload?.headers ?? []) as Array<{ name?: string; value?: string }>;
  const getHeader = (name: string) =>
    headers?.find?.((h: { name?: string; value?: string }) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

  return {
    id: String(r.id ?? ''),
    threadId: String(r.threadId ?? r.thread_id ?? ''),
    labelIds: Array.isArray(r.labelIds) ? r.labelIds as string[] : Array.isArray(r.label_ids) ? r.label_ids as string[] : [],
    snippet: String(r.snippet ?? ''),
    from: String(r.from ?? getHeader('from') ?? ''),
    to: String(r.to ?? getHeader('to') ?? ''),
    subject: String(r.subject ?? getHeader('subject') ?? ''),
    date: String(r.date ?? getHeader('date') ?? ''),
    body: r.body != null ? String(r.body) : undefined,
  };
}

function toGmailDraft(raw: unknown): GmailDraft {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id ?? r.draftId ?? r.draft_id ?? ''),
    message: toGmailMessage(r.message ?? r),
  };
}
