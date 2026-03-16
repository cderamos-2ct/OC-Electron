// Tests for api-workers/db/calendar-repo.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertCalendarEvents, listCachedCalendarEvents } from '../../../api-workers/db/calendar-repo.js';
import type { CalendarEvent } from '../../../../shared/types.js';

function makeClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

function makePool(client = makeClient()) {
  return {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    _client: client,
  };
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-001',
    summary: 'Team Standup',
    description: 'Daily sync',
    location: 'Zoom',
    start: '2024-06-01T09:00:00Z',
    end: '2024-06-01T09:30:00Z',
    attendees: [{ email: 'alice@example.com', responseStatus: 'accepted' }],
    status: 'confirmed',
    htmlLink: 'https://calendar.google.com/event?eid=xxx',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── upsertCalendarEvents ─────────────────────────────────────────────────────

describe('upsertCalendarEvents', () => {
  it('is a no-op when events array is empty', async () => {
    const pool = makePool();
    await upsertCalendarEvents(pool as any, []);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('begins and commits transaction for a batch', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const events = [makeEvent(), makeEvent({ id: 'evt-002' })];

    await upsertCalendarEvents(pool as any, events);

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('inserts each event with correct parameters', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const evt = makeEvent();

    await upsertCalendarEvents(pool as any, [evt]);

    const insertCall = client.query.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('calendar_events'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall![1] as unknown[];
    expect(params[0]).toBe('evt-001');
    expect(params[1]).toBe('Team Standup');
    expect(params[2]).toBe('Daily sync');
    expect(params[3]).toBe('Zoom');
    expect(params[4]).toBe('2024-06-01T09:00:00Z');
    expect(params[5]).toBe('2024-06-01T09:30:00Z');
    expect(params[7]).toBe('confirmed');
    expect(params[9]).toBe('primary'); // default calendarId
  });

  it('uses null for optional fields when absent', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const evt = makeEvent({ description: undefined, location: undefined, attendees: undefined });

    await upsertCalendarEvents(pool as any, [evt]);

    const insertCall = client.query.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('calendar_events'),
    );
    const params = insertCall![1] as unknown[];
    expect(params[2]).toBeNull(); // description
    expect(params[3]).toBeNull(); // location
    expect(params[6]).toBe('[]'); // attendees JSON
  });

  it('accepts a custom calendarId', async () => {
    const client = makeClient();
    const pool = makePool(client);

    await upsertCalendarEvents(pool as any, [makeEvent()], 'work@example.com');

    const insertCall = client.query.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('calendar_events'),
    );
    const params = insertCall![1] as unknown[];
    expect(params[9]).toBe('work@example.com');
  });

  it('rolls back and rethrows on error', async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockRejectedValueOnce(new Error('FK violation'))
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const pool = makePool(client);

    await expect(upsertCalendarEvents(pool as any, [makeEvent()])).rejects.toThrow('FK violation');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

// ─── listCachedCalendarEvents ─────────────────────────────────────────────────

describe('listCachedCalendarEvents', () => {
  it('returns mapped CalendarEvent objects', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: 'evt-001',
          summary: 'Standup',
          description: 'Daily',
          location: 'Zoom',
          start_time: '2024-06-01T09:00:00Z',
          end_time: '2024-06-01T09:30:00Z',
          attendees: [{ email: 'a@b.com', responseStatus: 'accepted' }],
          status: 'confirmed',
          html_link: 'https://cal.google.com/evt',
        },
      ],
    });

    const result = await listCachedCalendarEvents(pool as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'evt-001',
      summary: 'Standup',
      description: 'Daily',
      location: 'Zoom',
      start: '2024-06-01T09:00:00Z',
      end: '2024-06-01T09:30:00Z',
      attendees: [{ email: 'a@b.com', responseStatus: 'accepted' }],
      status: 'confirmed',
      htmlLink: 'https://cal.google.com/evt',
    });
  });

  it('maps null description/location to undefined', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: 'evt-002',
          summary: 'Meeting',
          description: null,
          location: null,
          start_time: '2024-06-01T10:00:00Z',
          end_time: '2024-06-01T11:00:00Z',
          attendees: [],
          status: 'confirmed',
          html_link: 'https://cal.google.com/evt2',
        },
      ],
    });

    const result = await listCachedCalendarEvents(pool as any);
    expect(result[0].description).toBeUndefined();
    expect(result[0].location).toBeUndefined();
  });

  it('uses default limit of 50', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({ rows: [] });
    await listCachedCalendarEvents(pool as any);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $1'), [50]);
  });

  it('accepts a custom limit', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({ rows: [] });
    await listCachedCalendarEvents(pool as any, 5);
    expect(pool.query).toHaveBeenCalledWith(expect.anything(), [5]);
  });
});
