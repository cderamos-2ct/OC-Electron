// Vault Bridge — orchestrates secret access with policy enforcement
// Follows the CDBridge pattern: request → evaluate → approve/deny → lease
// Postgres-native: vault_secrets is the source of truth, no external sync

import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'events';
import { createLogger } from '../logging/logger.js';
import type { PostgresVaultAdapter } from './postgres-vault-adapter.js';

const log = createLogger('VaultBridge');
import { VaultPolicyStore } from './vault-policy.js';
import { LeaseCache } from './lease-cache.js';
import { appendVaultAuditEntry, readVaultAuditLog } from './vault-audit.js';
import {
  countVaultSecrets,
  appendAuditLogEntry,
  createApprovalRecord,
  resolveApprovalRecord,
  listPendingApprovalRecords,
} from './vault-db-repo.js';
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
  private vault: PostgresVaultAdapter;
  private policyStore: VaultPolicyStore;
  private leaseCache: LeaseCache;
  private pendingApprovals = new Map<string, PendingVaultApproval & { resolve: (decision: 'approved' | 'denied') => void }>();
  private mainWindow: BrowserWindow | null = null;
  private _state: VaultConnectionState = 'disconnected';

  constructor(vault: PostgresVaultAdapter) {
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

  async start(): Promise<void> {
    try {
      this._state = 'locked';
      this.notifyRenderer('vault:state', this._state);

      // Postgres-native: master key is already loaded, adapter is ready
      this._state = 'unlocked';
      this.notifyRenderer('vault:state', this._state);

      // Restore persisted pending approvals from Postgres
      void this.restoreApprovalQueue().catch((err) => {
        log.warn('Failed to restore approval queue (non-fatal):', err);
      });

      log.info('Vault bridge started (Postgres-native mode)');
    } catch (err) {
      this._state = 'error';
      this.notifyRenderer('vault:state', this._state);
      throw err;
    }
  }

  async stop(): Promise<void> {
    this.leaseCache.dispose();
    this._state = 'disconnected';
    this.notifyRenderer('vault:state', this._state);
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
      // Read directly from Postgres (the source of truth)
      const value = await this.vault.getSecret(secretName);

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

    try {
      secretCount = await this.vault.getSecretCount();
    } catch {
      secretCount = await countVaultSecrets().catch(() => 0);
    }

    return {
      state: this._state,
      serverUrl: 'postgres://local',
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
