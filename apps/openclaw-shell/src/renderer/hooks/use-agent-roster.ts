import { useMemo } from 'react';
import { useAgents } from './use-agents';

export type AgentRosterStatus = 'active' | 'idle' | 'offline' | 'unknown';

export const AGENT_STATUS_COLORS: Record<AgentRosterStatus, string> = {
  active: '#2ecc71',
  idle: '#e0c875',
  offline: '#94a3b8',
  unknown: 'var(--muted)',
};

export const AGENT_STATUS_LABELS: Record<AgentRosterStatus, string> = {
  active: 'Online',
  idle: 'Idle',
  offline: 'Offline',
  unknown: 'Unavailable',
};

type RuntimeAgentRecord = Record<string, unknown>;

const ROSTER_SECTION_ORDER = [
  'Orchestration',
  'Communications',
  'Scheduling & Finance',
  'Knowledge & Learning',
  'Personal & Operations',
  'Build & Verification',
] as const;

export interface AgentRosterProfile {
  id: string;
  name: string;
  emoji: string;
  avatarBg: string;
  role: string;
  department: string;
  capability: string;
  isCommander?: boolean;
}

export interface AgentRosterEntry extends AgentRosterProfile {
  status: AgentRosterStatus;
  statusLabel: string;
  statusColor: string;
  lastSeen?: string;
  currentTask: string | null;
  currentTaskUpdatedAt: string | null;
  boundServices: string[];
}

const ROSTER_BASE: AgentRosterProfile[] = [
  {
    id: 'cd',
    name: 'CD — Chief of Staff',
    emoji: '🧠',
    avatarBg: 'rgba(163,134,42,0.2)',
    role: 'Strategic Orchestrator',
    department: 'Orchestration',
    capability: 'Coordinates live agent handoffs and overall workflow state.',
    isCommander: true,
  },
  {
    id: 'karoline',
    name: 'Karoline',
    emoji: '🛡️',
    avatarBg: '#5e1f2d',
    role: 'Comms Commander',
    department: 'Communications',
    capability: 'Manages email and communications coordination channels.',
  },
  {
    id: 'iris',
    name: 'Iris',
    emoji: '🌈',
    avatarBg: '#1f4e5e',
    role: 'Channel Aggregator',
    department: 'Communications',
    capability: 'Aggregates inbound messaging and channel activity.',
  },
  {
    id: 'hermes',
    name: 'Hermes',
    emoji: '📡',
    avatarBg: '#1f5e3d',
    role: 'People Intelligence',
    department: 'Communications',
    capability: 'Tracks relationships and contact-level follow-up context.',
  },
  {
    id: 'kronos',
    name: 'Kronos',
    avatarBg: '#5e4e1f',
    emoji: '⏳',
    role: 'Calendar',
    department: 'Scheduling & Finance',
    capability: 'Manages calendars, prep, and schedule quality-of-life routines.',
  },
  {
    id: 'marcus',
    name: 'Marcus',
    emoji: '🏛️',
    avatarBg: '#1f3d5e',
    role: 'Finance',
    department: 'Scheduling & Finance',
    capability: 'Tracks budgets, invoices, and finance-related summaries.',
  },
  {
    id: 'ada',
    name: 'Ada',
    emoji: '🔮',
    avatarBg: '#3d1f5e',
    role: 'Knowledge',
    department: 'Knowledge & Learning',
    capability: 'Maintains notes, knowledge capture, and recall summaries.',
  },
  {
    id: 'hypatia',
    name: 'Hypatia',
    emoji: '📡',
    avatarBg: '#2d2d5e',
    role: 'Research',
    department: 'Knowledge & Learning',
    capability: 'Performs deeper research and context aggregation.',
  },
  {
    id: 'socrates',
    name: 'Socrates',
    emoji: '🏛️',
    avatarBg: '#4e2d1f',
    role: 'Learning Coach',
    department: 'Knowledge & Learning',
    capability: 'Tracks learning progress and skill growth targets.',
  },
  {
    id: 'vesta',
    name: 'Vesta',
    emoji: '🏠',
    avatarBg: '#5e3d1f',
    role: 'Personal',
    department: 'Personal & Operations',
    capability: 'Monitors personal and family tasks with bounded context.',
  },
  {
    id: 'boswell',
    name: 'Boswell',
    emoji: '📜',
    avatarBg: '#2d5e2d',
    role: 'Shadow Logger',
    department: 'Personal & Operations',
    capability: 'Maintains activity logs and decision trails.',
  },
  {
    id: 'argus',
    name: 'Argus',
    emoji: '👁️',
    avatarBg: '#1f2d5e',
    role: 'Operations',
    department: 'Personal & Operations',
    capability: 'Tracks configuration state and operational readiness.',
  },
  {
    id: 'kairos',
    name: 'Kairos',
    emoji: '⏱️',
    avatarBg: '#5e1f4e',
    role: 'Urgent Ops',
    department: 'Personal & Operations',
    capability: 'Prioritizes time-sensitive escalations and urgent work.',
  },
  {
    id: 'vulcan',
    name: 'Vulcan',
    emoji: '🔥',
    avatarBg: '#5e2d1f',
    role: 'Build',
    department: 'Build & Verification',
    capability: 'Oversees pipelines, PR flow, and software quality cadence.',
  },
  {
    id: 'themis',
    name: 'Themis',
    emoji: '⚖️',
    avatarBg: '#2d5e2d',
    role: 'Verification',
    department: 'Build & Verification',
    capability: 'Supports quality, validation, and compliance checks.',
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    emoji: '📡',
    avatarBg: '#1f2d5e',
    role: 'Monitoring & Alerting',
    department: 'Build & Verification',
    capability: 'Monitors uptime, alerts, and runtime anomalies.',
  },
];

function toString(value: unknown): string | null {
  if (typeof value === 'string') {
    const text = value.trim();
    return text.length > 0 ? text : null;
  }
  return null;
}

function asRecord(value: unknown): RuntimeAgentRecord | null {
  return value && typeof value === 'object' ? (value as RuntimeAgentRecord) : null;
}

function readNestedText(value: unknown): string | null {
  const direct = toString(value);
  if (direct) return direct;

  const obj = asRecord(value);
  if (!obj) return null;

  return (
    toString(obj.label) ||
    toString(obj.text) ||
    toString(obj.summary) ||
    toString(obj.message) ||
    toString(obj.title) ||
    null
  );
}

function readTextFromRecord(record: RuntimeAgentRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const result = readNestedText(record[key]);
    if (result) return result;
  }
  return null;
}

function asDateString(value: unknown): string | null {
  const text = toString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readDateFromRecord(record: RuntimeAgentRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const result = asDateString(record[key]);
    if (result) return result;
  }
  return null;
}

function inferStatus(raw: RuntimeAgentRecord | null): AgentRosterStatus {
  const state = toString(raw?.state) || toString(raw?.health) || toString(raw?.status);
  if (state) {
    const normalized = state.toLowerCase();
    if (['healthy', 'active', 'online', 'running', 'ready'].includes(normalized)) return 'active';
    if (['idle', 'waiting'].includes(normalized)) return 'idle';
    if (['missing', 'offline', 'stopped', 'down', 'unknown', 'error', 'disabled', 'absent'].includes(normalized)) {
      return 'offline';
    }
  }

  if (raw) {
    if (typeof raw.online === 'boolean') {
      if (raw.online) return 'active';
      if (toString(raw.lastSeen)) return 'idle';
      return 'offline';
    }
  }

  return raw ? 'offline' : 'unknown';
}

function resolveCurrentTask(raw: RuntimeAgentRecord | null): string | null {
  return readTextFromRecord(raw, [
    'currentTask',
    'task',
    'currentTaskSummary',
    'taskSummary',
    'statusMessage',
    'currentTaskDescription',
    'taskDescription',
  ]);
}

function resolveCurrentTaskUpdatedAt(raw: RuntimeAgentRecord | null): string | null {
  return readDateFromRecord(raw, [
    'currentTaskUpdatedAt',
    'taskUpdatedAt',
    'taskUpdated',
    'updatedAt',
    'updated',
    'lastUpdatedAt',
    'lastSeen',
  ]);
}

function resolveLastSeen(raw: RuntimeAgentRecord | null): string | undefined {
  const seen = toString(raw?.lastSeen);
  return seen ?? undefined;
}

function resolveBoundServices(raw: RuntimeAgentRecord | null): string[] {
  if (!raw) return [];
  const services = raw.boundServices;
  if (!Array.isArray(services)) return [];
  return services.filter((svc): svc is string => typeof svc === 'string');
}

export interface AgentRosterSection {
  label: string;
  agents: AgentRosterEntry[];
}

export function useAgentRoster() {
  const { agents, loading, error } = useAgents();

  const byId = useMemo(() => {
    const map = new Map<string, RuntimeAgentRecord | null>();
    for (const item of agents) {
      map.set(item.agentId, item as RuntimeAgentRecord);
    }
    return map;
  }, [agents]);

  const roster = useMemo<AgentRosterEntry[]>(() => {
    return ROSTER_BASE.map((base) => {
      const raw = byId.get(base.id) ?? null;
      const status = inferStatus(loading || error !== null ? null : raw);
      const currentTask = raw ? resolveCurrentTask(raw) : null;
      const currentTaskUpdatedAt = raw ? resolveCurrentTaskUpdatedAt(raw) : null;

      return {
        ...base,
        status,
        statusLabel: AGENT_STATUS_LABELS[status],
        statusColor: AGENT_STATUS_COLORS[status],
        lastSeen: resolveLastSeen(raw),
        currentTask: currentTask,
        currentTaskUpdatedAt,
        boundServices: resolveBoundServices(raw),
      };
    });
  }, [byId, loading, error]);

  const sections = useMemo<AgentRosterSection[]>(() => {
    const grouped: AgentRosterSection[] = ROSTER_SECTION_ORDER.map((label) => ({
      label,
      agents: [],
    }));

    for (const agent of roster) {
      const section = grouped.find((item) => item.label === agent.department);
      if (section) {
        section.agents.push(agent);
      }
    }

    return grouped;
  }, [roster]);

  const counts = useMemo(() => {
    let active = 0;
    let idle = 0;
    let offline = 0;
    for (const agent of roster) {
      if (agent.status === 'active') active += 1;
      else if (agent.status === 'idle') idle += 1;
      else offline += 1;
    }
    return { active, idle, offline };
  }, [roster]);

  const hasRuntimeData = !loading && error === null;

  return {
    sections,
    agents: roster,
    counts,
    loading,
    error,
    hasRuntimeData,
    getAgentById: (id: string) => roster.find((agent) => agent.id === id),
    sectionOrder: ROSTER_SECTION_ORDER,
  };
}

export function formatAgentTimestamp(value: string | null): string {
  if (!value) return 'No timestamp';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
