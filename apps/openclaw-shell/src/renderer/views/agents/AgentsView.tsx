import React, { useState } from 'react';
import { Agent } from './AgentCard';
import { DepartmentGroup } from './DepartmentGroup';
import { AgentDetail } from './AgentDetail';
import { StatusStats } from './StatusStats';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ALL_AGENTS: Agent[] = [
  // Commander
  {
    id: 'cd',
    name: 'CD 🧠',
    emoji: '🧠',
    avatarBg: 'var(--accent-blue)',
    role: 'Commander · Orchestrates all agents',
    status: 'active',
    tasksActive: 7,
    messagesToday: 42,
    isCommander: true,
  },
  // Operations
  {
    id: 'karoline',
    name: 'Karoline',
    emoji: '🛡️',
    avatarBg: '#5e1f2d',
    role: 'Head of Security & Compliance',
    status: 'active',
    tasksActive: 3,
    messagesToday: 18,
  },
  {
    id: 'iris',
    name: 'Iris',
    emoji: '🌈',
    avatarBg: '#1f4e5e',
    role: 'Communications & Outreach',
    status: 'active',
    tasksActive: 5,
    messagesToday: 31,
  },
  {
    id: 'nova',
    name: 'Nova',
    emoji: '🧭',
    avatarBg: '#1f5e3d',
    role: 'Research & Strategy',
    status: 'idle',
    tasksActive: 1,
    messagesToday: 9,
  },
  {
    id: 'chronos',
    name: 'Chronos',
    emoji: '⏳',
    avatarBg: '#5e4e1f',
    role: 'Scheduling & Time Management',
    status: 'active',
    tasksActive: 4,
    messagesToday: 22,
  },
  // Intelligence
  {
    id: 'athena',
    name: 'Athena',
    emoji: '🏛️',
    avatarBg: '#1f3d5e',
    role: 'Knowledge & Learning',
    status: 'active',
    tasksActive: 2,
    messagesToday: 14,
  },
  {
    id: 'oracle',
    name: 'Oracle',
    emoji: '🔮',
    avatarBg: '#3d1f5e',
    role: 'Forecasting & Analytics',
    status: 'idle',
    tasksActive: 0,
    messagesToday: 5,
  },
  {
    id: 'socrates',
    name: 'Socrates',
    emoji: '🤔',
    avatarBg: '#4e2d1f',
    role: 'Decision Support & Reasoning',
    status: 'active',
    tasksActive: 3,
    messagesToday: 17,
  },
  // Production
  {
    id: 'hearth',
    name: 'Hearth',
    emoji: '🏠',
    avatarBg: '#5e3d1f',
    role: 'Infrastructure & Environment',
    status: 'active',
    tasksActive: 2,
    messagesToday: 11,
  },
  {
    id: 'scribe',
    name: 'Scribe',
    emoji: '📜',
    avatarBg: '#2d2d5e',
    role: 'Drafting & Documentation',
    status: 'active',
    tasksActive: 6,
    messagesToday: 28,
  },
  {
    id: 'vulcan',
    name: 'Vulcan',
    emoji: '🔥',
    avatarBg: '#5e2d1f',
    role: 'Build & Deployment',
    status: 'blocked',
    tasksActive: 1,
    messagesToday: 8,
  },
  // Governance
  {
    id: 'libra',
    name: 'Libra',
    emoji: '⚖️',
    avatarBg: '#2d5e2d',
    role: 'Finance & Legal Review',
    status: 'idle',
    tasksActive: 0,
    messagesToday: 4,
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    emoji: '📡',
    avatarBg: '#1f2d5e',
    role: 'Monitoring & Alerting',
    status: 'active',
    tasksActive: 3,
    messagesToday: 19,
  },
];

const DEPARTMENTS: { label: string; ids: string[] }[] = [
  { label: 'Commander', ids: ['cd'] },
  { label: 'Operations', ids: ['karoline', 'iris', 'nova', 'chronos'] },
  { label: 'Intelligence', ids: ['athena', 'oracle', 'socrates'] },
  { label: 'Production', ids: ['hearth', 'scribe', 'vulcan'] },
  { label: 'Governance', ids: ['libra', 'sentinel'] },
];

const STATS = [
  { label: 'Online', count: ALL_AGENTS.filter((a) => a.status === 'active').length, color: '#22c55e' },
  { label: 'Idle', count: ALL_AGENTS.filter((a) => a.status === 'idle').length, color: '#eab308' },
  { label: 'Blocked', count: ALL_AGENTS.filter((a) => a.status === 'blocked').length, color: '#ef4444' },
  { label: 'Offline', count: ALL_AGENTS.filter((a) => a.status === 'offline').length, color: '#525252' },
];

// ─── Main View ────────────────────────────────────────────────────────────────

export function AgentsView() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 40px',
          minWidth: 0,
        }}
      >
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 10px',
            }}
          >
            Agents
          </h1>
          <StatusStats stats={STATS} />
        </div>

        {/* Department sections */}
        {DEPARTMENTS.map((dept) => {
          const deptAgents = dept.ids
            .map((id) => ALL_AGENTS.find((a) => a.id === id))
            .filter(Boolean) as Agent[];

          return (
            <DepartmentGroup
              key={dept.label}
              label={dept.label}
              agents={deptAgents}
              onSelectAgent={setSelectedAgent}
            />
          );
        })}
      </div>

      {/* Right rail — Agent detail panel */}
      {selectedAgent ? (
        <AgentDetail agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      ) : (
        <div
          style={{
            width: 360,
            flexShrink: 0,
            borderLeft: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 28 }}>🧠</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select an agent to view details</span>
        </div>
      )}
    </div>
  );
}
