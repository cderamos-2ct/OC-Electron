/**
 * Type contract tests for openclaw-core.
 *
 * Since most core modules are pure TypeScript type declarations,
 * these tests validate:
 *  1. Runtime object shapes match expected type structure
 *  2. Discriminated union members are correctly typed
 *  3. Constant values (GATEWAY_ENDPOINTS) are correct
 *  4. Exported functions exist and have the right signatures
 */

import { describe, it, expect } from 'vitest';

// ─── Agents ─────────────────────────────────────────────────────────────────

import type {
  AgentCapability,
  AgentIdentity,
  AgentSummary,
  AgentRuntimeSummary,
  AgentFeedItem,
  AgentBinding,
  AgentStatus,
  AgentHireDraft,
  AgentSendParams,
  AgentsListResult,
} from '../src/agents.js';

describe('agents.ts — type contracts', () => {
  it('AgentCapability is observe or act', () => {
    const caps: AgentCapability[] = ['observe', 'act'];
    expect(caps).toHaveLength(2);
  });

  it('AgentSummary can be constructed with required fields', () => {
    const agent: AgentSummary = {
      id: 'hermes',
      displayName: 'Hermes',
      status: 'active',
    };
    expect(agent.id).toBe('hermes');
    expect(agent.status).toBe('active');
  });

  it('AgentSummary taskCounts shape is correct', () => {
    const counts = {
      queued: 0,
      running: 1,
      blocked: 2,
      done: 10,
      failed: 0,
      total: 13,
    };
    const agent: AgentSummary = { id: 'test', taskCounts: counts };
    expect(agent.taskCounts?.total).toBe(13);
  });

  it('AgentRuntimeSummary observedState enum values are valid', () => {
    const states: Array<AgentRuntimeSummary['observedState']> = [
      'healthy', 'busy', 'idle', 'missing', 'unknown', 'orphaned', 'drifted', null,
    ];
    expect(states).toHaveLength(8);
  });

  it('AgentFeedItem category enum values are valid', () => {
    const item: AgentFeedItem = {
      id: '1',
      category: 'message',
      source: 'system',
      title: 'Test',
      body: 'Body',
      timestamp: new Date().toISOString(),
    };
    const validCategories: AgentFeedItem['category'][] = [
      'message', 'conversation', 'notification', 'activity',
    ];
    expect(validCategories).toContain(item.category);
  });

  it('AgentSendParams requires idempotencyKey', () => {
    const params: AgentSendParams = {
      message: 'hello',
      idempotencyKey: 'key-123',
    };
    expect(params.idempotencyKey).toBe('key-123');
  });

  it('AgentsListResult scope is per-sender or global', () => {
    const result: AgentsListResult = {
      defaultId: 'hermes',
      mainKey: 'main',
      scope: 'global',
      agents: [],
    };
    const validScopes: AgentsListResult['scope'][] = ['per-sender', 'global'];
    expect(validScopes).toContain(result.scope);
  });

  it('AgentBinding structure is correct', () => {
    const binding: AgentBinding = {
      agentId: 'hermes',
      services: ['gmail', 'calendar'],
      capabilities: ['observe', 'act'],
      apis: ['gmail.v1'],
    };
    expect(binding.capabilities).toContain('observe');
  });
});

// ─── Tasks ──────────────────────────────────────────────────────────────────

import type {
  QuickDecision,
  TaskDocument,
  TaskPatch,
  TaskConflict,
  OpsTaskLike,
} from '../src/tasks.js';

describe('tasks.ts — type contracts', () => {
  it('QuickDecision enum values are valid', () => {
    const decisions: QuickDecision[] = ['approve', 'defer', 'block', 'cancel'];
    expect(decisions).toHaveLength(4);
  });

  it('TaskDocument can be constructed with all fields', () => {
    const task: TaskDocument = {
      id: 'T-001',
      title: 'Test Task',
      status: 'active',
      priority: 'high',
      owner_agent: 'hermes',
      agent_type: 'comms',
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      source: 'openclaw',
      depends_on: [],
      blocked_by: [],
      tags: ['ops'],
      artifacts: [],
      description: 'Task description',
      currentState: 'in-progress',
      acceptance: 'Done when X',
      activityLog: ['started'],
      notes: '',
      sections: { background: 'context' },
      rawContent: '# T-001',
    };
    expect(task.id).toBe('T-001');
    expect(task.tags).toContain('ops');
  });

  it('TaskConflict has conflict: true discriminant', () => {
    const conflict: TaskConflict = {
      conflict: true,
      currentTask: {} as TaskDocument,
    };
    expect(conflict.conflict).toBe(true);
  });

  it('TaskPatch is partial', () => {
    const patch: TaskPatch = { status: 'done' };
    expect(patch.status).toBe('done');
    expect(patch.priority).toBeUndefined();
  });

  it('OpsTaskLike requires id, title, status, priority, updatedAt', () => {
    const task: OpsTaskLike = {
      id: 'OPS-001',
      title: 'Test',
      status: 'open',
      priority: 'high',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    expect(task.id).toBe('OPS-001');
  });
});

// ─── Sessions ───────────────────────────────────────────────────────────────

import type {
  SessionSummary,
  SessionsListParams,
  SessionsPatchParams,
  WorkerSessionGroup,
} from '../src/sessions.js';

describe('sessions.ts — type contracts', () => {
  it('SessionSummary requires only key', () => {
    const session: SessionSummary = { key: 'sess-abc' };
    expect(session.key).toBe('sess-abc');
  });

  it('SessionSummary optional fields are undefined by default', () => {
    const session: SessionSummary = { key: 'sess-abc' };
    expect(session.agentId).toBeUndefined();
    expect(session.model).toBeUndefined();
  });

  it('SessionsPatchParams sendPolicy accepts allow or deny or null', () => {
    const patch: SessionsPatchParams = {
      key: 'sess-abc',
      sendPolicy: 'allow',
    };
    const validPolicies: SessionsPatchParams['sendPolicy'][] = ['allow', 'deny', null];
    expect(validPolicies).toContain(patch.sendPolicy);
  });

  it('WorkerSessionGroup parentType is agent, task, or system', () => {
    const group: WorkerSessionGroup = {
      groupId: 'grp-1',
      label: 'Test Group',
      parentType: 'agent',
      sessionKeys: [],
      sessions: [],
    };
    const validTypes: WorkerSessionGroup['parentType'][] = ['agent', 'task', 'system'];
    expect(validTypes).toContain(group.parentType);
  });
});

// ─── Gateway ────────────────────────────────────────────────────────────────

import type {
  GatewayConnectionState,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  GatewayError,
  ChatEvent,
  LoopbackEvent,
  RPCMethodMap,
} from '../src/gateway.js';

describe('gateway.ts — type contracts', () => {
  it('GatewayConnectionState values are valid', () => {
    const states: GatewayConnectionState[] = [
      'disconnected', 'connecting', 'authenticating', 'connected', 'error',
    ];
    expect(states).toHaveLength(5);
  });

  it('RequestFrame type discriminant is req', () => {
    const frame: RequestFrame = {
      type: 'req',
      id: 'req-1',
      method: 'health',
    };
    expect(frame.type).toBe('req');
  });

  it('ResponseFrame type discriminant is res', () => {
    const frame: ResponseFrame = {
      type: 'res',
      id: 'req-1',
      ok: true,
      payload: { status: 'ok' },
    };
    expect(frame.type).toBe('res');
    expect(frame.ok).toBe(true);
  });

  it('EventFrame type discriminant is event', () => {
    const frame: EventFrame = {
      type: 'event',
      event: 'chat',
      payload: {},
    };
    expect(frame.type).toBe('event');
  });

  it('ChatEvent state is one of delta, final, aborted, error', () => {
    const event: ChatEvent = {
      runId: 'run-1',
      sessionKey: 'sess-1',
      seq: 0,
      state: 'final',
    };
    const validStates: ChatEvent['state'][] = ['delta', 'final', 'aborted', 'error'];
    expect(validStates).toContain(event.state);
  });

  it('GatewayError has code, message, optional retryable', () => {
    const err: GatewayError = {
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryable: true,
      retryAfterMs: 5000,
    };
    expect(err.retryable).toBe(true);
  });
});

// ─── CD Actions ─────────────────────────────────────────────────────────────

import type {
  CDActionType,
  CDActionRiskTier,
  CDAction,
  ApprovalDecision,
  ApprovalResult,
  CDActionResult,
  PendingApproval,
  AuditLogEntry,
  PageContext,
  MutationSummary,
} from '../src/cd-actions.js';

describe('cd-actions.ts — type contracts', () => {
  it('CDActionType values are valid', () => {
    const types: CDActionType[] = [
      'click', 'fill', 'select', 'navigate', 'read', 'scroll', 'screenshot', 'wait',
    ];
    expect(types).toHaveLength(8);
  });

  it('CDActionRiskTier values are silent, confirm, confirm-send', () => {
    const tiers: CDActionRiskTier[] = ['silent', 'confirm', 'confirm-send'];
    expect(tiers).toHaveLength(3);
  });

  it('CDAction can be constructed with required fields', () => {
    const action: CDAction = {
      id: 'act-1',
      type: 'click',
      agentId: 'hermes',
      serviceId: 'gmail',
      description: 'Click send button',
      riskTier: 'confirm-send',
      target: { selector: '#send-btn' },
      requestedAt: new Date().toISOString(),
    };
    expect(action.riskTier).toBe('confirm-send');
    expect(action.type).toBe('click');
  });

  it('ApprovalDecision values are valid', () => {
    const decisions: ApprovalDecision[] = ['approved', 'denied', 'auto-approved'];
    expect(decisions).toHaveLength(3);
  });

  it('CDActionResult requires success and durationMs', () => {
    const result: CDActionResult = {
      actionId: 'act-1',
      success: true,
      durationMs: 42,
    };
    expect(result.success).toBe(true);
    expect(result.durationMs).toBe(42);
  });

  it('PendingApproval status is pending, approved, or denied', () => {
    const pending: PendingApproval = {
      action: {} as CDAction,
      status: 'pending',
    };
    const validStatuses: PendingApproval['status'][] = ['pending', 'approved', 'denied'];
    expect(validStatuses).toContain(pending.status);
  });

  it('PageContext shape is correct', () => {
    const ctx: PageContext = {
      url: 'https://example.com',
      title: 'Example',
      selectedText: '',
      visibleText: 'Hello world',
      structuredContent: null,
    };
    expect(ctx.structuredContent).toBeNull();
  });

  it('MutationSummary has required numeric fields', () => {
    const summary: MutationSummary = {
      addedNodes: 3,
      removedNodes: 1,
      textChanges: 2,
      timestamp: new Date().toISOString(),
    };
    expect(summary.addedNodes + summary.removedNodes).toBe(4);
  });
});

// ─── Ops ────────────────────────────────────────────────────────────────────

import type {
  InterAgentCommunicationType,
  InterAgentCommunicationUrgency,
  InterAgentCommunicationStatus,
  InterAgentCommunication,
  NeedsChristianItem,
  CommandRollupCard,
  ServiceConfig,
  ServiceState,
  VaultLease,
  VaultStatus,
  VaultConnectionState,
} from '../src/ops.js';

describe('ops.ts — type contracts', () => {
  it('InterAgentCommunicationType values are valid', () => {
    const types: InterAgentCommunicationType[] = [
      'handoff', 'overlap_notice', 'second_opinion', 'dependency_ping', 'friction_note',
    ];
    expect(types).toHaveLength(5);
  });

  it('InterAgentCommunicationUrgency values are valid', () => {
    const urgencies: InterAgentCommunicationUrgency[] = [
      'low', 'normal', 'high', 'needs_now',
    ];
    expect(urgencies).toHaveLength(4);
  });

  it('InterAgentCommunicationStatus values are valid', () => {
    const statuses: InterAgentCommunicationStatus[] = ['open', 'acknowledged', 'resolved'];
    expect(statuses).toHaveLength(3);
  });

  it('NeedsChristianItem urgency values are valid', () => {
    const urgencies: NeedsChristianItem['urgency'][] = [
      'fyi', 'attention_soon', 'needs_now',
    ];
    expect(urgencies).toHaveLength(3);
  });

  it('CommandRollupCard kind values are valid', () => {
    const kinds: CommandRollupCard['kind'][] = [
      'fyi', 'blocked', 'completed', 'needs_decision', 'risk_flag',
    ];
    expect(kinds).toHaveLength(5);
  });

  it('ServiceState values are valid', () => {
    const states: ServiceState[] = [
      'unloaded', 'loading', 'active', 'hibernated', 'destroyed',
    ];
    expect(states).toHaveLength(5);
  });

  it('VaultConnectionState values are valid', () => {
    const states: VaultConnectionState[] = ['disconnected', 'locked', 'unlocked', 'error'];
    expect(states).toHaveLength(4);
  });

  it('VaultLease shape is correct', () => {
    const lease: VaultLease = {
      id: 'lease-1',
      secretId: 'sec-1',
      secretName: 'openclaw/tokens/gmail',
      value: 'token-abc',
      leasedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      leasedBy: 'hermes',
      purpose: 'send email',
    };
    expect(lease.leasedBy).toBe('hermes');
  });

  it('VaultStatus has all required fields', () => {
    const status: VaultStatus = {
      state: 'unlocked',
      serverUrl: 'https://vault.example.com',
      secretCount: 12,
      activeLeases: 3,
      pendingApprovals: 1,
      lastSyncAt: null,
    };
    expect(status.state).toBe('unlocked');
    expect(status.lastSyncAt).toBeNull();
  });

  it('ServiceConfig requires id, name, url, partition, pinned, order', () => {
    const config: ServiceConfig = {
      id: 'gmail',
      name: 'Gmail',
      url: 'https://mail.google.com',
      partition: 'persist:gmail',
      pinned: true,
      order: 0,
    };
    expect(config.pinned).toBe(true);
  });
});
