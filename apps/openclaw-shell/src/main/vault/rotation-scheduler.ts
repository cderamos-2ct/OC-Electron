// Secret rotation scheduler — periodically rotates secrets that support auto-rotation
// Notifies workers via CredentialProvider.onRotated() callbacks for hot-reload
// Schedule state is persisted to Postgres (rotation_schedules table) for restart recovery

import { EventEmitter } from 'events';
import { query } from 'openclaw-db';
import type { PostgresVaultAdapter } from './postgres-vault-adapter.js';
import type { VaultBridge } from './vault-bridge.js';
import { appendVaultAuditEntry } from './vault-audit.js';
import { recordRotation } from './vault-db-repo.js';

export type RotationMode = 'auto' | 'manual';

export interface RotationConfig {
  secretName: string;
  intervalMs: number;
  mode: RotationMode;
  rotator?: () => Promise<string>; // generates new value; if absent, mode must be 'manual'
}

interface ScheduledRotation {
  config: RotationConfig;
  handle: ReturnType<typeof setInterval> | null;
  lastRotatedAt: string | null;
  nextRotationAt: string | null;
}

// ─── Rotation Schedules Persistence ─────────────────────────────
// rotation_schedules table is created by migration 004_vault_runtime_tables.sql

async function upsertScheduleState(entry: {
  secretName: string;
  mode: RotationMode;
  intervalMs: number;
  lastRotatedAt: string | null;
  nextRotationAt: string | null;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO rotation_schedules (secret_name, mode, interval_ms, last_rotated_at, next_rotation_at)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)
       ON CONFLICT (secret_name) DO UPDATE SET
         mode             = EXCLUDED.mode,
         interval_ms      = EXCLUDED.interval_ms,
         last_rotated_at  = EXCLUDED.last_rotated_at,
         next_rotation_at = EXCLUDED.next_rotation_at,
         updated_at       = NOW()`,
      [
        entry.secretName,
        entry.mode,
        entry.intervalMs,
        entry.lastRotatedAt,
        entry.nextRotationAt,
      ],
    );
  } catch {
    // Non-fatal — in-memory state is authoritative for running schedules
  }
}

async function loadScheduleStates(): Promise<Map<string, { lastRotatedAt: string | null; nextRotationAt: string | null }>> {
  const map = new Map<string, { lastRotatedAt: string | null; nextRotationAt: string | null }>();
  try {
    const result = await query<{
      secret_name: string;
      last_rotated_at: string | null;
      next_rotation_at: string | null;
    }>('SELECT secret_name, last_rotated_at, next_rotation_at FROM rotation_schedules');
    for (const row of result.rows) {
      map.set(row.secret_name, {
        lastRotatedAt: row.last_rotated_at,
        nextRotationAt: row.next_rotation_at,
      });
    }
  } catch {
    // Non-fatal — start fresh
  }
  return map;
}

// ─── RotationScheduler ───────────────────────────────────────────

export class RotationScheduler extends EventEmitter {
  private vault: PostgresVaultAdapter;
  private bridge: VaultBridge;
  private schedules = new Map<string, ScheduledRotation>();

  constructor(vault: PostgresVaultAdapter, bridge: VaultBridge) {
    super();
    this.vault = vault;
    this.bridge = bridge;
  }

  // ─── Initialization ─────────────────────────────────────────────

  async initialize(): Promise<void> {
    // Persisted states are loaded when addSchedule() is called — each schedule
    // restores lastRotatedAt/nextRotationAt from Postgres on first add.
  }

  // ─── Schedule Management ─────────────────────────────────────────

  addSchedule(config: RotationConfig): void {
    this.removeSchedule(config.secretName);

    const entry: ScheduledRotation = {
      config,
      handle: null,
      lastRotatedAt: null,
      nextRotationAt: null,
    };

    if (config.mode === 'auto' && config.rotator) {
      const nextAt = new Date(Date.now() + config.intervalMs);
      entry.nextRotationAt = nextAt.toISOString();
      entry.handle = setInterval(() => {
        void this.rotate(config.secretName);
      }, config.intervalMs);
    }

    this.schedules.set(config.secretName, entry);

    // Persist schedule registration
    void upsertScheduleState({
      secretName: config.secretName,
      mode: config.mode,
      intervalMs: config.intervalMs,
      lastRotatedAt: entry.lastRotatedAt,
      nextRotationAt: entry.nextRotationAt,
    });

    console.log(`[RotationScheduler] Scheduled: ${config.secretName} (${config.mode}, ${config.intervalMs}ms)`);
  }

  /** Load persisted rotation history from Postgres and merge into in-memory schedules */
  async restoreFromDb(): Promise<void> {
    const states = await loadScheduleStates();
    for (const [secretName, state] of states) {
      const entry = this.schedules.get(secretName);
      if (entry) {
        entry.lastRotatedAt = state.lastRotatedAt;
        entry.nextRotationAt = state.nextRotationAt;
      }
    }
    if (states.size > 0) {
      console.log(`[RotationScheduler] Restored rotation state for ${states.size} schedules from Postgres`);
    }
  }

  removeSchedule(secretName: string): void {
    const entry = this.schedules.get(secretName);
    if (entry?.handle) {
      clearInterval(entry.handle);
    }
    this.schedules.delete(secretName);
  }

  // ─── Rotation Execution ──────────────────────────────────────────

  async rotate(secretName: string): Promise<boolean> {
    const entry = this.schedules.get(secretName);
    if (!entry) {
      console.warn(`[RotationScheduler] No schedule found for: ${secretName}`);
      return false;
    }

    if (!entry.config.rotator) {
      console.warn(`[RotationScheduler] No rotator for ${secretName} — manual rotation required.`);
      this.emit('manual-rotation-needed', secretName);
      return false;
    }

    try {
      console.log(`[RotationScheduler] Rotating: ${secretName}`);

      // Generate new value
      const newValue = await entry.config.rotator();

      // Update vault
      await this.vault.setSecret(secretName, newValue);

      // Revoke existing leases for this secret
      const revokedCount = this.bridge.revokeBySecret(secretName);

      // Persist rotation to Postgres (vault_secrets.rotated_at + new value)
      const rotatedAt = new Date().toISOString();
      await recordRotation({ name: secretName, value: newValue, rotatedAt }).catch((err) => {
        console.warn(`[RotationScheduler] DB record failed for ${secretName}:`, err);
      });

      // Update schedule tracking
      entry.lastRotatedAt = rotatedAt;
      entry.nextRotationAt = new Date(Date.now() + entry.config.intervalMs).toISOString();

      // Persist schedule state to Postgres
      void upsertScheduleState({
        secretName,
        mode: entry.config.mode,
        intervalMs: entry.config.intervalMs,
        lastRotatedAt: entry.lastRotatedAt,
        nextRotationAt: entry.nextRotationAt,
      });

      // Audit log
      appendVaultAuditEntry({
        timestamp: new Date().toISOString(),
        agentId: 'rotation-scheduler',
        secretName,
        action: 'rotate',
        result: 'success',
        purpose: `Auto-rotation. Revoked ${revokedCount} leases.`,
      });

      // Notify listeners (credential providers subscribe to this)
      this.emit('rotated', secretName);

      console.log(`[RotationScheduler] Rotated: ${secretName} (revoked ${revokedCount} leases)`);
      return true;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[RotationScheduler] Failed to rotate ${secretName}:`, error);

      appendVaultAuditEntry({
        timestamp: new Date().toISOString(),
        agentId: 'rotation-scheduler',
        secretName,
        action: 'rotate',
        result: 'error',
        error,
      });

      this.emit('rotation-failed', secretName, error);
      return false;
    }
  }

  // ─── Status ──────────────────────────────────────────────────────

  getSchedules(): Array<{
    secretName: string;
    mode: RotationMode;
    intervalMs: number;
    lastRotatedAt: string | null;
    nextRotationAt: string | null;
  }> {
    return Array.from(this.schedules.values()).map((entry) => ({
      secretName: entry.config.secretName,
      mode: entry.config.mode,
      intervalMs: entry.config.intervalMs,
      lastRotatedAt: entry.lastRotatedAt,
      nextRotationAt: entry.nextRotationAt,
    }));
  }

  // ─── Lifecycle ───────────────────────────────────────────────────

  dispose(): void {
    for (const [, entry] of this.schedules) {
      if (entry.handle) {
        clearInterval(entry.handle);
      }
    }
    this.schedules.clear();
    this.removeAllListeners();
  }
}

// ─── Default Rotation Configs ────────────────────────────────────

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function getDefaultRotationConfigs(): RotationConfig[] {
  return [
    {
      secretName: 'openclaw/api-keys/github-pat',
      intervalMs: THIRTY_DAYS_MS,
      mode: 'manual',
    },
    {
      secretName: 'openclaw/tokens/gateway',
      intervalMs: THIRTY_DAYS_MS,
      mode: 'manual',
    },
    {
      secretName: 'openclaw/api-keys/anthropic',
      intervalMs: THIRTY_DAYS_MS,
      mode: 'manual',
    },
    {
      secretName: 'openclaw/api-keys/openai',
      intervalMs: THIRTY_DAYS_MS,
      mode: 'manual',
    },
    {
      secretName: 'openclaw/api-keys/google',
      intervalMs: THIRTY_DAYS_MS,
      mode: 'manual',
    },
    {
      secretName: 'openclaw/api-keys/fireflies',
      intervalMs: THIRTY_DAYS_MS,
      mode: 'manual',
    },
    {
      secretName: 'openclaw/api-keys/expensify',
      intervalMs: THIRTY_DAYS_MS,
      mode: 'manual',
    },
    {
      secretName: 'openclaw/device-auth/tokens',
      intervalMs: SEVEN_DAYS_MS,
      mode: 'manual',
    },
  ];
}
