import React, { useState } from 'react';

// ---- Agent data matching mockup exactly -------------------------------------

interface AgentMeta {
  label: string;
  attention?: boolean;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  avatarBg: string;
  role: string;
  status: 'active' | 'idle' | 'blocked' | 'offline';
  task: string;
  meta: AgentMeta[];
  isCommander?: boolean;
}

const SECTIONS: Array<{ label: string; agents: Agent[] }> = [
  {
    label: 'Orchestration',
    agents: [
      {
        id: 'aegilume', name: 'CD \u2014 Chief of Staff', emoji: '\u{1F9E0}',
        avatarBg: 'var(--accent-bg)', role: 'Strategic Orchestrator \u00B7 claude-opus-4.6',
        status: 'active', task: 'Routing morning triage \u00B7 5 dispatches pending',
        meta: [{ label: '12 tasks managed' }, { label: '2 need Christian', attention: true }, { label: '47 actions today' }],
        isCommander: true,
      },
    ],
  },
  {
    label: 'Communications',
    agents: [
      { id: 'aria', name: 'Karoline', emoji: '\u{1F6E1}\uFE0F', avatarBg: '#5e1f2d', role: 'Comms Commander', status: 'active', task: 'Triaging 12 emails', meta: [{ label: '3 drafts pending', attention: true }, { label: '2m ago' }] },
      { id: 'iris', name: 'Iris', emoji: '\u{1F308}', avatarBg: '#1f4e5e', role: 'Channel Aggregator', status: 'active', task: 'Polling Gmail, iMessage', meta: [{ label: '0 inbound' }, { label: '30s ago' }] },
      { id: 'hermes', name: 'Hermes', emoji: '\u{1F4E1}', avatarBg: '#1f5e3d', role: 'People Intelligence', status: 'active', task: 'Updating Lynn risk score', meta: [{ label: '2 alerts', attention: true }, { label: '1m ago' }] },
    ],
  },
  {
    label: 'Scheduling & Finance',
    agents: [
      { id: 'helios', name: 'Kronos', emoji: '\u23F3', avatarBg: '#5e4e1f', role: 'Calendar', status: 'idle', task: 'Next sync: 5m', meta: [{ label: '2 prep briefs' }, { label: '8m ago' }] },
      { id: 'felix', name: 'Marcus', emoji: '\u{1F3DB}\uFE0F', avatarBg: '#1f3d5e', role: 'Finance', status: 'blocked', task: 'Awaiting invoice data', meta: [{ label: '1 review', attention: true }, { label: '3h ago' }] },
    ],
  },
  {
    label: 'Knowledge & Learning',
    agents: [
      { id: 'clio', name: 'Ada', emoji: '\u{1F52E}', avatarBg: '#3d1f5e', role: 'Notes & Knowledge', status: 'active', task: 'Processing 2 Fireflies recaps', meta: [{ label: '5 action items' }, { label: '4m ago' }] },
      { id: 'atlas', name: 'Hypatia', emoji: '\u{1F4E1}', avatarBg: '#2d2d5e', role: 'Research', status: 'offline', task: 'Not deployed', meta: [{ label: '\u2014' }] },
      { id: 'socrates', name: 'Socrates', emoji: '\u{1F3DB}\uFE0F', avatarBg: '#4e2d1f', role: 'Learning Coach', status: 'offline', task: 'Not deployed', meta: [{ label: '\u2014' }] },
    ],
  },
  {
    label: 'Personal & Operations',
    agents: [
      { id: 'vesta', name: 'Vesta', emoji: '\u{1F3E0}', avatarBg: '#5e3d1f', role: 'Personal Agent', status: 'active', task: 'Searching Nashville flights', meta: [{ label: '1 action', attention: true }, { label: '12m ago' }] },
      { id: 'juno', name: 'Argus', emoji: '\u{1F441}\uFE0F', avatarBg: '#1f2d5e', role: 'Project Management', status: 'idle', task: 'Monitoring 4 projects', meta: [{ label: '0 alerts' }, { label: '5m ago' }] },
      { id: 'kairos', name: 'Kairos', emoji: '\u23F1\uFE0F', avatarBg: '#5e1f4e', role: 'Urgent Ops', status: 'idle', task: 'No deadlines imminent', meta: [{ label: '\u2014' }] },
      { id: 'boswell', name: 'Boswell', emoji: '\u{1F4DC}', avatarBg: '#2d5e2d', role: 'Documentation', status: 'offline', task: 'Not deployed', meta: [{ label: '\u2014' }] },
    ],
  },
  {
    label: 'Build & Deployment',
    agents: [
      { id: 'graphx', name: 'Vulcan', emoji: '\u{1F525}', avatarBg: '#5e2d1f', role: 'Build & Deploy', status: 'blocked', task: 'Waiting on CI runner', meta: [{ label: '1 blocked', attention: true }, { label: '2h ago' }] },
      { id: 'echo', name: 'Sentinel', emoji: '\u{1F4E1}', avatarBg: '#1f2d5e', role: 'Monitoring & Alerting', status: 'active', task: 'Watching 3 pipelines', meta: [{ label: '0 alerts' }, { label: '1m ago' }] },
    ],
  },
];

const ALL_AGENTS = SECTIONS.flatMap((s) => s.agents);

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--green)', idle: 'var(--yellow)', blocked: 'var(--red)', offline: 'var(--muted)',
};

// ---- AgentsView -------------------------------------------------------------

export function AgentsView() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const stats = [
    { label: 'Active', count: ALL_AGENTS.filter((a) => a.status === 'active').length, color: 'var(--green)' },
    { label: 'Idle', count: ALL_AGENTS.filter((a) => a.status === 'idle').length, color: 'var(--yellow)' },
    { label: 'Blocked', count: ALL_AGENTS.filter((a) => a.status === 'blocked').length, color: 'var(--red)' },
    { label: 'Offline', count: ALL_AGENTS.filter((a) => a.status === 'offline').length, color: 'var(--muted)' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Agent Roster</h1>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {ALL_AGENTS.length} agents &middot; {ALL_AGENTS.filter((a) => a.status === 'active').length} active &middot; Last sync 30s ago
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            {stats.map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--muted)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(241,245,249,0.08)' }}>
              {section.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {section.agents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: agent.isCommander ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: '10px', padding: '14px 16px', cursor: 'pointer',
                    gridColumn: agent.isCommander ? '1 / -1' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: agent.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      {agent.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{agent.name}</span>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: STATUS_COLORS[agent.status], flexShrink: 0 }} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{agent.role}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '6px' }}>{agent.task}</div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {agent.meta.map((m, i) => (
                          <span key={i} style={{ fontSize: '11px', color: m.attention ? 'var(--yellow)' : 'var(--muted)', fontWeight: m.attention ? 600 : 400 }}>{m.label}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Right detail panel */}
      {selectedAgent ? (
        <div style={{ width: '360px', flexShrink: 0, borderLeft: '1px solid var(--border)', backgroundColor: 'var(--bg-mid)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => setSelectedAgent(null)} style={{ alignSelf: 'flex-end', background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}>{'\u2715'}</button>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: selectedAgent.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>{selectedAgent.emoji}</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                {selectedAgent.name}
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: STATUS_COLORS[selectedAgent.status] }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{selectedAgent.role}</div>
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Current Task</div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{selectedAgent.task}</div>
          </div>
          <div style={{ padding: '0 20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Activity</div>
            {selectedAgent.meta.map((m, i) => (
              <div key={i} style={{ fontSize: '12px', color: m.attention ? 'var(--yellow)' : 'var(--text-2)', padding: '4px 0' }}>{m.label}</div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ width: '360px', flexShrink: 0, borderLeft: '1px solid var(--border)', backgroundColor: 'var(--bg-mid)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <span style={{ fontSize: '28px' }}>{'\u{1F9E0}'}</span>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Select an agent to view details</span>
        </div>
      )}
    </div>
  );
}
