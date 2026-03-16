// ─── Shared types for the AI router ──────────────────────────────────────────

export type ModelProvider = 'anthropic' | 'openai' | 'google';

export type ReasoningLevel = 'low' | 'medium' | 'high';

/** Matches ChatEvent wire format from apps/openclaw-shell/src/shared/types.ts */
export type ChatEvent = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: unknown;
  errorMessage?: string;
  usage?: ChatUsage;
  stopReason?: string;
};

export type ChatUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
};

export type ChatRequest = {
  runId: string;
  sessionKey: string;
  messages: ChatMessage[];
  model: string;
  provider: ModelProvider;
  reasoningLevel?: ReasoningLevel;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
  systemPrompt?: string;
  stream?: boolean;
};

export type AgentRouteConfig = {
  defaultModel: string;
  fallbackModel?: string | null;
  modelProvider: ModelProvider;
  reasoningLevel?: ReasoningLevel | null;
  canSpawnSubagents?: boolean;
  subagentModel?: string | null;
  subagentMaxDepth?: number | null;
};

export type ProviderAuthConfig = {
  anthropicApiKey?: string;
  openaiApiKey?: string;       // API key OR loaded from ~/.codex/auth.json OAuth token
  googleApiKey?: string;
};

export type RateLimitState = {
  provider: ModelProvider;
  retryAfter?: number;         // ms until retry allowed
  lastError?: string;
};
