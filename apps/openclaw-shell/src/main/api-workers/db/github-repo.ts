/**
 * GitHub notification persistence — upsert poll results into github_notifications.
 */
import pg from 'pg';
import type { GitHubNotification } from '../../../shared/types.js';

/**
 * Upsert a batch of GitHub notifications fetched from a poll cycle.
 * On conflict (same notification id) we update mutable fields and bump updated_at.
 */
export async function upsertGitHubNotifications(
  pool: pg.Pool,
  notifications: GitHubNotification[],
): Promise<void> {
  if (notifications.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const n of notifications) {
      await client.query(
        `INSERT INTO github_notifications (
          id, reason, subject, repository, updated_at_gh, unread, polled_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          reason        = EXCLUDED.reason,
          subject       = EXCLUDED.subject,
          unread        = EXCLUDED.unread,
          updated_at_gh = EXCLUDED.updated_at_gh,
          polled_at     = EXCLUDED.polled_at,
          updated_at    = NOW()`,
        [
          n.id,
          n.reason,
          JSON.stringify(n.subject),
          n.repository.full_name,
          n.updated_at,
          n.unread,
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
 * Fetch recent GitHub notifications from the local DB cache.
 */
export async function listCachedGitHubNotifications(
  pool: pg.Pool,
  unreadOnly = false,
  limit = 50,
): Promise<GitHubNotification[]> {
  const whereClause = unreadOnly ? 'WHERE unread = true' : '';
  const result = await pool.query<{
    id: string;
    reason: string;
    subject: { title: string; url: string; type: string };
    repository: string;
    updated_at_gh: string;
    unread: boolean;
  }>(
    `SELECT id, reason, subject, repository, updated_at_gh, unread
     FROM github_notifications
     ${whereClause}
     ORDER BY polled_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    subject: r.subject,
    repository: { full_name: r.repository },
    updated_at: r.updated_at_gh,
    unread: r.unread,
  }));
}

/**
 * Mark a notification as read in the local DB cache.
 */
export async function markNotificationReadInDb(
  pool: pg.Pool,
  notificationId: string,
): Promise<void> {
  await pool.query(
    `UPDATE github_notifications SET unread = false, updated_at = NOW() WHERE id = $1`,
    [notificationId],
  );
}
