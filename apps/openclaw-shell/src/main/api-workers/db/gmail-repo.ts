/**
 * Gmail message persistence — upsert poll results into gmail_messages.
 * Uses the openclaw-db pool via the shared pg instance from the main process.
 */
import pg from 'pg';
import type { GmailMessage } from '../../../shared/types.js';

/**
 * Upsert a batch of Gmail messages fetched from a poll cycle.
 * On conflict (same message id) we update mutable fields and bump updated_at.
 */
export async function upsertGmailMessages(
  pool: pg.Pool,
  messages: GmailMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const msg of messages) {
      await client.query(
        `INSERT INTO gmail_messages (
          id, thread_id, label_ids, snippet, from_address, to_address, subject, date, body, polled_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET
          label_ids    = EXCLUDED.label_ids,
          snippet      = EXCLUDED.snippet,
          body         = EXCLUDED.body,
          polled_at    = EXCLUDED.polled_at,
          updated_at   = NOW()`,
        [
          msg.id,
          msg.threadId,
          msg.labelIds,
          msg.snippet,
          msg.from,
          msg.to,
          msg.subject,
          msg.date,
          msg.body ?? null,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetch the most recent Gmail messages from the local DB cache.
 */
export async function listCachedGmailMessages(
  pool: pg.Pool,
  limit = 50,
): Promise<GmailMessage[]> {
  const result = await pool.query<{
    id: string;
    thread_id: string;
    label_ids: string[];
    snippet: string;
    from_address: string;
    to_address: string;
    subject: string;
    date: string;
    body: string | null;
  }>(
    `SELECT id, thread_id, label_ids, snippet, from_address, to_address, subject, date, body
     FROM gmail_messages
     ORDER BY polled_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    labelIds: r.label_ids,
    snippet: r.snippet,
    from: r.from_address,
    to: r.to_address,
    subject: r.subject,
    date: r.date,
    body: r.body ?? undefined,
  }));
}
