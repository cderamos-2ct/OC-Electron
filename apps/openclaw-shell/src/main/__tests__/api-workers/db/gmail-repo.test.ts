// Tests for api-workers/db/gmail-repo.ts
// Uses a mock pg.Pool / client

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { upsertGmailMessages, listCachedGmailMessages } from '../../../api-workers/db/gmail-repo.js';
import type { GmailMessage } from '../../../../shared/types.js';

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

function makeMessage(overrides: Partial<GmailMessage> = {}): GmailMessage {
  return {
    id: 'msg-001',
    threadId: 'thread-001',
    labelIds: ['INBOX', 'UNREAD'],
    snippet: 'Hello world',
    from: 'sender@example.com',
    to: 'recipient@example.com',
    subject: 'Test Subject',
    date: '2024-01-01T12:00:00Z',
    body: 'Full email body',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── upsertGmailMessages ──────────────────────────────────────────────────────

describe('upsertGmailMessages', () => {
  it('is a no-op when messages array is empty', async () => {
    const pool = makePool();
    await upsertGmailMessages(pool as any, []);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('begins and commits a transaction for a batch of messages', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const messages = [makeMessage(), makeMessage({ id: 'msg-002' })];

    await upsertGmailMessages(pool as any, messages);

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('inserts each message with correct parameters', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const msg = makeMessage();

    await upsertGmailMessages(pool as any, [msg]);

    const insertCall = client.query.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('gmail_messages'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall![1] as unknown[];
    expect(params[0]).toBe('msg-001');
    expect(params[1]).toBe('thread-001');
    expect(params[2]).toEqual(['INBOX', 'UNREAD']);
    expect(params[4]).toBe('sender@example.com');
    expect(params[5]).toBe('recipient@example.com');
    expect(params[6]).toBe('Test Subject');
  });

  it('uses null for body when body is undefined', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const msg = makeMessage({ body: undefined });

    await upsertGmailMessages(pool as any, [msg]);

    const insertCall = client.query.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('gmail_messages'),
    );
    const params = insertCall![1] as unknown[];
    expect(params[8]).toBeNull();
  });

  it('rolls back and rethrows on error', async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })   // BEGIN
      .mockRejectedValueOnce(new Error('constraint violation'))  // INSERT
      .mockResolvedValueOnce({ rows: [] });  // ROLLBACK

    const pool = makePool(client);
    const msg = makeMessage();

    await expect(upsertGmailMessages(pool as any, [msg])).rejects.toThrow('constraint violation');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

// ─── listCachedGmailMessages ──────────────────────────────────────────────────

describe('listCachedGmailMessages', () => {
  it('returns mapped GmailMessage objects', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: 'msg-001',
          thread_id: 'thread-001',
          label_ids: ['INBOX'],
          snippet: 'Hello',
          from_address: 'sender@example.com',
          to_address: 'recipient@example.com',
          subject: 'Hi',
          date: '2024-01-01',
          body: 'Full body',
        },
      ],
    });

    const result = await listCachedGmailMessages(pool as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'msg-001',
      threadId: 'thread-001',
      labelIds: ['INBOX'],
      snippet: 'Hello',
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Hi',
      date: '2024-01-01',
      body: 'Full body',
    });
  });

  it('maps null body to undefined', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: 'msg-002',
          thread_id: 'thread-002',
          label_ids: [],
          snippet: '',
          from_address: 'a@b.com',
          to_address: 'c@d.com',
          subject: 'Sub',
          date: '2024-01-02',
          body: null,
        },
      ],
    });

    const result = await listCachedGmailMessages(pool as any);
    expect(result[0].body).toBeUndefined();
  });

  it('uses default limit of 50', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({ rows: [] });

    await listCachedGmailMessages(pool as any);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $1'),
      [50],
    );
  });

  it('accepts a custom limit', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({ rows: [] });

    await listCachedGmailMessages(pool as any, 10);

    expect(pool.query).toHaveBeenCalledWith(expect.anything(), [10]);
  });
});
