// In-memory lease cache with TTL for vault secret access
// Leases are never persisted — they exist only in the running process

import { randomUUID } from 'node:crypto';
import { VAULT_DEFAULT_LEASE_TTL } from '../../shared/constants.js';
import type { VaultLease } from '../../shared/types.js';

export class LeaseCache {
  private leases = new Map<string, VaultLease>();
  private cleanupHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Cleanup expired leases every 30 seconds
    this.cleanupHandle = setInterval(() => this.cleanup(), 30_000);
  }

  createLease(
    secretId: string,
    secretName: string,
    value: string,
    agentId: string,
    purpose: string,
    ttlSeconds = VAULT_DEFAULT_LEASE_TTL,
  ): VaultLease {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const lease: VaultLease = {
      id: randomUUID(),
      secretId,
      secretName,
      value,
      leasedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      leasedBy: agentId,
      purpose,
    };

    this.leases.set(lease.id, lease);
    return lease;
  }

  getLease(leaseId: string): VaultLease | null {
    const lease = this.leases.get(leaseId);
    if (!lease) return null;
    if (new Date(lease.expiresAt) < new Date()) {
      this.leases.delete(leaseId);
      return null;
    }
    return lease;
  }

  findActiveLeaseForAgent(secretName: string, agentId: string): VaultLease | null {
    const now = new Date();
    for (const lease of this.leases.values()) {
      if (
        lease.secretName === secretName &&
        lease.leasedBy === agentId &&
        new Date(lease.expiresAt) > now
      ) {
        return lease;
      }
    }
    return null;
  }

  revokeBySecret(secretName: string): number {
    let count = 0;
    for (const [id, lease] of this.leases) {
      if (lease.secretName === secretName) {
        this.leases.delete(id);
        count++;
      }
    }
    return count;
  }

  revokeLease(leaseId: string): boolean {
    return this.leases.delete(leaseId);
  }

  revokeAll(): number {
    const count = this.leases.size;
    this.leases.clear();
    return count;
  }

  getActiveLeases(): VaultLease[] {
    const now = new Date();
    const active: VaultLease[] = [];
    for (const [id, lease] of this.leases) {
      if (new Date(lease.expiresAt) > now) {
        active.push(lease);
      } else {
        this.leases.delete(id);
      }
    }
    return active;
  }

  getActiveCount(): number {
    return this.getActiveLeases().length;
  }

  hasActiveLease(secretName: string): boolean {
    const now = new Date();
    for (const lease of this.leases.values()) {
      if (lease.secretName === secretName && new Date(lease.expiresAt) > now) {
        return true;
      }
    }
    return false;
  }

  private cleanup(): void {
    const now = new Date();
    for (const [id, lease] of this.leases) {
      if (new Date(lease.expiresAt) < now) {
        this.leases.delete(id);
      }
    }
  }

  dispose(): void {
    if (this.cleanupHandle) {
      clearInterval(this.cleanupHandle);
      this.cleanupHandle = null;
    }
    this.leases.clear();
  }
}
