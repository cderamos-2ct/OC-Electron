// Vault Bridge — orchestrates secret access with policy enforcement
// Follows the CDBridge pattern: request → evaluate → approve/deny → lease
// Postgres backing: vault_secrets (sync), audit_log (dual-write), vault_approvals (persisted queue)

import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'events';
import { createLogger } from '../logging/logger.js';
import { VaultAdapter } from './vault-adapter.js';

const log = createLogger('VaultBridge');
import { VaultPolicyStore } from './vault-policy.js';
import { LeaseCache } from './lease-cache.js';
import { appendVaultAuditEntry, readVaultAuditLog } from './vault-audit.js';
import {
  syncVaultSecretsFromBitwarden,
  getVaultSecret,
  countVaultSecrets,
  appendAuditLogEntry,
  createApprovalRecord,
  resolveApprovalRecord,
  listPendingApprovalRecords,
} from './vault-db-repo.js';
import { VAULT_SYNC_INTERVAL_MS } from '../../shared/constants.js';
import type {
  VaultLease,
  VaultPolicy,
  VaultAuditEntry,
  VaultStatus,
  VaultConnectionState,
  VaultSecretMeta,
  PendingVaultApproval,
} from '../../shared/types.js';

export class VaultBridge extends EventEmitter {
  private vault: VaultAdapter;
  private policyStore: VaultPolicyStore;
  private leaseCache: LeaseCache;
  private pendingApprovals = new Map<string, PendingVaultApproval & { resolve: (decision: 'approved' | 'denied') => void }>();
  private mainWindow: BrowserWindow | null = null;
  private syncHandle: ReturnType<typeof setInterval> | null = null;
  private _state: VaultConnectionState = 'disconnected';

  constructor(vault: VaultAdapter) {
    super();
    this.vault = vault;
    this.policyStore = new VaultPolicyStore();
    this.leaseCache = new LeaseCache();
  }

  get state(): VaultConnectionState {
    return this._state;
  }

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  async start(password: string, email?: string): Promise<void> {
    try {
      this._state = 'locked';
      this.notifyRenderer('vault:state', this._state);

      // The vault adapter handles login/unlock
      // The BwAdapter inside vault handles the bw CLI calls
      // For now we assume the vault is already configured and we just need to unlock
      this._state = 'unlocked';
      this.notifyRenderer('vault:state', this._state);

      // Restore persisted pending approvals from Postgres
      void this.restoreApprovalQueue().catch((err) => {
        log.warn('Failed to restore approval queue (non-fatal):', err);
      });

      // Sync Bitwarden secrets to Postgres on unlock
      void this.syncSecretsToDb().catch((err) => {
        log.warn('Initial DB sync failed (non-fatal):', err);
      });

      // Start periodic sync
      this.syncHandle = setInterval(() => {
        void this.vault.sync()
          .then(() => this.syncSecretsToDb())
          .catch((err) => {
            log.error('Sync error:', err);
          });
      }, VAULT_SYNC_INTERVAL_MS);
    } catch (err) {
      this._state = 'error';
      this.notifyRenderer('vault:state', this._state);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.syncHandle) {
      clearInterval(this.syncHandle);
      this.syncHandle = null;
    }
    this.leaseCache.dispose();
    this._state = 'disconnected';
    this.notifyRenderer('vault:state', this._state);
  }

  // ─── DB Sync ────────────────────────────────────────────────────

  private async syncSecretsToDb(): Promise<void> {
    try {
      const secrets = await this.vault.listSecrets();
      const entries: Array<{ name: string; value: string; description?: string }> = [];

      for (const meta of secrets) {
        const value = await this.vault.getSecret(meta.name);
        if (value !== null) {
          entries.push({
            name: meta.name,
            value,
            description: `Synced from Bitwarden — folder: ${meta.folder}`,
          });
        }
      }

      const { upserted, errors } = await syncVaultSecretsFromBitwarden(entries, 'vesta');
      if (errors.length > 0) {
        log.warn('DB sync partial errors:', errors);
      }
      log.info(`Synced ${upserted} secrets to Postgres`);
    } catch (err) {
      log.warn('syncSecretsToDb error:', err);
    }
  }

  // ─── Approval Queue Persistence ─────────────────────────────────

  private async restoreApprovalQueue(): Promise<void> {
    const rows = await listPendingApprovalRecords();
    for (const row of rows) {
      // Re-queue in memory so the renderer sees them after restart
      // The resolve callback is a no-op placeholder — real resolution comes via decideApproval()
      if (!this.pendingApprovals.has(row.id)) {
        this.pendingApprovals.set(row.id, {
          id: row.id,
          agentId: row.agent_id,
          secretName: row.secret_name,
          purpose: row.purpose,
          requestedAt: row.requested_at,
          resolve: async (decision) => {
            this.pendingApprovals.delete(row.id);
            await resolveApprovalRecord(row.id, decision);
          },
        });
        this.notifyRenderer('vault:approval-requested', {
          id: row.id,
          agentId: row.agent_id,
          secretName: row.secret_name,
          purpose: row.purpose,
          requestedAt: row.requested_at,
        });
      }
    }
    if (rows.length > 0) {
      log.info(`Restored ${rows.length} pending approvals from Postgres`);
    }
  }

  // ─── Secret Request Flow ────────────────────────────────────────

  async requestSecret(
    agentId: string,
    secretName: string,
    purpose: string,
  ): Promise<VaultLease | null> {
    // Check for existing active lease
    const existingLease = this.leaseCache.findActiveLeaseForAgent(secretName, agentId);
    if (existingLease) {
      this.logAudit(agentId, secretName, 'access', 'success', undefined, existingLease.id, purpose);
      return existingLease;
    }

    // Evaluate policy
    const { action, policy, maxLeaseTTL } = this.policyStore.evaluate(agentId, secretName);

    if (action === 'auto-approve') {
      return this.grantLease(agentId, secretName, purpose, maxLeaseTTL, policy?.id);
    }

    // Require manual approval
    return this.queueApproval(agentId, secretName, purpose, maxLeaseTTL, policy?.id);
  }

  private async grantLease(
    agentId: string,
    secretName: string,
    purpose: string,
    ttl: number,
    policyId?: string,
  ): Promise<VaultLease | null> {
    try {
      // Primary: try Bitwarden via VaultAdapter
      let value: string | null = null;
      try {
        value = await this.vault.getSecret(secretName);
      } catch {
        // Bitwarden unavailable — fall through to Postgres
      }

      // Fallback: read from Postgres vault_secrets
      if (value === null) {
        const row = await getVaultSecret(secretName);
        if (row && row.value !== 'PLACEHOLDER') {
          value = row.value;
          log.info(`Using Postgres fallback for secret: ${secretName}`);
        }
      }

      if (value === null) {
        this.logAudit(agentId, secretName, 'access', 'error', policyId, undefined, purpose, `Secret not found: ${secretName}`);
        return null;
      }

      const lease = this.leaseCache.createLease(
        secretName,
        secretName,
        value,
        agentId,
        purpose,
        ttl,
      );

      this.logAudit(agentId, secretName, 'access', 'success', policyId, lease.id, purpose);
      return lease;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logAudit(agentId, secretName, 'access', 'error', policyId, undefined, purpose, error);
      return null;
    }
  }

  private async queueApproval(
    agentId: string,
    secretName: string,
    purpose: string,
    ttl: number,
    policyId?: string,
  ): Promise<VaultLease | null> {
    const approvalId = randomUUID();
    const requestedAt = new Date().toISOString();

    // Persist approval to Postgres so it survives restarts
    void createApprovalRecord({ id: approvalId, agentId, secretName, purpose }).catch((err) => {
      log.warn('Failed to persist approval record:', err);
    });

    return new Promise<VaultLease | null>((resolve) => {
      const pending = {
        id: approvalId,
        agentId,
        secretName,
        purpose,
        requestedAt,
        resolve: async (decision: 'approved' | 'denied') => {
          this.pendingApprovals.delete(approvalId);

          // Update Postgres approval record
          void resolveApprovalRecord(approvalId, decision).catch((err) => {
            log.warn('Failed to resolve approval record in Postgres:', err);
          });

          if (decision === 'approved') {
            const lease = await this.grantLease(agentId, secretName, purpose, ttl, policyId);
            resolve(lease);
          } else {
            this.logAudit(agentId, secretName, 'denied', 'denied', policyId, undefined, purpose);
            resolve(null);
          }

          this.notifyRenderer('vault:approval-resolved', { approvalId, decision });
        },
      };

      this.pendingApprovals.set(approvalId, pending);
      this.notifyRenderer('vault:approval-requested', {
        id: approvalId,
        agentId,
        secretName,
        purpose,
        requestedAt,
      });
    });
  }

  // ─── Approval Decisions ─────────────────────────────────────────

  async decideApproval(approvalId: string, decision: 'approved' | 'denied'): Promise<boolean> {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) return false;
    await pending.resolve(decision);
    return true;
  }

  // ─── Lease Management ───────────────────────────────────────────

  revokeLease(leaseId: string): boolean {
    const lease = this.leaseCache.getLease(leaseId);
    if (lease) {
      this.logAudit(lease.leasedBy, lease.secretName, 'revoke', 'success', undefined, leaseId);
      this.notifyRenderer('vault:lease-revoked', { leaseId, secretName: lease.secretName });
    }
    return this.leaseCache.revokeLease(leaseId);
  }

  revokeAll(): number {
    const leases = this.leaseCache.getActiveLeases();
    for (const lease of leases) {
      this.logAudit(lease.leasedBy, lease.secretName, 'revoke', 'success', undefined, lease.id);
    }
    return this.leaseCache.revokeAll();
  }

  revokeBySecret(secretName: string): number {
    return this.leaseCache.revokeBySecret(secretName);
  }

  // ─── Status & Queries ──────────────────────────────────────────

  async getStatus(): Promise<VaultStatus> {
    let secretCount = 0;

    if (this._state === 'unlocked') {
      try {
        secretCount = await this.vault.getSecretCount();
      } catch {
        // Bitwarden unavailable — fall back to Postgres count
        secretCount = await countVaultSecrets().catch(() => 0);
      }
    } else {
      // When locked, report count from Postgres (metadata only, no values exposed)
      secretCount = await countVaultSecrets().catch(() => 0);
    }

    return {
      state: this._state,
      serverUrl: 'http://127.0.0.1:8222',
      secretCount,
      activeLeases: this.leaseCache.getActiveCount(),
      pendingApprovals: this.pendingApprovals.size,
      lastSyncAt: null,
    };
  }

  async listSecrets(): Promise<VaultSecretMeta[]> {
    if (this._state !== 'unlocked') return [];
    const secrets = await this.vault.listSecrets();
    return secrets.map((s) => ({
      ...s,
      hasActiveLease: this.leaseCache.hasActiveLease(s.name),
    }));
  }

  listPolicies(): VaultPolicy[] {
    return this.policyStore.listPolicies();
  }

  updatePolicy(policy: VaultPolicy): VaultPolicy | null {
    const existing = this.policyStore.listPolicies().find((p) => p.id === policy.id);
    if (existing) {
      return this.policyStore.updatePolicy(policy.id, {
        action: policy.action,
        maxLeaseTTL: policy.maxLeaseTTL,
        secretPattern: policy.secretPattern,
      });
    }
    return this.policyStore.addPolicy(
      policy.agentId,
      policy.secretPattern,
      policy.action,
      policy.maxLeaseTTL,
    );
  }

  deletePolicy(policyId: string): boolean {
    return this.policyStore.deletePolicy(policyId);
  }

  getAuditLog(limit?: number): VaultAuditEntry[] {
    return readVaultAuditLog(limit);
  }

  listPendingApprovals(): PendingVaultApproval[] {
    return Array.from(this.pendingApprovals.values()).map(({ resolve, ...rest }) => rest);
  }

  // ─── Audit Logging (dual-write: file + Postgres) ─────────────────

  private logAudit(
    agentId: string,
    secretName: string,
    action: VaultAuditEntry['action'],
    result: VaultAuditEntry['result'],
    policyId?: string,
    leaseId?: string,
    purpose?: string,
    error?: string,
  ): void {
    const entry = {
      timestamp: new Date().toISOString(),
      agentId,
      secretName,
      action,
      result,
      policyId,
      leaseId,
      error,
      purpose,
    };

    // Primary: file-based audit (synchronous, reliable)
    appendVaultAuditEntry(entry);

    // Secondary: Postgres audit_log (async, non-fatal)
    void appendAuditLogEntry({
      agentId,
      action,
      secretName,
      result,
      policyId,
      leaseId,
      purpose,
      error,
    }).catch((err) => {
      log.warn('Postgres audit write failed (non-fatal):', err);
    });
  }

  // ─── Renderer Communication ─────────────────────────────────────

  private notifyRenderer(channel: string, data: unknown): void {
    this.mainWindow?.webContents.send(channel, data);
  }
}
