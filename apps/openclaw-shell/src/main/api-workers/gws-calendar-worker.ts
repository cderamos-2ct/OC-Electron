import { EventEmitter } from 'events';
import { gws, gwsCheckAuth } from './gws-adapter.js';
import type { APIWorker } from './worker-manager.js';
import type { APIWorkerStatus, CalendarEvent, CalendarEventCreate } from '../../shared/types.js';
import { getMainPool } from '../db-pool.js';
import { upsertCalendarEvents } from './db/calendar-repo.js';

const POLL_INTERVAL_MS = 120_000; // 2 minutes
const BACKOFF_SEQUENCE_MS = [1000, 2000, 4000, 8000, 30000];

function getBackoffMs(consecutiveErrors: number): number {
  const idx = Math.min(consecutiveErrors, BACKOFF_SEQUENCE_MS.length - 1);
  return BACKOFF_SEQUENCE_MS[idx];
}

/**
 * Calendar worker backed by the `gws` CLI instead of the googleapis SDK.
 * Same public interface as the old CalendarWorker.
 */
export class GwsCalendarWorker extends EventEmitter implements APIWorker {
  readonly name = 'calendar';
  readonly pollIntervalMs = POLL_INTERVAL_MS;

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

    void gwsCheckAuth().then((ok) => {
      this.authenticated = ok;
      if (!ok) {
        console.warn('[GwsCalendarWorker] gws not authenticated — run `gws auth login` first. Worker will not poll.');
        return;
      }
      console.log('[GwsCalendarWorker] gws authenticated, starting poll loop.');
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
      // Poll upcoming events from now forward
      const timeMin = new Date().toISOString();
      const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const events = await this.listEvents(timeMin, timeMax);

      if (events.length > 0) {
        this.emit('event-changes', events);

        // Persist poll results to Postgres (best-effort — don't fail the poll on DB error)
        try {
          await upsertCalendarEvents(getMainPool(), events);
        } catch (dbErr) {
          console.warn('[GwsCalendarWorker] DB persist failed (non-fatal):', dbErr);
        }
      }

      this.lastPollAt = new Date().toISOString();
      this.consecutiveErrors = 0;
      this.schedulePoll(this.pollIntervalMs);
    } catch (err) {
      this.errorCount++;
      this.consecutiveErrors++;
      this.emit('error', err);
      const backoff = getBackoffMs(this.consecutiveErrors - 1);
      console.error(`[GwsCalendarWorker] Poll error (consecutive: ${this.consecutiveErrors}), retrying in ${backoff}ms:`, err);
      this.schedulePoll(backoff);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async listEvents(
    timeMin: string,
    timeMax: string,
    calendarId = 'primary',
  ): Promise<CalendarEvent[]> {
    const result = await gws([
      'calendar', 'events', 'list',
      '--params', JSON.stringify({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      }),
    ]);
    const items = Array.isArray(result)
      ? result
      : ((result as Record<string, unknown>)?.items ?? (result as Record<string, unknown>)?.events ?? []) as unknown[];
    return items.map(toCalendarEvent);
  }

  async getEvent(eventId: string, calendarId = 'primary'): Promise<CalendarEvent> {
    const result = await gws([
      'calendar', 'events', 'get',
      '--params', JSON.stringify({ calendarId, eventId }),
    ]);
    return toCalendarEvent(result);
  }

  async createEvent(event: CalendarEventCreate, calendarId = 'primary'): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {
      summary: event.summary,
      start: { dateTime: event.start.dateTime, timeZone: event.start.timeZone },
      end: { dateTime: event.end.dateTime, timeZone: event.end.timeZone },
    };
    if (event.description) {
      body['description'] = event.description;
    }
    if (event.location) {
      body['location'] = event.location;
    }
    if (event.attendees && event.attendees.length > 0) {
      body['attendees'] = event.attendees.map((a) => ({ email: a.email }));
    }
    const result = await gws([
      'calendar', 'events', 'insert',
      '--params', JSON.stringify({ calendarId }),
      '--json', JSON.stringify(body),
    ]);
    return toCalendarEvent(result);
  }

  async updateEvent(
    eventId: string,
    event: Partial<CalendarEventCreate>,
    calendarId = 'primary',
  ): Promise<CalendarEvent> {
    const body: Record<string, unknown> = {};
    if (event.summary) body['summary'] = event.summary;
    if (event.start?.dateTime) body['start'] = { dateTime: event.start.dateTime, timeZone: event.start.timeZone };
    if (event.end?.dateTime) body['end'] = { dateTime: event.end.dateTime, timeZone: event.end.timeZone };
    if (event.description) body['description'] = event.description;
    if (event.location) body['location'] = event.location;

    const result = await gws([
      'calendar', 'events', 'patch',
      '--params', JSON.stringify({ calendarId, eventId }),
      '--json', JSON.stringify(body),
    ]);
    return toCalendarEvent(result);
  }

  async acceptEvent(eventId: string, calendarId = 'primary'): Promise<CalendarEvent> {
    // Get the event first to locate own attendee entry, then patch responseStatus
    const existing = await this.getEvent(eventId, calendarId);
    // Build attendees list with own entry updated; fall back to a generic patch if not found
    const existingAttendees = existing.attendees ?? [];
    const attendees = existingAttendees.length > 0
      ? existingAttendees.map((a) => ({
          email: a.email,
          responseStatus: a.responseStatus === 'needsAction' || a.responseStatus === 'tentative' || a.responseStatus === 'declined'
            ? 'accepted'
            : a.responseStatus,
        }))
      : [{ email: 'me', responseStatus: 'accepted' }];

    const result = await gws([
      'calendar', 'events', 'patch',
      '--params', JSON.stringify({ calendarId, eventId }),
      '--json', JSON.stringify({ attendees }),
    ]);
    return toCalendarEvent(result);
  }

  async declineEvent(eventId: string, calendarId = 'primary'): Promise<CalendarEvent> {
    const existing = await this.getEvent(eventId, calendarId);
    const existingAttendees2 = existing.attendees ?? [];
    const attendees = existingAttendees2.length > 0
      ? existingAttendees2.map((a) => ({
          email: a.email,
          responseStatus: a.responseStatus === 'needsAction' || a.responseStatus === 'tentative' || a.responseStatus === 'accepted'
            ? 'declined'
            : a.responseStatus,
        }))
      : [{ email: 'me', responseStatus: 'declined' }];

    const result = await gws([
      'calendar', 'events', 'patch',
      '--params', JSON.stringify({ calendarId, eventId }),
      '--json', JSON.stringify({ attendees }),
    ]);
    return toCalendarEvent(result);
  }

  async findFreeTime(
    timeMin: string,
    timeMax: string,
    attendees: string[] = [],
  ): Promise<Array<{ timeMin: string; timeMax: string; busy: Array<{ start: string; end: string }> }>> {
    const items = (attendees.length > 0 ? attendees : ['primary']).map((id) => ({ id }));
    const result = await gws([
      'calendar', 'freebusy', 'query',
      '--json', JSON.stringify({ timeMin, timeMax, items }),
    ]);
    const calendars = ((result as Record<string, unknown>)?.calendars ?? {}) as Record<string, { busy?: Array<{ start: string; end: string }> }>;
    const calendarIds = attendees.length > 0 ? attendees : ['primary'];

    return calendarIds.map((id) => {
      const busy = (calendars[id]?.busy ?? []).map((b) => ({
        start: b.start ?? '',
        end: b.end ?? '',
      }));
      return { timeMin, timeMax, busy };
    });
  }
}

// ── Mapping helpers ────────────────────────────────────────────────────────

function toCalendarEvent(raw: unknown): CalendarEvent {
  const r = (raw ?? {}) as Record<string, unknown>;
  const start = r.start as Record<string, string> | string | undefined;
  const end = r.end as Record<string, string> | string | undefined;
  const attendeesRaw = (r.attendees ?? []) as Array<Record<string, string>>;

  return {
    id: String(r.id ?? ''),
    summary: String(r.summary ?? '(no title)'),
    description: r.description != null ? String(r.description) : undefined,
    location: r.location != null ? String(r.location) : undefined,
    start: typeof start === 'string' ? start : (start?.dateTime ?? start?.date ?? ''),
    end: typeof end === 'string' ? end : (end?.dateTime ?? end?.date ?? ''),
    attendees: attendeesRaw.map((a) => ({
      email: String(a.email ?? ''),
      responseStatus: String(a.responseStatus ?? a.response_status ?? 'needsAction'),
    })),
    status: String(r.status ?? 'confirmed'),
    htmlLink: String(r.htmlLink ?? r.html_link ?? ''),
  };
}
