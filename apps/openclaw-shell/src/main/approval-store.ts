// Approval queue and auto-approve rule store for CD actions
// Persists rules to ~/.openclaw-shell/shell-permissions.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'node:crypto';
import { SHELL_CONFIG_DIR_NAME, SHELL_PERMISSIONS_FILE_NAME } from '../shared/constants.js';
import type {
  CDAction,
  CDActionType,
  AutoApproveRule,
  PendingApproval,
  ApprovalDecision,
} from '../shared/types.js';

const PERMISSIONS_FILE = join(homedir(), SHELL_CONFIG_DIR_NAME, SHELL_PERMISSIONS_FILE_NAME);

interface PersistedPermissions {
  rules: AutoApproveRule[];
}

export class ApprovalStore {
  private queue: Map<string, PendingApproval> = new Map();
  private rules: AutoApproveRule[] = [];

  constructor() {
    this.loadRules();
  }

  // ─── Rule Management ─────────────────────────────────────────────

  private loadRules(): void {
    if (!existsSync(PERMISSIONS_FILE)) {
      this.rules = [];
      return;
    }
    try {
      const raw = readFileSync(PERMISSIONS_FILE, 'utf-8');
      const data = JSON.parse(raw) as PersistedPermissions;
      this.rules = data.rules ?? [];
    } catch {
      this.rules = [];
    }
  }

  private saveRules(): void {
    const dir = join(homedir(), SHELL_CONFIG_DIR_NAME);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data: PersistedPermissions = { rules: this.rules };
    writeFileSync(PERMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }

  addRule(agentId: string, serviceId: string, actionType: CDActionType): AutoApproveRule {
    const rule: AutoApproveRule = {
      id: randomUUID(),
      agentId,
      serviceId,
      actionType,
      createdAt: new Date().toISOString(),
    };
    this.rules.push(rule);
    this.saveRules();
    return rule;
  }

  revokeRule(ruleId: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    if (this.rules.length !== before) {
      this.saveRules();
      return true;
    }
    return false;
  }

  getRules(): AutoApproveRule[] {
    return [...this.rules];
  }

  // ─── Auto-Approve Matching ───────────────────────────────────────

  findMatchingRule(action: CDAction): AutoApproveRule | null {
    return (
      this.rules.find(
        (r) =>
          r.agentId === action.agentId &&
          r.serviceId === action.serviceId &&
          r.actionType === action.type,
      ) ?? null
    );
  }

  // ─── Queue Management ────────────────────────────────────────────

  enqueue(action: CDAction): PendingApproval {
    const pending: PendingApproval = {
      action,
      status: 'pending',
    };
    this.queue.set(action.id, pending);
    return pending;
  }

  dequeue(actionId: string): PendingApproval | undefined {
    const item = this.queue.get(actionId);
    if (item) {
      this.queue.delete(actionId);
    }
    return item;
  }

  getPending(actionId: string): PendingApproval | undefined {
    return this.queue.get(actionId);
  }

  listPending(): PendingApproval[] {
    return Array.from(this.queue.values()).filter((p) => p.status === 'pending');
  }

  resolve(actionId: string, decision: 'approved' | 'denied'): PendingApproval | undefined {
    const item = this.queue.get(actionId);
    if (!item) return undefined;
    item.status = decision;
    this.queue.delete(actionId);
    return item;
  }

  /**
   * Check if an action should be auto-approved based on risk tier and rules.
   * - 'silent' tier (reads): always auto-approved
   * - 'confirm' / 'confirm-send': only if a matching rule exists
   */
  shouldAutoApprove(action: CDAction): { autoApprove: boolean; rule?: AutoApproveRule } {
    if (action.riskTier === 'silent') {
      return { autoApprove: true };
    }
    const rule = this.findMatchingRule(action);
    if (rule) {
      return { autoApprove: true, rule };
    }
    return { autoApprove: false };
  }
}
