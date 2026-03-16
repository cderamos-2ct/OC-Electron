// ─── Ops & Communication Types ──────────────────────────────────────────────

import type { AgentSummary, AgentRosterCard, AgentTaskSummary } from './agents.js';
import type { SessionSummary } from './sessions.js';
import type { TaskStateBucket } from './tasks.js';

// ─── Inter-Agent Communication ──────────────────────────────────────────────

export type InterAgentCommunicationType =
  | 'handoff'
  | 'overlap_notice'
  | 'second_opinion'
  | 'dependency_ping'
  | 'friction_note';

export type InterAgentCommunicationAudience = 'internal_only' | 'needs_christian';
export type InterAgentCommunicationUrgency = 'low' | 'normal' | 'high' | 'needs_now';
export type InterAgentCommunicationStatus = 'open' | 'acknowledged' | 'resolved';

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

// ─── Command Chat & Rollups ─────────────────────────────────────────────────

export type SuggestedReplyOption = {
  label: string;
  text: string;
};

export type ReplyRouteTarget = {
  kind: 'task' | 'needs_christian' | 'rollup';
  taskId: string;
  agentId?: string | null;
  sessionKey?: string | null;
};

export type NeedsChristianItem = {
  id: string;
  title: string;
  reason: string;
  urgency?: 'fyi' | 'attention_soon' | 'needs_now';
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

export type CommandRollupCard = {
  id: string;
  kind: 'fyi' | 'blocked' | 'completed' | 'needs_decision' | 'risk_flag';
  title: string;
  summary: string;
  taskId?: string | null;
  agentId?: string | null;
  priority: string;
  updatedAt: string;
  routeBackTo?: ReplyRouteTarget | null;
  suggestedReplies?: SuggestedReplyOption[];
};

export type CommandChatViewModel = {
  commandSectionLabel: string;
  commandSession: SessionSummary;
  activeSessionKey: string;
  backgroundGroups: import('./sessions.js').WorkerSessionGroup[];
  ungroupedSessions: SessionSummary[];
  needsChristian: NeedsChristianItem[];
  rollups: CommandRollupCard[];
  taskState: TaskStateBucket[];
};

// ─── Server Visibility ──────────────────────────────────────────────────────

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

// ─── Shell Service Types ────────────────────────────────────────────────────

export type ServiceState = 'unloaded' | 'loading' | 'active' | 'hibernated' | 'destroyed';

export type ServiceConfig = {
  id: string;
  name: string;
  url: string;
  partition: string;
  icon?: string;
  pinned: boolean;
  order: number;
  recipePath?: string;
  agentId?: string;
};

export type ServiceStatus = {
  id: string;
  state: ServiceState;
  badgeCount: number;
  title: string;
  url: string;
};

export type ShellConfig = {
  railVisible: boolean;
  railWidth: number;
  activeServiceId: string;
  services: ServiceConfig[];
  theme: 'dark' | 'light' | 'system';
};

// ─── Vault Types ────────────────────────────────────────────────────────────

export type VaultPolicyAction = 'auto-approve' | 'require-approval';

export type VaultPolicy = {
  id: string;
  agentId: string;
  secretPattern: string;
  action: VaultPolicyAction;
  maxLeaseTTL: number;
  createdAt: string;
};

export type VaultLease = {
  id: string;
  secretId: string;
  secretName: string;
  value: string;
  leasedAt: string;
  expiresAt: string;
  leasedBy: string;
  purpose: string;
};

export type VaultAuditEntry = {
  timestamp: string;
  agentId: string;
  secretName: string;
  action: 'access' | 'create' | 'update' | 'delete' | 'rotate' | 'revoke' | 'denied';
  result: 'success' | 'denied' | 'error';
  policyId?: string;
  leaseId?: string;
  error?: string;
  purpose?: string;
};

export type VaultConnectionState = 'disconnected' | 'locked' | 'unlocked' | 'error';

export type VaultStatus = {
  state: VaultConnectionState;
  serverUrl: string;
  secretCount: number;
  activeLeases: number;
  pendingApprovals: number;
  lastSyncAt: string | null;
};

export type VaultSecretMeta = {
  id: string;
  name: string;
  folder: string;
  lastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasActiveLease: boolean;
};

export type PendingVaultApproval = {
  id: string;
  agentId: string;
  secretName: string;
  purpose: string;
  requestedAt: string;
};

// ─── Gmail / Calendar / GitHub (API Worker Types) ───────────────────────────

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body?: string;
};

export type GmailDraft = {
  id: string;
  message: GmailMessage;
};

export type APIWorkerStatus = {
  name: string;
  isRunning: boolean;
  lastPollAt: string | null;
  errorCount: number;
  consecutiveErrors: number;
};

export type GitHubNotification = {
  id: string;
  reason: string;
  subject: { title: string; url: string; type: string };
  repository: { full_name: string };
  updated_at: string;
  unread: boolean;
};

export type GitHubPR = {
  number: number;
  title: string;
  state: string;
  user: string;
  base: string;
  head: string;
  mergeable: boolean | null;
  reviewDecision?: string;
  url: string;
};

export type GitHubIssue = {
  number: number;
  title: string;
  state: string;
  user: string;
  labels: string[];
  assignees: string[];
  url: string;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: Array<{ email: string; responseStatus: string }>;
  status: string;
  htmlLink: string;
};

export type CalendarEventCreate = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string }>;
};
