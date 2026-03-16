// Tests for api-workers/db/github-repo.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  upsertGitHubNotifications,
  listCachedGitHubNotifications,
  markNotificationReadInDb,
} from '../../../api-workers/db/github-repo.js';
import type { GitHubNotification } from '../../../../shared/types.js';

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

function makeNotification(overrides: Partial<GitHubNotification> = {}): GitHubNotification {
  return {
    id: 'notif-001',
    reason: 'mention',
    subject: { title: 'Fix bug #123', url: 'https://api.github.com/repos/org/repo/issues/123', type: 'Issue' },
    repository: { full_name: 'org/repo' },
    updated_at: '2024-06-01T00:00:00Z',
    unread: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── upsertGitHubNotifications ────────────────────────────────────────────────

describe('upsertGitHubNotifications', () => {
  it('is a no-op when notifications array is empty', async () => {
    const pool = makePool();
    await upsertGitHubNotifications(pool as any, []);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('begins and commits a transaction', async () => {
    const client = makeClient();
    const pool = makePool(client);

    await upsertGitHubNotifications(pool as any, [makeNotification()]);

    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('inserts each notification with correct parameters', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const notif = makeNotification();

    await upsertGitHubNotifications(pool as any, [notif]);

    const insertCall = client.query.mock.calls.find(
      (args) => typeof args[0] === 'string' && args[0].includes('github_notifications'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall![1] as unknown[];
    expect(params[0]).toBe('notif-001');
    expect(params[1]).toBe('mention');
    expect(params[2]).toBe(JSON.stringify(notif.subject));
    expect(params[3]).toBe('org/repo');
    expect(params[4]).toBe('2024-06-01T00:00:00Z');
    expect(params[5]).toBe(true);
  });

  it('rolls back and rethrows on error', async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const pool = makePool(client);

    await expect(upsertGitHubNotifications(pool as any, [makeNotification()])).rejects.toThrow('DB error');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('handles multiple notifications in a single batch', async () => {
    const client = makeClient();
    const pool = makePool(client);
    const notifications = [
      makeNotification({ id: 'n1' }),
      makeNotification({ id: 'n2', reason: 'review_requested' }),
      makeNotification({ id: 'n3', unread: false }),
    ];

    await upsertGitHubNotifications(pool as any, notifications);

    // BEGIN + 3 inserts + COMMIT = 5 calls
    expect(client.query).toHaveBeenCalledTimes(5);
  });
});

// ─── listCachedGitHubNotifications ───────────────────────────────────────────

describe('listCachedGitHubNotifications', () => {
  it('returns mapped GitHubNotification objects', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: 'notif-001',
          reason: 'mention',
          subject: { title: 'Fix bug', url: 'https://api.github.com/x', type: 'Issue' },
          repository: 'org/repo',
          updated_at_gh: '2024-06-01T00:00:00Z',
          unread: true,
        },
      ],
    });

    const result = await listCachedGitHubNotifications(pool as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'notif-001',
      reason: 'mention',
      subject: { title: 'Fix bug', url: 'https://api.github.com/x', type: 'Issue' },
      repository: { full_name: 'org/repo' },
      updated_at: '2024-06-01T00:00:00Z',
      unread: true,
    });
  });

  it('uses default limit and no unread filter', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({ rows: [] });

    await listCachedGitHubNotifications(pool as any);

    const call = (pool.query as any).mock.calls[0];
    expect(call[0]).not.toContain('WHERE unread');
    expect(call[1]).toEqual([50]);
  });

  it('adds WHERE clause when unreadOnly = true', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({ rows: [] });

    await listCachedGitHubNotifications(pool as any, true);

    const call = (pool.query as any).mock.calls[0];
    expect(call[0]).toContain('WHERE unread = true');
  });

  it('accepts a custom limit', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({ rows: [] });

    await listCachedGitHubNotifications(pool as any, false, 10);

    expect(pool.query).toHaveBeenCalledWith(expect.anything(), [10]);
  });
});

// ─── markNotificationReadInDb ─────────────────────────────────────────────────

describe('markNotificationReadInDb', () => {
  it('updates unread to false for the given notification id', async () => {
    const pool = makePool();
    (pool.query as any).mockResolvedValueOnce({ rows: [] });

    await markNotificationReadInDb(pool as any, 'notif-001');

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('unread = false'),
      ['notif-001'],
    );
  });
});
