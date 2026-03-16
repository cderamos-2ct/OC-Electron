/**
 * Calendar event persistence — upsert poll results into calendar_events.
 */
import pg from 'pg';
import type { CalendarEvent } from '../../../shared/types.js';

/**
 * Upsert a batch of calendar events fetched from a poll cycle.
 * On conflict (same event id) we update mutable fields and bump updated_at.
 */
export async function upsertCalendarEvents(
  pool: pg.Pool,
  events: CalendarEvent[],
  calendarId = 'primary',
): Promise<void> {
  if (events.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const evt of events) {
      await client.query(
        `INSERT INTO calendar_events (
          id, summary, description, location, start_time, end_time,
          attendees, status, html_link, calendar_id, polled_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (id) DO UPDATE SET
          summary     = EXCLUDED.summary,
          description = EXCLUDED.description,
          location    = EXCLUDED.location,
          start_time  = EXCLUDED.start_time,
          end_time    = EXCLUDED.end_time,
          attendees   = EXCLUDED.attendees,
          status      = EXCLUDED.status,
          html_link   = EXCLUDED.html_link,
          polled_at   = EXCLUDED.polled_at,
          updated_at  = NOW()`,
        [
          evt.id,
          evt.summary,
          evt.description ?? null,
          evt.location ?? null,
          evt.start,
          evt.end,
          JSON.stringify(evt.attendees ?? []),
          evt.status,
          evt.htmlLink,
          calendarId,
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
 * Fetch upcoming calendar events from the local DB cache.
 */
export async function listCachedCalendarEvents(
  pool: pg.Pool,
  limit = 50,
): Promise<CalendarEvent[]> {
  const result = await pool.query<{
    id: string;
    summary: string;
    description: string | null;
    location: string | null;
    start_time: string;
    end_time: string;
    attendees: Array<{ email: string; responseStatus: string }>;
    status: string;
    html_link: string;
  }>(
    `SELECT id, summary, description, location, start_time, end_time,
            attendees, status, html_link
     FROM calendar_events
     ORDER BY start_time ASC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((r) => ({
    id: r.id,
    summary: r.summary,
    description: r.description ?? undefined,
    location: r.location ?? undefined,
    start: r.start_time,
    end: r.end_time,
    attendees: r.attendees,
    status: r.status,
    htmlLink: r.html_link,
  }));
}
