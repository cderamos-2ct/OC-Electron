// ─── Agent Identity & Configuration ─────────────────────────────────────────

export type AgentCapability = 'observe' | 'act';

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
  observedState?: 'healthy' | 'busy' | 'idle' | 'missing' | 'unknown' | 'orphaned' | 'drifted' | null;
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
  status?: 'active' | 'planned' | 'paused';
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

export type AgentDetail = AgentSummary & {
  ownedTasks: AgentOwnedTask[];
  relatedTasks: AgentOwnedTask[];
  recentCommunications: AgentFeedItem[];
  recentActivity: AgentFeedItem[];
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
  category: 'message' | 'conversation' | 'notification' | 'activity';
  source: string;
  title: string;
  body: string;
  timestamp: string;
};

export type AgentBinding = {
  agentId: string;
  services: string[];
  capabilities: AgentCapability[];
  apis?: string[];
};

export type AgentBindingConfig = {
  bindings: AgentBinding[];
  orchestrator: string;
  fallbackAgent: string;
};

export type AgentStatus = {
  agentId: string;
  online: boolean;
  boundServices: string[];
  lastSeen?: string;
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

export type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope: 'per-sender' | 'global';
  agents: AgentSummary[];
};

// ─── Agent Manager Types ────────────────────────────────────────────────────

export type AgentManagerRecommendation = {
  kind: 'delegate' | 'hire';
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
  tone: 'red' | 'orange' | 'blue' | 'green' | 'slate';
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
  linkedSessions: import('./sessions.js').SessionSummary[];
};

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
