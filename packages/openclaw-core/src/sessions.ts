// ─── Session Types ──────────────────────────────────────────────────────────

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
  responseUsage?: 'off' | 'tokens' | 'full' | 'on' | null;
  elevatedLevel?: string | null;
  execHost?: string | null;
  execSecurity?: string | null;
  execAsk?: string | null;
  execNode?: string | null;
  model?: string | null;
  spawnedBy?: string | null;
  spawnDepth?: number | null;
  sendPolicy?: 'allow' | 'deny' | null;
  groupActivation?: 'mention' | 'always' | null;
};

export type WorkerSessionGroup = {
  groupId: string;
  label: string;
  parentType: 'agent' | 'task' | 'system';
  parentAgentId?: string | null;
  parentTaskId?: string | null;
  sessionKeys: string[];
  latestSessionAt?: number | null;
  status?: string;
  latestSummary?: string | null;
  sessions: SessionSummary[];
};
