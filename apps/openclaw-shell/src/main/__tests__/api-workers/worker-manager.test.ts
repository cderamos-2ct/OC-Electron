// Tests for api-workers/worker-manager.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock fs (for credentials file) ──────────────────────────────────────────
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

// ─── Mock shared constants ────────────────────────────────────────────────────
vi.mock('../../../shared/constants.js', () => ({
  SHELL_CONFIG_DIR_NAME: '.openclaw-shell',
}));

import { existsSync, readFileSync } from 'fs';
import { WorkerManager } from '../../api-workers/worker-manager.js';
import type { APIWorker } from '../../api-workers/worker-manager.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

function makeWorker(name: string, overrides: Partial<APIWorker> = {}): APIWorker {
  return {
    name,
    pollIntervalMs: 60_000,
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn().mockReturnValue({
      name,
      isRunning: false,
      lastPollAt: null,
      errorCount: 0,
      consecutiveErrors: 0,
    }),
    ...overrides,
  };
}

function makeCredentialProvider() {
  return {
    getCredential: vi.fn(),
    onRotated: vi.fn(),
    dispose: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
});

// ─── register ─────────────────────────────────────────────────────────────────

describe('register', () => {
  it('registers a worker', () => {
    const manager = new WorkerManager();
    const worker = makeWorker('gmail');
    manager.register(worker);
    expect(manager.getWorker('gmail')).toBe(worker);
  });

  it('skips duplicate registrations', () => {
    const manager = new WorkerManager();
    const worker1 = makeWorker('gmail');
    const worker2 = makeWorker('gmail');
    manager.register(worker1);
    manager.register(worker2);
    expect(manager.getWorker('gmail')).toBe(worker1); // first registration kept
  });

  it('getWorker returns undefined for unknown worker', () => {
    const manager = new WorkerManager();
    expect(manager.getWorker('nonexistent')).toBeUndefined();
  });
});

// ─── startAll / stopAll ───────────────────────────────────────────────────────

describe('startAll', () => {
  it('calls start() on all registered workers', () => {
    const manager = new WorkerManager();
    const gmail = makeWorker('gmail');
    const calendar = makeWorker('calendar');
    manager.register(gmail);
    manager.register(calendar);

    manager.startAll();

    expect(gmail.start).toHaveBeenCalledTimes(1);
    expect(calendar.start).toHaveBeenCalledTimes(1);
  });

  it('marks workers as running after startAll', () => {
    const manager = new WorkerManager();
    manager.register(makeWorker('gmail'));
    manager.startAll();

    const statuses = manager.getAllStatuses();
    expect(statuses[0].isRunning).toBe(true);
  });

  it('increments errorCount when start() throws', () => {
    const manager = new WorkerManager();
    const badWorker = makeWorker('bad', {
      start: vi.fn().mockImplementation(() => { throw new Error('start failed'); }),
    });
    manager.register(badWorker);
    manager.startAll(); // should not throw

    const statuses = manager.getAllStatuses();
    expect(statuses[0].errorCount).toBe(1);
    expect(statuses[0].consecutiveErrors).toBe(1);
  });
});

describe('stopAll', () => {
  it('calls stop() on all registered workers', () => {
    const manager = new WorkerManager();
    const gmail = makeWorker('gmail');
    const github = makeWorker('github');
    manager.register(gmail);
    manager.register(github);
    manager.startAll();
    manager.stopAll();

    expect(gmail.stop).toHaveBeenCalledTimes(1);
    expect(github.stop).toHaveBeenCalledTimes(1);
  });

  it('marks workers as not running after stopAll', () => {
    const manager = new WorkerManager();
    manager.register(makeWorker('gmail'));
    manager.startAll();
    manager.stopAll();

    const statuses = manager.getAllStatuses();
    expect(statuses[0].isRunning).toBe(false);
  });

  it('does not throw when stop() throws', () => {
    const manager = new WorkerManager();
    const badWorker = makeWorker('bad', {
      stop: vi.fn().mockImplementation(() => { throw new Error('stop failed'); }),
    });
    manager.register(badWorker);
    manager.startAll();
    expect(() => manager.stopAll()).not.toThrow();
  });
});

// ─── recordPoll ────────────────────────────────────────────────────────────────

describe('recordPoll', () => {
  it('updates lastPollAt and resets consecutiveErrors on success', () => {
    const manager = new WorkerManager();
    manager.register(makeWorker('gmail'));
    manager.recordPoll('gmail', false); // add an error first
    manager.recordPoll('gmail', true);  // then success

    const statuses = manager.getAllStatuses();
    expect(statuses[0].lastPollAt).not.toBeNull();
    expect(statuses[0].errorCount).toBe(1);       // total errors still 1
    expect(statuses[0].consecutiveErrors).toBe(0); // reset by success
  });

  it('increments errorCount and consecutiveErrors on failure', () => {
    const manager = new WorkerManager();
    manager.register(makeWorker('gmail'));
    manager.recordPoll('gmail', false);
    manager.recordPoll('gmail', false);

    const statuses = manager.getAllStatuses();
    expect(statuses[0].errorCount).toBe(2);
    expect(statuses[0].consecutiveErrors).toBe(2);
  });

  it('is a no-op for unknown worker', () => {
    const manager = new WorkerManager();
    expect(() => manager.recordPoll('nonexistent', true)).not.toThrow();
  });
});

// ─── getAllStatuses ────────────────────────────────────────────────────────────

describe('getAllStatuses', () => {
  it('returns status for all registered workers', () => {
    const manager = new WorkerManager();
    manager.register(makeWorker('gmail'));
    manager.register(makeWorker('calendar'));
    manager.register(makeWorker('github'));

    const statuses = manager.getAllStatuses();
    expect(statuses).toHaveLength(3);
    expect(statuses.map((s) => s.name)).toContain('gmail');
    expect(statuses.map((s) => s.name)).toContain('calendar');
    expect(statuses.map((s) => s.name)).toContain('github');
  });

  it('returns empty array when no workers registered', () => {
    const manager = new WorkerManager();
    expect(manager.getAllStatuses()).toHaveLength(0);
  });
});

// ─── refreshAllCredentials ─────────────────────────────────────────────────────

describe('refreshAllCredentials', () => {
  it('calls refreshCredentials on workers that support it', async () => {
    const manager = new WorkerManager();
    const refreshFn = vi.fn().mockResolvedValue(undefined);
    const workerWithRefresh = makeWorker('gmail', { refreshCredentials: refreshFn });
    const workerWithout = makeWorker('calendar');

    manager.register(workerWithRefresh);
    manager.register(workerWithout);

    await manager.refreshAllCredentials();

    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it('continues refreshing other workers when one throws', async () => {
    const manager = new WorkerManager();
    const goodRefresh = vi.fn().mockResolvedValue(undefined);
    const badRefresh = vi.fn().mockRejectedValue(new Error('refresh failed'));

    manager.register(makeWorker('bad', { refreshCredentials: badRefresh }));
    manager.register(makeWorker('good', { refreshCredentials: goodRefresh }));

    await expect(manager.refreshAllCredentials()).resolves.toBeUndefined();
    expect(goodRefresh).toHaveBeenCalledTimes(1);
  });
});

// ─── credential provider ───────────────────────────────────────────────────────

describe('setCredentialProvider / getCredentialProvider', () => {
  it('stores and retrieves credential provider', () => {
    const manager = new WorkerManager();
    expect(manager.getCredentialProvider()).toBeNull();

    const provider = makeCredentialProvider();
    manager.setCredentialProvider(provider as any);
    expect(manager.getCredentialProvider()).toBe(provider);
  });
});

// ─── loadCredentials (static) ──────────────────────────────────────────────────

describe('WorkerManager.loadCredentials', () => {
  it('returns empty object when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    expect(WorkerManager.loadCredentials()).toEqual({});
  });

  it('parses credentials from file', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ github: { token: 'tok' } }));
    expect(WorkerManager.loadCredentials()).toEqual({ github: { token: 'tok' } });
  });

  it('returns empty object on JSON parse error', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ bad json }');
    expect(WorkerManager.loadCredentials()).toEqual({});
  });
});
