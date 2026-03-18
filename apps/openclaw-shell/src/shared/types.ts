// ─── View Types ───────────────────────────────────────────────────

export type ViewId =
  | 'home'
  | 'tasks'
  | 'draft-review'
  | 'agents'
  | 'comms'
  | 'calendar'
  | 'github'
  | 'browser'
  | 'vault';

// ─── Service Types ────────────────────────────────────────────────

export type ServiceState = 'unloaded' | 'loading' | 'active' | 'hibernated' | 'destroyed';

export interface ServiceConfig {
  id: string;
  name: string;
  url: string;
  partition: string;
  icon?: string;
  pinned: boolean;
  order: number;
  recipePath?: string;
  agentId?: string; // bound agent
}

export interface ServiceStatus {
  id: string;
  state: ServiceState;
  badgeCount: number;
  title: string;
  url: string;
}

// ─── Agent Types ─────────────────────────────────────────────────

export type AgentCapability = 'observe' | 'act';

export interface AgentBinding {
  agentId: string;
  services: string[];
  capabilities: AgentCapability[];
  apis?: string[];
}

export interface AgentBindingConfig {
  bindings: AgentBinding[];
  orchestrator: string;
  fallbackAgent: string;
}

export interface AgentStatus {
  agentId: string;
  online: boolean;
  boundServices: string[];
  lastSeen?: string;
}

// ─── Task Types ──────────────────────────────────────────────────

import type { TaskDocument } from './task-parser.js';
export type { TaskDocument } from './task-parser.js';

export type QuickDecision = 'approve' | 'defer' | 'block' | 'cancel';

export interface TaskPatch {
  status?: string;
  priority?: string;
  owner_agent?: string;
  reason?: string;
  expectedUpdatedAt?: string; // optimistic locking
}

export interface TaskConflict {
  conflict: true;
  currentTask: TaskDocument;
}

// ─── Gateway Types ───────────────────────────────────────────────

export type GatewayConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error';

export interface GatewayConfig {
  url: string;
  clientName: string;
  reconnectInterval?: number;
}

// ─── Gateway Wire Protocol Types ─────────────────────────────────

export type RequestFrame = {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
};

export type ResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayError;
};

export type EventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: StateVersion;
};

export type HelloOk = {
  type: 'hello-ok';
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: Snapshot;
  canvasHostUrl?: string;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: {
    maxPayload?: number;
    maxBufferedBytes?: number;
    tickIntervalMs?: number;
  };
};

export type GatewayError = {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};

export type StateVersion = {
  presence: number;
  health: number;
};

export type PresenceEntry = {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;
  lastInputSeconds?: number;
  reason?: string;
  tags?: string[];
  text?: string;
  ts: number;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  instanceId?: string;
};

export type Snapshot = {
  presence: PresenceEntry[];
  health: unknown;
  stateVersion: StateVersion;
  uptimeMs: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: {
    defaultAgentId: string;
    mainKey: string;
    mainSessionKey: string;
    scope?: string;
  };
  authMode?: 'none' | 'token' | 'password' | 'trusted-proxy';
};

export type ChatEvent = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
};

export type GatewayEventMap = {
  'connect.challenge': { nonce: string };
  'agent': unknown;
  'chat': ChatEvent;
  'loopback': unknown;
  'presence': PresenceEntry[];
  'tick': { ts: number };
  'talk.mode': { enabled: boolean };
  'shutdown': { reason?: string };
  'health': unknown;
  'heartbeat': unknown;
  'cron': { cronId: string; event: string };
  'node.pair.requested': { nodeId: string; displayName?: string };
  'node.pair.resolved': { nodeId: string; approved: boolean };
  'node.invoke.request': unknown;
  'device.pair.requested': { deviceId: string };
  'device.pair.resolved': { deviceId: string; approved: boolean };
  'voicewake.changed': { enabled: boolean; keyword?: string };
  'exec.approval.requested': unknown;
  'exec.approval.resolved': unknown;
  'cd.action.request': { action: CDAction };
  'cd.action.result': { actionId: string; result: CDActionResult };
};

export type GatewayEventName = keyof GatewayEventMap;

export type RPCMethodMap = {
  'health': [void, unknown];
  'status': [void, unknown];
  'chat.send': [unknown, { runId: string }];
  'chat.history': [{ sessionKey: string; limit?: number }, unknown[]];
  'chat.abort': [{ sessionKey: string; runId?: string }, void];
  'agents.list': [void, unknown];
  'sessions.list': [unknown | void, unknown[]];
  'sessions.patch': [unknown, void];
  'sessions.reset': [{ key: string }, void];
  'sessions.delete': [{ key: string }, void];
  'models.list': [void, unknown[]];
  'node.list': [void, unknown[]];
  'node.invoke': [unknown, unknown];
  'connect': [unknown, HelloOk];
};

export type RPCParams<M extends keyof RPCMethodMap> = RPCMethodMap[M][0];
export type RPCResult<M extends keyof RPCMethodMap> = RPCMethodMap[M][1];

// ─── Browser Tab Types ──────────────────────────────────────────

export type BrowserTabState = 'loading' | 'ready' | 'error' | 'blank';

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  state: BrowserTabState;
  favicon?: string;
  isPinned: boolean;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Setup Types ─────────────────────────────────────────────────

export interface SetupAgentConfig {
  id: string;
  displayName: string;
  emoji: string;
  role: string;
  enabled: boolean;
}

export interface SetupConfig {
  userName: string;
  enabledServices: string[];  // service IDs from DEFAULT_SERVICES
  agents: SetupAgentConfig[];
  completedAt: string;
}

// ─── IPC Rate Limit Error ────────────────────────────────────────

export interface RateLimitError {
  error: 'rate_limited';
  channel: string;
  retryAfter: number; // ms until caller may retry
}

// ─── IPC Channel Types ───────────────────────────────────────────

// Main -> Renderer (events via webContents.send)
export interface MainToRendererEvents {
  'gateway:state': GatewayConnectionState;
  'gateway:event': unknown;
  'task:changed': { taskId: string; task: TaskDocument };
  'task:deleted': { taskId: string };
  'service:badge-update': { serviceId: string; count: number };
  'service:notification': { serviceId: string; title: string; body: string };
  'service:state-change': { serviceId: string; state: ServiceState };
  'shell:focus-service': { serviceId: string } | { serviceIndex: number };
  'shell:toggle-rail': void;
  'shell:close-active-tab': void;
  'agent:status': AgentStatus;
  'agent:message': { from: string; to: string; content: string; taskId?: string; viaCd?: boolean };
  'approval:requested': PendingApproval;
  'approval:resolved': ApprovalResult & { actionResult?: CDActionResult };
  'shell:show-next-approval': void;
  'shell:restore-state': { railVisible?: boolean; railWidth?: number };
  'vault:state': VaultConnectionState;
  'vault:approval-requested': PendingVaultApproval;
  'vault:approval-resolved': { approvalId: string; decision: 'approved' | 'denied' };
  'vault:lease-revoked': { leaseId: string; secretName: string };
  'browser:tab-updated': BrowserTab;
  'browser:tab-removed': { tabId: string };
  'browser:tabs-list': BrowserTab[];
  'setup:status': { setupComplete: boolean };
  'ipc:rate-limited': RateLimitError;
}

// Renderer -> Main (invoke/handle)
export interface RendererToMainHandlers {
  'gateway:rpc': [method: string, params?: unknown];
  'gateway:agent-rpc': [agentId: string, method: string, params?: unknown];
  'task:list': [];
  'task:get': [taskId: string];
  'task:mutate': [taskId: string, patch: TaskPatch];
  'task:quick-decision': [taskId: string, decision: QuickDecision];
  'task:batch-approve': [taskIds: string[]];
  'service:list': [];
  'service:add': [config: ServiceConfig];
  'service:remove': [serviceId: string];
  'service:reload': [serviceId: string];
  'service:hibernate': [serviceId: string];
  'shell:get-config': [];
  'shell:set-config': [config: Partial<ShellConfig>];
  'shell:quit': [];
  'agent:bindings': [];
  'api.workers.status': [];
  'api.gmail.list': [agentId: string, query?: string, maxResults?: number];
  'api.gmail.get': [agentId: string, messageId: string];
  'api.gmail.archive': [agentId: string, messageId: string];
  'api.gmail.label': [agentId: string, messageId: string, addLabels: string[], removeLabels?: string[]];
  'api.gmail.draft': [agentId: string, to: string, subject: string, body: string];
  'api.gmail.send-draft': [agentId: string, draftId: string];
  'api.gmail.delete': [agentId: string, messageId: string];
  'api.gmail.batch-modify': [agentId: string, messageIds: string[], addLabels: string[], removeLabels: string[]];
  'api.calendar.list': [agentId: string, timeMin: string, timeMax: string, calendarId?: string];
  'api.calendar.get': [agentId: string, eventId: string, calendarId?: string];
  'api.calendar.create': [agentId: string, event: CalendarEventCreate, calendarId?: string];
  'api.calendar.update': [agentId: string, eventId: string, event: Partial<CalendarEventCreate>, calendarId?: string];
  'api.calendar.accept': [agentId: string, eventId: string, calendarId?: string];
  'api.calendar.decline': [agentId: string, eventId: string, calendarId?: string];
  'api.calendar.free-time': [agentId: string, timeMin: string, timeMax: string, attendees?: string[]];
  'api.github.notifications': [agentId: string, all?: boolean];
  'api.github.notification-read': [agentId: string, threadId: string];
  'api.github.prs': [agentId: string, owner: string, repo: string, state?: string];
  'api.github.pr': [agentId: string, owner: string, repo: string, number: number];
  'api.github.review': [agentId: string, owner: string, repo: string, number: number, body: string, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'];
  'api.github.merge': [agentId: string, owner: string, repo: string, number: number, mergeMethod?: 'merge' | 'squash' | 'rebase'];
  'api.github.issues': [agentId: string, owner: string, repo: string, state?: string];
  'api.github.comment': [agentId: string, owner: string, repo: string, number: number, body: string];
  'approval:list': [];
  'approval:decide': [actionId: string, decision: 'approved' | 'denied', alwaysAllow?: boolean];
  'approval:rules': [];
  'approval:revoke-rule': [ruleId: string];
  'approval:audit-log': [limit?: number];
  'vault:status': [];
  'vault:list-secrets': [];
  'vault:list-policies': [];
  'vault:update-policy': [policy: VaultPolicy];
  'vault:delete-policy': [policyId: string];
  'vault:get-audit-log': [limit?: number];
  'vault:revoke-lease': [leaseId: string];
  'vault:revoke-all': [];
  'vault:pending-approvals': [];
  'vault:decide-approval': [approvalId: string, decision: 'approved' | 'denied'];
  'credentials:test-connection': [serviceId: string];
  'shell:export-debug-bundle': [];
  // Browser / CDP actions
  'browser:navigate': [url: string, tabId?: string];
  'browser:click': [selector: string, tabId?: string];
  'browser:fill': [selector: string, value: string, tabId?: string];
  'browser:screenshot': [tabId?: string, fullPage?: boolean];
  'browser:read': [tabId?: string, selector?: string];
  'browser:scroll': [selector: string | undefined, deltaY: number, tabId?: string];
  'browser:wait': [ms: number, tabId?: string];
  'browser:evaluate': [expression: string, tabId?: string];
  'browser:network-enable': [tabId?: string];
  'browser:get-document': [tabId?: string];
  'browser:add-tab': [name: string, url: string, agentId?: string, autoPin?: boolean];
  'browser:close-tab': [tabId: string];
  'browser:pin-tab': [tabId: string];
  'browser:unpin-tab': [tabId: string];
  'browser:list-tabs': [];
  'setup:check': [];
  'setup:complete': [config: SetupConfig];
}

// ─── Shell Config ────────────────────────────────────────────────

export interface ShellConfig {
  railVisible: boolean;
  railWidth: number;
  activeServiceId: string;
  services: ServiceConfig[];
  theme: 'dark' | 'light' | 'system';
}

export const DEFAULT_SHELL_CONFIG: ShellConfig = {
  railVisible: true,
  railWidth: 380,
  activeServiceId: 'openclaw-dashboard',
  services: [],
  theme: 'dark',
};

// ─── API Worker Types ────────────────────────────────────────────

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body?: string;
}

export interface GmailDraft {
  id: string;
  message: GmailMessage;
}

export interface APIWorkerStatus {
  name: string;
  isRunning: boolean;
  lastPollAt: string | null;
  errorCount: number;
  consecutiveErrors: number;
}

// ─── GitHub Types ────────────────────────────────────────────────

export interface GitHubNotification {
  id: string;
  reason: string;
  subject: { title: string; url: string; type: string };
  repository: { full_name: string };
  updated_at: string;
  unread: boolean;
}

export interface GitHubPR {
  number: number;
  title: string;
  state: string;
  user: string;
  base: string;
  head: string;
  mergeable: boolean | null;
  reviewDecision?: string;
  url: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  user: string;
  labels: string[];
  assignees: string[];
  url: string;
}

// ─── Calendar Types ───────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: Array<{ email: string; responseStatus: string }>;
  status: string;
  htmlLink: string;
}

export interface CalendarEventCreate {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
}

// ─── CD Action Types (Phase 4) ───────────────────────────────────

export type CDActionType = 'click' | 'fill' | 'select' | 'navigate' | 'read' | 'scroll';

export type CDActionRiskTier = 'silent' | 'confirm' | 'confirm-send';

export interface CDAction {
  id: string;
  type: CDActionType;
  agentId: string;
  serviceId: string;
  description: string;
  riskTier: CDActionRiskTier;
  target: {
    selector?: string;
    url?: string;
    value?: string;
    text?: string;
  };
  context?: string;
  requestedAt: string;
}

export type ApprovalDecision = 'approved' | 'denied' | 'auto-approved';

export interface ApprovalResult {
  actionId: string;
  decision: ApprovalDecision;
  decidedAt: string;
  autoApproveRuleId?: string;
}

export interface AutoApproveRule {
  id: string;
  agentId: string;
  serviceId: string;
  actionType: CDActionType;
  createdAt: string;
}

export interface CDActionResult {
  actionId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

export interface PendingApproval {
  action: CDAction;
  status: 'pending' | 'approved' | 'denied';
}

export interface AuditLogEntry {
  timestamp: string;
  actionId: string;
  agentId: string;
  serviceId: string;
  actionType: CDActionType;
  target: CDAction['target'];
  description: string;
  riskTier: CDActionRiskTier;
  decision: ApprovalDecision;
  autoApproveRuleId?: string;
  result?: {
    success: boolean;
    error?: string;
    durationMs: number;
  };
}

// ─── Observation Types ───────────────────────────────────────────

export interface PageContext {
  url: string;
  title: string;
  selectedText: string;
  visibleText: string;
  structuredContent: unknown | null;
}

export interface ObserveConfig {
  observeSelector?: string;
  includeScreenshot?: boolean;
}

export interface MutationSummary {
  addedNodes: number;
  removedNodes: number;
  textChanges: number;
  timestamp: string;
}

// ─── Vault Types (Vaultwarden Integration) ──────────────────────

export type VaultPolicyAction = 'auto-approve' | 'require-approval';

export interface VaultPolicy {
  id: string;
  agentId: string;
  secretPattern: string;
  action: VaultPolicyAction;
  maxLeaseTTL: number; // seconds
  createdAt: string;
}

export interface VaultLease {
  id: string;
  secretId: string;
  secretName: string;
  value: string;
  leasedAt: string;
  expiresAt: string;
  leasedBy: string; // agentId
  purpose: string;
}

export interface VaultAuditEntry {
  timestamp: string;
  agentId: string;
  secretName: string;
  action: 'access' | 'create' | 'update' | 'delete' | 'rotate' | 'revoke' | 'denied';
  result: 'success' | 'denied' | 'error';
  policyId?: string;
  leaseId?: string;
  error?: string;
  purpose?: string;
}

export type VaultConnectionState = 'disconnected' | 'locked' | 'unlocked' | 'error';

export interface VaultStatus {
  state: VaultConnectionState;
  serverUrl: string;
  secretCount: number;
  activeLeases: number;
  pendingApprovals: number;
  lastSyncAt: string | null;
}

export interface VaultSecretMeta {
  id: string;
  name: string;
  folder: string;
  lastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasActiveLease: boolean;
}

export interface PendingVaultApproval {
  id: string;
  agentId: string;
  secretName: string;
  purpose: string;
  requestedAt: string;
}
