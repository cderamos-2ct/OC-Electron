// Aegilume Gateway Wire Protocol Types
// Ported from openclaw/src/gateway/protocol/schema/*

// ─── Frame Types ────────────────────────────────────────────────────────────

export type RequestFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

export type ResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayError;
};

export type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: StateVersion;
};

export type HelloOk = {
  type: "hello-ok";
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

// ─── Snapshot & Presence ────────────────────────────────────────────────────

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
  authMode?: "none" | "token" | "password" | "trusted-proxy";
};

// ─── Chat ───────────────────────────────────────────────────────────────────

export type ChatSendParams = {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  attachments?: unknown[];
  timeoutMs?: number;
  idempotencyKey: string;
};

export type ChatEvent = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
};

export type LoopbackEvent = {
  sessionKey: string;
  kind?: string;
  synthetic?: boolean;
  runId?: string;
  message?: unknown;
  meta?: Record<string, unknown>;
};

export type ChatAbortParams = {
  sessionKey: string;
  runId?: string;
};

// ─── Agents ─────────────────────────────────────────────────────────────────

export type AgentIdentity = {
  name?: string;
  displayName?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
  persona?: string;
  operatingStyle?: string;
  strengths?: string[];
  escalationStyle?: string;
  signatureTone?: string;
  supervisor?: string | null;
};

export type AgentRuntimeSummary = {
  sessionLabel?: string | null;
  runtimeAgentId?: string | null;
  desiredStatus?: string | null;
  observedState?: "healthy" | "busy" | "idle" | "missing" | "unknown" | "orphaned" | "drifted" | null;
  sessionKey?: string | null;
  sessionId?: string | null;
  model?: string | null;
  modelProvider?: string | null;
  lastSeenAt?: string | null;
  ageMs?: number | null;
  currentTaskId?: string | null;
  taskCount?: number;
  lastError?: string | null;
  matchedBy?: string | null;
};

export type AgentSummary = {
  id: string;
  name?: string;
  displayName?: string;
  identity?: AgentIdentity;
  lane?: string;
  persona?: string;
  operatingStyle?: string;
  strengths?: string[];
  escalationStyle?: string;
  signatureTone?: string;
  supervisor?: string | null;
  status?: "active" | "planned" | "paused";
  runtimeAgentId?: string | null;
  description?: string;
  default?: boolean;
  escalatesTo?: string | null;
  responsibilities?: string[];
  monitorSurfaces?: string[];
  communicationChannels?: string[];
  tools?: string[];
  memoryPaths?: string[];
  soulPath?: string | null;
  memoryPath?: string | null;
  heartbeatPath?: string | null;
  directivesPath?: string | null;
  inboxPath?: string | null;
  outboxPath?: string | null;
  artifactsDir?: string | null;
  modelProvider?: string | null;
  defaultModel?: string | null;
  fallbackModel?: string | null;
  reasoningLevel?: string | null;
  authProfile?: string | null;
  canSpawnSubagents?: boolean;
  subagentModel?: string | null;
  subagentMaxDepth?: number | null;
  subagentUseCases?: string[];
  taskTags?: string[];
  taskCounts?: {
    queued: number;
    running: number;
    blocked: number;
    done: number;
    failed: number;
    total: number;
  };
  runtime?: AgentRuntimeSummary;
  lastTaskUpdate?: string | null;
  recentTaskTitles?: string[];
};

export type AgentOwnedTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  ownerAgent: string;
  updatedAt: string;
  source: string;
};

export type AgentFeedItem = {
  id: string;
  category: "message" | "conversation" | "notification" | "activity";
  source: string;
  title: string;
  body: string;
  timestamp: string;
};

export type AgentDetail = AgentSummary & {
  ownedTasks: AgentOwnedTask[];
  relatedTasks: AgentOwnedTask[];
  recentCommunications: AgentFeedItem[];
  recentActivity: AgentFeedItem[];
};

export type AgentHireDraft = {
  name: string;
  lane: string;
  description: string;
  monitorSurfaces: string[];
  communicationChannels: string[];
  responsibilities: string[];
  taskTags: string[];
  modelProvider?: string | null;
  defaultModel?: string | null;
  fallbackModel?: string | null;
  authProfile?: string | null;
  reasoningLevel?: string | null;
  canSpawnSubagents?: boolean;
  subagentModel?: string | null;
  subagentMaxDepth?: number | null;
  subagentUseCases?: string[];
};

export type AgentManagerRecommendation = {
  kind: "delegate" | "hire";
  title: string;
  rationale: string;
  taskIds: string[];
  proposedAgentId?: string | null;
  currentOwnerAgentId?: string | null;
  evidence?: string[];
  draftAgent?: AgentHireDraft | null;
};

export type AgentManagerAuditAction = {
  id: string;
  title: string;
  detail: string;
  tone: "red" | "orange" | "blue" | "green" | "slate";
  ctaLabel?: string;
  ctaHref?: string;
};

export type AgentManagerDelegationTrace = {
  taskId: string;
  taskTitle: string;
  timestamp: string;
  actor: string;
  note: string;
  ownerAgentId?: string | null;
};

export type AgentRuntimeTriageItem = {
  agentId: string;
  agentName: string;
  runtimeState: string;
  desiredStatus?: string | null;
  currentTaskId?: string | null;
  taskCount: number;
  lastSeenAt?: string | null;
  lastError?: string | null;
};

export type AgentManagerAudit = {
  generatedAt?: string | null;
  rosterSummary: {
    totalAgents: number;
    healthy: number;
    busy: number;
    idle: number;
    missing: number;
    unknown: number;
    orphanedSessions: number;
  };
  taskSummary: {
    active: number;
    delegated: number;
    onCd: number;
    unowned: number;
  };
  actions: AgentManagerAuditAction[];
  runtimeTriage: AgentRuntimeTriageItem[];
  delegationTraces: AgentManagerDelegationTrace[];
  warnings: string[];
};

export type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope: "per-sender" | "global";
  agents: AgentSummary[];
};

export type AgentSendParams = {
  message: string;
  agentId?: string;
  to?: string;
  replyTo?: string;
  sessionId?: string;
  sessionKey?: string;
  thinking?: string;
  deliver?: boolean;
  attachments?: unknown[];
  channel?: string;
  replyChannel?: string;
  accountId?: string;
  replyAccountId?: string;
  threadId?: string;
  groupId?: string;
  groupChannel?: string;
  groupSpace?: string;
  timeout?: number;
  lane?: string;
  extraSystemPrompt?: string;
  idempotencyKey: string;
  label?: string;
  spawnedBy?: string;
};

// ─── Sessions ───────────────────────────────────────────────────────────────

export type SessionsListParams = {
  limit?: number;
  activeMinutes?: number;
  includeGlobal?: boolean;
  includeUnknown?: boolean;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  label?: string;
  spawnedBy?: string;
  agentId?: string;
  search?: string;
};

export type SessionSummary = {
  key: string;
  kind?: string;
  displayName?: string;
  channel?: string;
  chatType?: string;
  agentId?: string;
  label?: string;
  model?: string;
  updatedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  origin?: {
    label?: string;
    provider?: string;
    surface?: string;
    chatType?: string;
  };
};

export type SessionsPatchParams = {
  key: string;
  label?: string | null;
  thinkingLevel?: string | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  responseUsage?: "off" | "tokens" | "full" | "on" | null;
  elevatedLevel?: string | null;
  execHost?: string | null;
  execSecurity?: string | null;
  execAsk?: string | null;
  execNode?: string | null;
  model?: string | null;
  spawnedBy?: string | null;
  spawnDepth?: number | null;
  sendPolicy?: "allow" | "deny" | null;
  groupActivation?: "mention" | "always" | null;
};

// ─── Models ─────────────────────────────────────────────────────────────────

export type ModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
};

// ─── Nodes & Devices ────────────────────────────────────────────────────────

export type NodeInfo = {
  id: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  status?: string;
  lastSeen?: number;
};

export type NodeInvokeParams = {
  nodeId: string;
  command: string;
  params?: unknown;
  timeoutMs?: number;
  idempotencyKey: string;
};

export type DeviceInfo = {
  deviceId: string;
  displayName?: string;
  role?: string;
  scopes?: string[];
  platform?: string;
  lastSeen?: number;
};

// ─── TTS / Voice ────────────────────────────────────────────────────────────

export type TTSProviderInfo = {
  id: string;
  name: string;
  configured?: boolean;
  models?: string[];
  voices?: string[];
};

export type TTSStatus = {
  enabled: boolean;
  provider?: string;
  voice?: string;
  providers?: TTSProviderInfo[];
};

// ─── Skills ─────────────────────────────────────────────────────────────────

export type SkillInfo = {
  name: string;
  skillKey: string;
  description?: string;
  emoji?: string;
  source?: string;
  bundled?: boolean;
  eligible?: boolean;
  disabled?: boolean;
  blockedByAllowlist?: boolean;
  filePath?: string;
  baseDir?: string;
  requirements?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    os?: string[];
  };
  missing?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    os?: string[];
  };
  install?: { id: string; kind: string; label: string; bins?: string[] }[];
};

export type SkillBin = {
  id: string;
  name: string;
  description?: string;
  skills: SkillInfo[];
};

// ─── Channels ───────────────────────────────────────────────────────────────

export type ChannelMeta = {
  id: string;
  label: string;
  detailLabel?: string;
  systemImage?: string;
};

export type ChannelDetail = {
  configured?: boolean;
  linked?: boolean;
  authAgeMs?: number;
  running?: boolean;
  connected?: boolean;
  self?: { e164?: string; jid?: string };
  lastError?: string | null;
  accountId?: string;
};

export type ChannelsStatusResult = {
  channelOrder?: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelMeta[];
  channels?: Record<string, ChannelDetail>;
};

// ─── Cron ───────────────────────────────────────────────────────────────────

export type CronJob = {
  id: string;
  name: string;
  expression: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  lastResult?: string;
};

export type CronRunResult = {
  id: string;
  cronId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "error";
  output?: string;
  error?: string;
};

// ─── Config ─────────────────────────────────────────────────────────────────

export type ConfigEntry = {
  key: string;
  value: unknown;
  type?: string;
  description?: string;
  section?: string;
};

// ─── Health ─────────────────────────────────────────────────────────────────

export type HealthStatus = {
  ok: boolean;
  ts?: number;
  durationMs?: number;
  channels?: Record<string, {
    configured?: boolean;
    linked?: boolean;
    authAgeMs?: number;
    running?: boolean;
    connected?: boolean;
  }>;
};

// ─── Gateway Connection State ───────────────────────────────────────────────

export type GatewayConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "error";

// ─── RPC Method Map (for typed calls) ───────────────────────────────────────

export type RPCMethodMap = {
  // Health & Status
  "health": [void, HealthStatus];
  "status": [void, unknown];
  "usage.status": [void, unknown];
  "usage.cost": [void, unknown];

  // Chat
  "chat.send": [ChatSendParams, { runId: string }];
  "chat.history": [{ sessionKey: string; limit?: number }, unknown[]];
  "chat.abort": [ChatAbortParams, void];

  // Agents
  "agents.list": [void, AgentsListResult];
  "agents.create": [Partial<AgentSummary>, AgentSummary];
  "agents.update": [Partial<AgentSummary> & { id: string }, AgentSummary];
  "agents.delete": [{ id: string }, void];

  // Sessions
  "sessions.list": [SessionsListParams | void, SessionSummary[]];
  "sessions.preview": [{ key: string }, unknown];
  "sessions.patch": [SessionsPatchParams, void];
  "sessions.reset": [{ key: string }, void];
  "sessions.delete": [{ key: string }, void];
  "sessions.compact": [{ key: string }, void];

  // Models
  "models.list": [void, ModelChoice[]];

  // TTS
  "tts.status": [void, TTSStatus];
  "tts.providers": [void, TTSProviderInfo[]];
  "tts.enable": [void, void];
  "tts.disable": [void, void];
  "tts.setProvider": [{ provider: string; voice?: string }, void];
  "tts.convert": [{ text: string }, { audio: string }];

  // Nodes
  "node.list": [void, NodeInfo[]];
  "node.describe": [{ nodeId: string }, NodeInfo];
  "node.rename": [{ nodeId: string; displayName: string }, void];
  "node.invoke": [NodeInvokeParams, unknown];

  // Device pairing
  "device.pair.list": [void, DeviceInfo[]];
  "device.pair.approve": [{ deviceId: string }, void];
  "device.pair.reject": [{ deviceId: string }, void];
  "device.pair.remove": [{ deviceId: string }, void];

  // Skills
  "skills.status": [void, { skills: SkillInfo[]; workspaceDir?: string; managedSkillsDir?: string }];
  "skills.bins": [void, SkillBin[]];
  "skills.install": [{ id: string }, void];
  "skills.update": [{ id: string }, void];

  // Channels
  "channels.status": [void, ChannelsStatusResult];
  "channels.logout": [{ id: string }, void];

  // Web Login (WhatsApp QR code flow)
  "web.login.start": [{ id?: string } | void, { qrDataUrl: string; message?: string }];
  "web.login.wait": [{ timeoutMs?: number } | void, { connected: boolean; message?: string }];

  // Cron
  "cron.list": [void, CronJob[]];
  "cron.status": [void, unknown];
  "cron.add": [Omit<CronJob, "id" | "lastRun" | "nextRun" | "lastResult">, CronJob];
  "cron.update": [Partial<CronJob> & { id: string }, CronJob];
  "cron.remove": [{ id: string }, void];
  "cron.run": [{ id: string }, CronRunResult];
  "cron.runs": [{ id: string; limit?: number }, CronRunResult[]];

  // Config
  "config.get": [{ key?: string } | void, ConfigEntry | ConfigEntry[]];
  "config.set": [{ key: string; value: unknown }, void];
  "config.schema": [void, unknown];

  // Logs
  "logs.tail": [{ lines?: number; filter?: string } | void, string[]];

  // Talk mode
  "talk.config": [void, unknown];
  "talk.mode": [{ enabled: boolean }, void];

  // Voicewake
  "voicewake.get": [void, { enabled: boolean; keyword?: string }];
  "voicewake.set": [{ enabled: boolean; keyword?: string }, void];
};

// Helper to extract params and result types
export type RPCParams<M extends keyof RPCMethodMap> = RPCMethodMap[M][0];
export type RPCResult<M extends keyof RPCMethodMap> = RPCMethodMap[M][1];

// ─── Event Map ──────────────────────────────────────────────────────────────

export type GatewayEventMap = {
  "connect.challenge": { nonce: string };
  "agent": unknown;
  "chat": ChatEvent;
  "loopback": LoopbackEvent;
  "presence": PresenceEntry[];
  "tick": { ts: number };
  "talk.mode": { enabled: boolean };
  "shutdown": { reason?: string };
  "health": unknown;
  "heartbeat": unknown;
  "cron": { cronId: string; event: string };
  "node.pair.requested": { nodeId: string; displayName?: string };
  "node.pair.resolved": { nodeId: string; approved: boolean };
  "node.invoke.request": unknown;
  "device.pair.requested": { deviceId: string };
  "device.pair.resolved": { deviceId: string; approved: boolean };
  "voicewake.changed": { enabled: boolean; keyword?: string };
  "exec.approval.requested": unknown;
  "exec.approval.resolved": unknown;
};

export type GatewayEventName = keyof GatewayEventMap;

export type AgentTaskSummary = {
  id: string;
  title: string;
  status: string;
  priority: string;
  ownerAgent: string | null;
  updatedAt: string;
  latestActivity?: string | null;
  nextStep?: string | null;
  blockedBy?: string[];
  artifacts?: string[];
  needsChristian?: boolean;
};

export type InterAgentCommunicationType =
  | "handoff"
  | "overlap_notice"
  | "second_opinion"
  | "dependency_ping"
  | "friction_note";

export type InterAgentCommunicationAudience = "internal_only" | "needs_christian";
export type InterAgentCommunicationUrgency = "low" | "normal" | "high" | "needs_now";
export type InterAgentCommunicationStatus = "open" | "acknowledged" | "resolved";

export type InterAgentCommunicationTaskRef = {
  id: string;
  title?: string | null;
};

export type InterAgentCommunication = {
  id: string;
  type: InterAgentCommunicationType;
  typeLabel: string;
  senderAgentId: string;
  senderDisplayName: string;
  recipientAgentIds: string[];
  recipientDisplayNames: string[];
  primaryTaskId?: string | null;
  taskRefs: InterAgentCommunicationTaskRef[];
  summary: string;
  actionRequested?: string | null;
  contextNote?: string | null;
  urgency: InterAgentCommunicationUrgency;
  status: InterAgentCommunicationStatus;
  audience: InterAgentCommunicationAudience;
  defaultAudience: InterAgentCommunicationAudience;
  audienceLabel: string;
  policyNote: string;
  escalationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  routeBackTo?: ReplyRouteTarget | null;
};

export type InterAgentCommunicationSummary = {
  total: number;
  internalOnly: number;
  needsChristian: number;
  open: number;
  byType: Array<{
    type: InterAgentCommunicationType;
    label: string;
    total: number;
    internalOnly: number;
    needsChristian: number;
  }>;
};

export type AgentRosterCard = {
  id: string;
  displayName: string;
  emoji?: string;
  lane?: string;
  persona?: string;
  operatingStyle?: string;
  strengths?: string[];
  escalationStyle?: string;
  signatureTone?: string;
  supervisor?: string | null;
  status?: string;
  runtimeState?: string | null;
  currentTasks: AgentTaskSummary[];
  pendingCount: number;
  blockedCount: number;
  recentCompleted: AgentTaskSummary[];
  lastMeaningfulUpdate?: string | null;
  linkedSessions: SessionSummary[];
};

export type WorkerSessionGroup = {
  groupId: string;
  label: string;
  parentType: "agent" | "task" | "system";
  parentAgentId?: string | null;
  parentTaskId?: string | null;
  sessionKeys: string[];
  latestSessionAt?: number | null;
  status?: string;
  latestSummary?: string | null;
  sessions: SessionSummary[];
};

export type NeedsChristianItem = {
  id: string;
  title: string;
  reason: string;
  urgency?: "fyi" | "attention_soon" | "needs_now";
  nextStep?: string | null;
  blockedBy?: string[];
  artifacts?: string[];
  ownerAgentId?: string | null;
  status: string;
  priority: string;
  updatedAt: string;
  routeBackTo?: ReplyRouteTarget | null;
  suggestedReplies?: SuggestedReplyOption[];
};

export type SuggestedReplyOption = {
  label: string;
  text: string;
};

export type ReplyRouteTarget = {
  kind: "task" | "needs_christian" | "rollup";
  taskId: string;
  agentId?: string | null;
  sessionKey?: string | null;
};

export type CommandRollupCard = {
  id: string;
  kind: "fyi" | "blocked" | "completed" | "needs_decision" | "risk_flag";
  title: string;
  summary: string;
  taskId?: string | null;
  agentId?: string | null;
  priority: string;
  updatedAt: string;
  routeBackTo?: ReplyRouteTarget | null;
  suggestedReplies?: SuggestedReplyOption[];
};

export type TaskStateBucket = {
  key: "current" | "pending" | "blocked" | "complete";
  label: string;
  description: string;
  tasks: AgentTaskSummary[];
  total: number;
};

export type CommandChatViewModel = {
  commandSectionLabel: string;
  commandSession: SessionSummary;
  activeSessionKey: string;
  backgroundGroups: WorkerSessionGroup[];
  ungroupedSessions: SessionSummary[];
  needsChristian: NeedsChristianItem[];
  rollups: CommandRollupCard[];
  taskState: TaskStateBucket[];
};

export type ServerVisibilitySummary = {
  generatedAt?: string;
  agents: AgentSummary[];
  sessions: SessionSummary[];
  rosterCards: AgentRosterCard[];
  tasks: AgentTaskSummary[];
  needsChristian: NeedsChristianItem[];
  rollups: CommandRollupCard[];
  taskState: TaskStateBucket[];
  communications: InterAgentCommunication[];
  communicationSummary: InterAgentCommunicationSummary;
  summary: {
    agentCount: number;
    sessionCount: number;
    proactiveCount: number;
  };
};

export type OpsTaskLike = {
  id: string;
  title: string;
  description?: string;
  content?: string;
  status: string;
  priority: string;
  assignee?: string | null;
  updatedAt: string;
};
