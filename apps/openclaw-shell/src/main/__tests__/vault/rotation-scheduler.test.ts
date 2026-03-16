// Tests for rotation-scheduler.ts
// Mocks: openclaw-db, vault-audit, vault-db-repo

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('openclaw-db', () => ({ query: vi.fn() }));
vi.mock('../../vault/vault-audit.js', () => ({ appendVaultAuditEntry: vi.fn() }));
vi.mock('../../vault/vault-db-repo.js', () => ({ recordRotation: vi.fn() }));

import { query } from 'openclaw-db';
import { appendVaultAuditEntry } from '../../vault/vault-audit.js';
import { recordRotation } from '../../vault/vault-db-repo.js';
import { RotationScheduler, getDefaultRotationConfigs } from '../../vault/rotation-scheduler.js';

const mockQuery = vi.mocked(query);
const mockRecordRotation = vi.mocked(recordRotation);
const mockAppendAuditEntry = vi.mocked(appendVaultAuditEntry);

function makeVaultAdapter() {
  return {
    getSecret: vi.fn(),
    setSecret: vi.fn(),
    listSecrets: vi.fn(),
    sync: vi.fn(),
    getSecretCount: vi.fn(),
  };
}

function makeVaultBridge() {
  return {
    revokeBySecret: vi.fn().mockReturnValue(2),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockQuery.mockResolvedValue({ rows: [] } as any);
  mockRecordRotation.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── addSchedule ──────────────────────────────────────────────────────────────

describe('addSchedule', () => {
  it('registers a manual schedule without starting an interval', () => {
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);

    scheduler.addSchedule({
      secretName: 'openclaw/api-keys/github-pat',
      intervalMs: 60_000,
      mode: 'manual',
    });

    const schedules = scheduler.getSchedules();
    expect(schedules).toHaveLength(1);
    expect(schedules[0].secretName).toBe('openclaw/api-keys/github-pat');
    expect(schedules[0].mode).toBe('manual');
    expect(schedules[0].nextRotationAt).toBeNull();

    scheduler.dispose();
  });

  it('registers an auto schedule with nextRotationAt set', () => {
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);

    scheduler.addSchedule({
      secretName: 'openclaw/tokens/auto-token',
      intervalMs: 5_000,
      mode: 'auto',
      rotator: async () => 'new-value',
    });

    const schedules = scheduler.getSchedules();
    expect(schedules[0].nextRotationAt).not.toBeNull();

    scheduler.dispose();
  });

  it('replaces an existing schedule when re-added', () => {
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);

    scheduler.addSchedule({ secretName: 'sec', intervalMs: 1_000, mode: 'manual' });
    scheduler.addSchedule({ secretName: 'sec', intervalMs: 2_000, mode: 'manual' });

    const schedules = scheduler.getSchedules();
    expect(schedules).toHaveLength(1);
    expect(schedules[0].intervalMs).toBe(2_000);

    scheduler.dispose();
  });
});

// ─── removeSchedule ───────────────────────────────────────────────────────────

describe('removeSchedule', () => {
  it('removes a registered schedule', () => {
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);

    scheduler.addSchedule({ secretName: 'sec', intervalMs: 1_000, mode: 'manual' });
    scheduler.removeSchedule('sec');
    expect(scheduler.getSchedules()).toHaveLength(0);

    scheduler.dispose();
  });

  it('is a no-op when schedule does not exist', () => {
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);
    expect(() => scheduler.removeSchedule('nonexistent')).not.toThrow();
    scheduler.dispose();
  });
});

// ─── rotate — auto mode ───────────────────────────────────────────────────────

describe('rotate', () => {
  it('returns false and emits manual-rotation-needed when no rotator', async () => {
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);
    const manualSpy = vi.fn();
    scheduler.on('manual-rotation-needed', manualSpy);

    scheduler.addSchedule({ secretName: 'sec', intervalMs: 1_000, mode: 'manual' });
    const result = await scheduler.rotate('sec');

    expect(result).toBe(false);
    expect(manualSpy).toHaveBeenCalledWith('sec');

    scheduler.dispose();
  });

  it('returns false when schedule not found', async () => {
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);
    const result = await scheduler.rotate('nonexistent');
    expect(result).toBe(false);
    scheduler.dispose();
  });

  it('rotates: calls setSecret, revokeBySecret, recordRotation, emits rotated', async () => {
    const vault = makeVaultAdapter();
    vault.setSecret.mockResolvedValue(undefined);
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);

    const rotatedSpy = vi.fn();
    scheduler.on('rotated', rotatedSpy);

    scheduler.addSchedule({
      secretName: 'openclaw/tokens/auto-token',
      intervalMs: 5_000,
      mode: 'auto',
      rotator: async () => 'brand-new-value',
    });

    const result = await scheduler.rotate('openclaw/tokens/auto-token');

    expect(result).toBe(true);
    expect(vault.setSecret).toHaveBeenCalledWith('openclaw/tokens/auto-token', 'brand-new-value');
    expect(bridge.revokeBySecret).toHaveBeenCalledWith('openclaw/tokens/auto-token');
    expect(mockRecordRotation).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'openclaw/tokens/auto-token', value: 'brand-new-value' }),
    );
    expect(rotatedSpy).toHaveBeenCalledWith('openclaw/tokens/auto-token');
    expect(mockAppendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rotate', result: 'success' }),
    );

    scheduler.dispose();
  });

  it('emits rotation-failed and writes audit on error', async () => {
    const vault = makeVaultAdapter();
    vault.setSecret.mockRejectedValue(new Error('vault offline'));
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);

    const failedSpy = vi.fn();
    scheduler.on('rotation-failed', failedSpy);

    scheduler.addSchedule({
      secretName: 'openclaw/tokens/auto-token',
      intervalMs: 5_000,
      mode: 'auto',
      rotator: async () => 'value',
    });

    const result = await scheduler.rotate('openclaw/tokens/auto-token');

    expect(result).toBe(false);
    expect(failedSpy).toHaveBeenCalledWith('openclaw/tokens/auto-token', 'vault offline');
    expect(mockAppendAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'rotate', result: 'error' }),
    );

    scheduler.dispose();
  });
});

// ─── restoreFromDb ────────────────────────────────────────────────────────────

describe('restoreFromDb', () => {
  it('merges persisted rotation timestamps into in-memory schedules', async () => {
    // addSchedule fires void upsertScheduleState() which calls query once —
    // queue a dummy response for it so the real response goes to loadScheduleStates
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // consumed by upsertScheduleState in addSchedule
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          secret_name: 'openclaw/api-keys/github-pat',
          last_rotated_at: '2024-05-01T00:00:00Z',
          next_rotation_at: '2024-06-01T00:00:00Z',
        },
      ],
    } as any); // consumed by loadScheduleStates in restoreFromDb

    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);

    scheduler.addSchedule({ secretName: 'openclaw/api-keys/github-pat', intervalMs: 1_000, mode: 'manual' });
    // flush microtasks so upsertScheduleState consumes its mock before restoreFromDb runs
    await Promise.resolve();
    await scheduler.restoreFromDb();

    const schedules = scheduler.getSchedules();
    expect(schedules[0].lastRotatedAt).toBe('2024-05-01T00:00:00Z');
    expect(schedules[0].nextRotationAt).toBe('2024-06-01T00:00:00Z');

    scheduler.dispose();
  });

  it('handles DB errors gracefully (non-fatal)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);
    await expect(scheduler.restoreFromDb()).resolves.toBeUndefined();
    scheduler.dispose();
  });
});

// ─── dispose ──────────────────────────────────────────────────────────────────

describe('dispose', () => {
  it('clears all schedules and removes listeners', () => {
    const vault = makeVaultAdapter();
    const bridge = makeVaultBridge();
    const scheduler = new RotationScheduler(vault as any, bridge as any);

    scheduler.addSchedule({ secretName: 'sec', intervalMs: 1_000, mode: 'manual' });
    scheduler.dispose();

    expect(scheduler.getSchedules()).toHaveLength(0);
  });
});

// ─── getDefaultRotationConfigs ────────────────────────────────────────────────

describe('getDefaultRotationConfigs', () => {
  it('returns at least 5 default configs', () => {
    const configs = getDefaultRotationConfigs();
    expect(configs.length).toBeGreaterThanOrEqual(5);
  });

  it('all defaults have mode = manual', () => {
    const configs = getDefaultRotationConfigs();
    for (const c of configs) {
      expect(c.mode).toBe('manual');
    }
  });

  it('all defaults have 30-day or 7-day intervals', () => {
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const configs = getDefaultRotationConfigs();
    for (const c of configs) {
      expect([SEVEN_DAYS, THIRTY_DAYS]).toContain(c.intervalMs);
    }
  });
});
