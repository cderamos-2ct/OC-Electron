// ─── Gateway Connection ─────────────────────────────────────────────────────

export type GatewayConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'error';

export type GatewayConfig = {
  url: string;
  clientName: string;
  reconnectInterval?: number;
};

// ─── Wire Protocol Frames ───────────────────────────────────────────────────

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
  authMode?: 'none' | 'token' | 'password' | 'trusted-proxy';
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
  state: 'delta' | 'final' | 'aborted' | 'error';
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

// ─── Event Map ──────────────────────────────────────────────────────────────

export type GatewayEventMap = {
  'connect.challenge': { nonce: string };
  'agent': unknown;
  'chat': ChatEvent;
  'loopback': LoopbackEvent;
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
  'cd.action.request': { action: import('./cd-actions.js').CDAction };
  'cd.action.result': { actionId: string; result: import('./cd-actions.js').CDActionResult };
};

export type GatewayEventName = keyof GatewayEventMap;

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
  status: 'running' | 'success' | 'error';
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

// ─── RPC Method Map ─────────────────────────────────────────────────────────

import type { AgentsListResult, AgentSummary, AgentSendParams } from './agents.js';
import type { SessionsListParams, SessionSummary, SessionsPatchParams } from './sessions.js';

export type RPCMethodMap = {
  // Health & Status
  'health': [void, HealthStatus];
  'status': [void, unknown];
  'usage.status': [void, unknown];
  'usage.cost': [void, unknown];

  // Chat
  'chat.send': [ChatSendParams, { runId: string }];
  'chat.history': [{ sessionKey: string; limit?: number }, unknown[]];
  'chat.abort': [ChatAbortParams, void];

  // Agents
  'agents.list': [void, AgentsListResult];
  'agents.create': [Partial<AgentSummary>, AgentSummary];
  'agents.update': [Partial<AgentSummary> & { id: string }, AgentSummary];
  'agents.delete': [{ id: string }, void];

  // Sessions
  'sessions.list': [SessionsListParams | void, SessionSummary[]];
  'sessions.preview': [{ key: string }, unknown];
  'sessions.patch': [SessionsPatchParams, void];
  'sessions.reset': [{ key: string }, void];
  'sessions.delete': [{ key: string }, void];
  'sessions.compact': [{ key: string }, void];

  // Models
  'models.list': [void, ModelChoice[]];

  // TTS
  'tts.status': [void, TTSStatus];
  'tts.providers': [void, TTSProviderInfo[]];
  'tts.enable': [void, void];
  'tts.disable': [void, void];
  'tts.setProvider': [{ provider: string; voice?: string }, void];
  'tts.convert': [{ text: string }, { audio: string }];

  // Nodes
  'node.list': [void, NodeInfo[]];
  'node.describe': [{ nodeId: string }, NodeInfo];
  'node.rename': [{ nodeId: string; displayName: string }, void];
  'node.invoke': [NodeInvokeParams, unknown];

  // Device pairing
  'device.pair.list': [void, DeviceInfo[]];
  'device.pair.approve': [{ deviceId: string }, void];
  'device.pair.reject': [{ deviceId: string }, void];
  'device.pair.remove': [{ deviceId: string }, void];

  // Skills
  'skills.status': [void, { skills: SkillInfo[]; workspaceDir?: string; managedSkillsDir?: string }];
  'skills.bins': [void, SkillBin[]];
  'skills.install': [{ id: string }, void];
  'skills.update': [{ id: string }, void];

  // Channels
  'channels.status': [void, ChannelsStatusResult];
  'channels.logout': [{ id: string }, void];

  // Web Login
  'web.login.start': [{ id?: string } | void, { qrDataUrl: string; message?: string }];
  'web.login.wait': [{ timeoutMs?: number } | void, { connected: boolean; message?: string }];

  // Cron
  'cron.list': [void, CronJob[]];
  'cron.status': [void, unknown];
  'cron.add': [Omit<CronJob, 'id' | 'lastRun' | 'nextRun' | 'lastResult'>, CronJob];
  'cron.update': [Partial<CronJob> & { id: string }, CronJob];
  'cron.remove': [{ id: string }, void];
  'cron.run': [{ id: string }, CronRunResult];
  'cron.runs': [{ id: string; limit?: number }, CronRunResult[]];

  // Config
  'config.get': [{ key?: string } | void, ConfigEntry | ConfigEntry[]];
  'config.set': [{ key: string; value: unknown }, void];
  'config.schema': [void, unknown];

  // Logs
  'logs.tail': [{ lines?: number; filter?: string } | void, string[]];

  // Talk mode
  'talk.config': [void, unknown];
  'talk.mode': [{ enabled: boolean }, void];

  // Voicewake
  'voicewake.get': [void, { enabled: boolean; keyword?: string }];
  'voicewake.set': [{ enabled: boolean; keyword?: string }, void];
};

export type RPCParams<M extends keyof RPCMethodMap> = RPCMethodMap[M][0];
export type RPCResult<M extends keyof RPCMethodMap> = RPCMethodMap[M][1];
