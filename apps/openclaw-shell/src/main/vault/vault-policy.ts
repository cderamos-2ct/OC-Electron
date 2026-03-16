// Vault policy store — controls agent access to secrets
// Persisted to ~/.openclaw-shell/vault-policies.json
// Pattern follows approval-store.ts

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'node:crypto';
import { SHELL_CONFIG_DIR_NAME, VAULT_POLICIES_FILE_NAME, VAULT_DEFAULT_LEASE_TTL } from '../../shared/constants.js';
import type { VaultPolicy, VaultPolicyAction } from '../../shared/types.js';

const POLICIES_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, VAULT_POLICIES_FILE_NAME);

interface PersistedPolicies {
  policies: VaultPolicy[];
}

export class VaultPolicyStore {
  private policies: VaultPolicy[] = [];

  constructor() {
    this.load();
  }

  // ─── Persistence ────────────────────────────────────────────────

  private load(): void {
    if (!existsSync(POLICIES_FILE)) {
      this.policies = getDefaultPolicies();
      this.save();
      return;
    }
    try {
      const raw = readFileSync(POLICIES_FILE, 'utf-8');
      const data = JSON.parse(raw) as PersistedPolicies;
      this.policies = data.policies ?? [];
    } catch {
      this.policies = getDefaultPolicies();
      this.save();
    }
  }

  private save(): void {
    const dir = join(homedir(), SHELL_CONFIG_DIR_NAME);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data: PersistedPolicies = { policies: this.policies };
    writeFileSync(POLICIES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  // ─── Policy CRUD ────────────────────────────────────────────────

  addPolicy(
    agentId: string,
    secretPattern: string,
    action: VaultPolicyAction,
    maxLeaseTTL = VAULT_DEFAULT_LEASE_TTL,
  ): VaultPolicy {
    const policy: VaultPolicy = {
      id: randomUUID(),
      agentId,
      secretPattern,
      action,
      maxLeaseTTL,
      createdAt: new Date().toISOString(),
    };
    this.policies.push(policy);
    this.save();
    return policy;
  }

  updatePolicy(policyId: string, patch: Partial<Pick<VaultPolicy, 'action' | 'maxLeaseTTL' | 'secretPattern'>>): VaultPolicy | null {
    const policy = this.policies.find((p) => p.id === policyId);
    if (!policy) return null;
    Object.assign(policy, patch);
    this.save();
    return policy;
  }

  deletePolicy(policyId: string): boolean {
    const before = this.policies.length;
    this.policies = this.policies.filter((p) => p.id !== policyId);
    if (this.policies.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  listPolicies(): VaultPolicy[] {
    return [...this.policies];
  }

  // ─── Policy Evaluation ──────────────────────────────────────────

  evaluate(agentId: string, secretName: string): { action: VaultPolicyAction; policy: VaultPolicy | null; maxLeaseTTL: number } {
    // Production secrets always require approval regardless of other rules
    if (/prod|master|production/i.test(secretName)) {
      return { action: 'require-approval', policy: null, maxLeaseTTL: VAULT_DEFAULT_LEASE_TTL };
    }

    // Find most specific matching policy
    let bestMatch: VaultPolicy | null = null;
    let bestSpecificity = -1;

    for (const policy of this.policies) {
      if (policy.agentId !== agentId && policy.agentId !== '*') continue;
      if (!this.matchPattern(secretName, policy.secretPattern)) continue;

      // More specific agent + longer pattern = higher priority
      const specificity =
        (policy.agentId === agentId ? 100 : 0) + policy.secretPattern.length;
      if (specificity > bestSpecificity) {
        bestMatch = policy;
        bestSpecificity = specificity;
      }
    }

    if (bestMatch) {
      return {
        action: bestMatch.action,
        policy: bestMatch,
        maxLeaseTTL: bestMatch.maxLeaseTTL,
      };
    }

    // Default: require approval
    return { action: 'require-approval', policy: null, maxLeaseTTL: VAULT_DEFAULT_LEASE_TTL };
  }

  private matchPattern(secretName: string, pattern: string): boolean {
    // Simple glob matching: * matches any sequence of characters
    const regex = new RegExp(
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    return regex.test(secretName);
  }
}

// ─── Default Policies ──────────────────────────────────────────

function getDefaultPolicies(): VaultPolicy[] {
  const now = new Date().toISOString();
  const defaults: Array<{ agentId: string; pattern: string; action: VaultPolicyAction }> = [
    // Finance lane
    { agentId: 'finance', pattern: 'openclaw/api-keys/expensify*', action: 'auto-approve' },
    { agentId: 'finance', pattern: 'openclaw/oauth/gcp*', action: 'auto-approve' },
    { agentId: 'ada', pattern: 'openclaw/api-keys/expensify*', action: 'auto-approve' },
    { agentId: 'ada', pattern: 'openclaw/oauth/gcp*', action: 'auto-approve' },
    // Comms lane
    { agentId: 'hermes', pattern: 'openclaw/tokens/gmail*', action: 'auto-approve' },
    { agentId: 'hermes', pattern: 'openclaw/tokens/slack*', action: 'auto-approve' },
    { agentId: 'iris', pattern: 'openclaw/tokens/gmail*', action: 'auto-approve' },
    { agentId: 'iris', pattern: 'openclaw/tokens/slack*', action: 'auto-approve' },
    { agentId: 'karoline', pattern: 'openclaw/tokens/*', action: 'auto-approve' },
    // Build lane
    { agentId: 'build', pattern: 'openclaw/api-keys/github*', action: 'auto-approve' },
  ];

  return defaults.map((d) => ({
    id: randomUUID(),
    agentId: d.agentId,
    secretPattern: d.pattern,
    action: d.action,
    maxLeaseTTL: VAULT_DEFAULT_LEASE_TTL,
    createdAt: now,
  }));
}
