import React, { useState } from 'react';
import { useAgents } from '../../hooks/use-agents';
import { invoke } from '../../lib/ipc-client';

// ---- Static display catalogue -----------------------------------------------
// Defines names, emojis, roles, departments, and fallback task text.
// Live status (online/idle/offline) is overlaid from useAgents() at render time.

interface AgentMeta {
  label: string;
  attention?: boolean;
}

interface AgentDisplay {
  id: string;
  name: string;
  emoji: string;
  avatarBg: string;
  role: string;
  fallbackTask: string;
  meta: AgentMeta[];
  isCommander?: boolean;
}

const SECTIONS: Array<{ label: string; agents: AgentDisplay[] }> = [
  {
    label: 'Orchestration',
    agents: [
      {
        id: 'aegilume', name: 'CD \u2014 Chief of Staff', emoji: '\u{1F9E0}',
        avatarBg: 'rgba(163,134,42,0.2)', role: 'Strategic Orchestrator \u00B7 claude-opus-4.6',
        fallbackTask: 'Routing morning triage \u00B7 5 dispatches pending',
        meta: [{ label: '12 tasks managed' }, { label: '2 need Christian', attention: true }, { label: '47 actions today' }],
        isCommander: true,
      },
    ],
  },
  {
    label: 'Communications',
    agents: [
      { id: 'aria', name: 'Karoline', emoji: '\u{1F6E1}\uFE0F', avatarBg: '#5e1f2d', role: 'Comms Commander', fallbackTask: 'Triaging 12 emails', meta: [{ label: '3 drafts pending', attention: true }, { label: '2m ago' }] },
      { id: 'iris', name: 'Iris', emoji: '\u{1F308}', avatarBg: '#1f4e5e', role: 'Channel Aggregator', fallbackTask: 'Polling Gmail, iMessage', meta: [{ label: '0 inbound' }, { label: '30s ago' }] },
      { id: 'hermes', name: 'Hermes', emoji: '\u{1F4E1}', avatarBg: '#1f5e3d', role: 'People Intelligence', fallbackTask: 'Updating Lynn risk score', meta: [{ label: '2 alerts', attention: true }, { label: '1m ago' }] },
    ],
  },
  {
    label: 'Scheduling & Finance',
    agents: [
      { id: 'helios', name: 'Kronos', emoji: '\u23F3', avatarBg: '#5e4e1f', role: 'Calendar', fallbackTask: 'Next sync: 5m', meta: [{ label: '2 prep briefs' }, { label: '8m ago' }] },
      { id: 'felix', name: 'Marcus', emoji: '\u{1F3DB}\uFE0F', avatarBg: '#1f3d5e', role: 'Finance', fallbackTask: 'Awaiting invoice data', meta: [{ label: '1 review', attention: true }, { label: '3h ago' }] },
    ],
  },
  {
    label: 'Knowledge & Learning',
    agents: [
      { id: 'clio', name: 'Ada', emoji: '\u{1F52E}', avatarBg: '#3d1f5e', role: 'Notes & Knowledge', fallbackTask: 'Processing 2 Fireflies recaps', meta: [{ label: '5 action items' }, { label: '4m ago' }] },
      { id: 'atlas', name: 'Hypatia', emoji: '\u{1F4E1}', avatarBg: '#2d2d5e', role: 'Research', fallbackTask: 'Not deployed', meta: [{ label: '\u2014' }] },
      { id: 'socrates', name: 'Socrates', emoji: '\u{1F3DB}\uFE0F', avatarBg: '#4e2d1f', role: 'Learning Coach', fallbackTask: 'Not deployed', meta: [{ label: '\u2014' }] },
    ],
  },
  {
    label: 'Personal & Operations',
    agents: [
      { id: 'vesta', name: 'Vesta', emoji: '\u{1F3E0}', avatarBg: '#5e3d1f', role: 'Personal & Family', fallbackTask: 'Monitoring family calendar', meta: [{ label: '1 trip pending', attention: true }, { label: '15m ago' }] },
      { id: 'boswell', name: 'Boswell', emoji: '\u{1F4DC}', avatarBg: '#2d5e2d', role: 'Shadow Logger', fallbackTask: 'Recording activity stream', meta: [{ label: '142 events today' }, { label: '0s ago' }] },
      { id: 'juno', name: 'Argus', emoji: '\u{1F441}\uFE0F', avatarBg: '#1f2d5e', role: 'Operations', fallbackTask: 'Config hardening review', meta: [{ label: 'All green' }, { label: '1m ago' }] },
      { id: 'kairos', name: 'Kairos', emoji: '\u23F1\uFE0F', avatarBg: '#5e1f4e', role: 'Urgent Ops', fallbackTask: 'No deadlines imminent', meta: [{ label: '\u2014' }] },
    ],
  },
  {
    label: 'Build & Verification',
    agents: [
      { id: 'graphx', name: 'Vulcan', emoji: '\u{1F525}', avatarBg: '#5e2d1f', role: 'Build', fallbackTask: 'Idle \u2014 awaiting dispatch', meta: [{ label: '3 PRs merged today' }] },
      { id: 'themis', name: 'Themis', emoji: '\u2696\uFE0F', avatarBg: '#2d5e2d', role: 'Verification', fallbackTask: 'Not deployed', meta: [{ label: '\u2014' }] },
      { id: 'echo', name: 'Sentinel', emoji: '\u{1F4E1}', avatarBg: '#1f2d5e', role: 'Monitoring & Alerting', fallbackTask: 'Watching 3 pipelines', meta: [{ label: '0 alerts' }, { label: '1m ago' }] },
    ],
  },
];

const ALL_DISPLAY_AGENTS = SECTIONS.flatMap((s) => s.agents);

// Map agentId -> department label for display in modal
const AGENT_DEPARTMENT: Record<string, string> = {};
SECTIONS.forEach((s) => s.agents.forEach((a) => { AGENT_DEPARTMENT[a.id] = s.label; }));

// Brief capability descriptions shown in the Hire modal
const AGENT_CAPABILITIES: Record<string, string> = {
  aegilume: 'Strategic orchestration and task routing across all departments.',
  aria: 'Email triage, drafting, and communications command.',
  iris: 'Multi-channel aggregation — Gmail, iMessage, and more.',
  hermes: 'People intelligence and relationship risk tracking.',
  helios: 'Calendar management and meeting prep briefs.',
  felix: 'Invoice tracking, budget reviews, and financial oversight.',
  clio: 'Notes, knowledge capture, and Fireflies meeting recaps.',
  atlas: 'Deep research and competitive intelligence.',
  socrates: 'Personalised learning coaching and skill development.',
  vesta: 'Personal and family calendar monitoring.',
  boswell: 'Continuous shadow logging of your activity stream.',
  juno: 'Operational config hardening and system health.',
  kairos: 'Urgent deadline tracking and time-critical operations.',
  graphx: 'Build pipeline management and PR oversight.',
  themis: 'Code verification, review, and quality assurance.',
  echo: 'Pipeline monitoring and alerting.',
};

// ---- HireAgentModal ---------------------------------------------------------

interface HireAgentModalProps {
  offlineAgents: AgentDisplay[];
  hiringIds: Set<string>;
  onHire: (agentId: string) => void;
  onClose: () => void;
}

function HireAgentModal({ offlineAgents, hiringIds, onHire, onClose }: HireAgentModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          width: '520px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
              Hire an Agent
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Enable additional agents to expand your team&apos;s capabilities
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0 4px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {'\u2715'}
          </button>
        </div>

        {/* Agent list */}
        <div style={{ overflowY: 'auto', padding: '12px 24px 20px' }}>
          {offlineAgents.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>
              All agents are already active or initializing.
            </div>
          ) : (
            offlineAgents.map((agent) => {
              const isHiring = hiringIds.has(agent.id);
              return (
                <div
                  key={agent.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(241,245,249,0.07)',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: agent.avatarBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    flexShrink: 0,
                  }}>
                    {agent.emoji}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{agent.name}</span>
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--muted)',
                        background: 'rgba(241,245,249,0.08)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}>
                        {AGENT_DEPARTMENT[agent.id]}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>{agent.role}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                      {AGENT_CAPABILITIES[agent.id] ?? 'Specialized agent capability.'}
                    </div>
                  </div>

                  {/* Hire button */}
                  <button
                    onClick={() => onHire(agent.id)}
                    disabled={isHiring}
                    style={{
                      flexShrink: 0,
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isHiring ? 'rgba(163,134,42,0.25)' : 'var(--accent)',
                      color: isHiring ? 'var(--muted)' : '#000',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: isHiring ? 'default' : 'pointer',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {isHiring ? 'Initializing\u2026' : 'Hire'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Status derived from live hook data
type DerivedStatus = 'active' | 'idle' | 'offline';

const STATUS_COLORS: Record<DerivedStatus, string> = {
  active: '#2ecc71',
  idle: '#e0c875',
  offline: '#94a3b8',
};

const STATUS_LABELS: Record<DerivedStatus, string> = {
  active: 'Online',
  idle: 'Idle',
  offline: 'Offline',
};

// ---- AgentsView -------------------------------------------------------------

export function AgentsView() {
  const { agents: liveAgents } = useAgents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [hiringIds, setHiringIds] = useState<Set<string>>(new Set());

  // Derive per-agent status from hook: online=active, seen recently=idle, else offline
  function getStatus(agentId: string): DerivedStatus {
    const live = liveAgents.find((a) => a.agentId === agentId);
    if (!live) return 'offline';
    if (live.online) return 'active';
    if (live.lastSeen) return 'idle';
    return 'offline';
  }

  async function handleHire(agentId: string) {
    setHiringIds((prev) => new Set(prev).add(agentId));
    try {
      await invoke('gateway:rpc', 'agents.enable', { agentId });
    } catch (err) {
      console.warn('[AgentsView] Failed to hire agent:', agentId, err);
      setHiringIds((prev) => { const next = new Set(prev); next.delete(agentId); return next; });
    }
  }

  // Agents that are offline and not currently being hired — candidates for the modal
  const offlineAgents = ALL_DISPLAY_AGENTS.filter(
    (a) => getStatus(a.id) === 'offline' && !hiringIds.has(a.id),
  );

  const loading = liveAgents.length === 0;

  // Count stats across all display agents using live data
  const activeCnt = ALL_DISPLAY_AGENTS.filter((a) => getStatus(a.id) === 'active').length;
  const idleCnt = ALL_DISPLAY_AGENTS.filter((a) => getStatus(a.id) === 'idle').length;
  const offlineCnt = ALL_DISPLAY_AGENTS.filter((a) => getStatus(a.id) === 'offline').length;

  const selectedDisplay = ALL_DISPLAY_AGENTS.find((a) => a.id === selectedId) ?? null;
  const selectedLive = selectedId ? liveAgents.find((a) => a.agentId === selectedId) : null;

  const stats = [
    { label: 'Active', count: activeCnt, color: '#2ecc71' },
    { label: 'Idle', count: idleCnt, color: '#e0c875' },
    { label: 'Offline', count: offlineCnt, color: '#94a3b8' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Hire Agent modal */}
      {showHireModal && (
        <HireAgentModal
          offlineAgents={offlineAgents}
          hiringIds={hiringIds}
          onHire={handleHire}
          onClose={() => setShowHireModal(false)}
        />
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>Agent Roster</h1>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {ALL_DISPLAY_AGENTS.length} agents &middot; {activeCnt} active &middot; Last sync 30s ago
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {stats.map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
            <button
              onClick={() => setShowHireModal(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--accent)',
                background: 'transparent',
                color: 'var(--accent)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Hire Agent
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
            Loading agent roster...
          </div>
        )}

        {/* Sections */}
        {SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: '32px' }}>
            {/* Section label — matches mockup: Cinzel-style caps, 10px, 0.1em tracking */}
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--muted)',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid rgba(241,245,249,0.1)',
            }}>
              {section.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {section.agents.map((agent) => {
                const status = getStatus(agent.id);
                const isSelected = selectedId === agent.id;
                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedId(isSelected ? null : agent.id)}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: agent.isCommander
                        ? '1px solid rgba(163,134,42,0.35)'
                        : isSelected
                          ? '1px solid var(--accent)'
                          : '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '16px',
                      cursor: 'pointer',
                      gridColumn: agent.isCommander ? '1 / -1' : undefined,
                      display: 'flex',
                      gap: '14px',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: agent.avatarBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: agent.isCommander ? '20px' : '18px',
                      flexShrink: 0,
                    }}>
                      {agent.emoji}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name + status dot */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{agent.name}</span>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: STATUS_COLORS[status],
                          flexShrink: 0,
                        }} />
                      </div>
                      {/* Role */}
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>{agent.role}</div>
                      {/* Current task */}
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-2)',
                        marginBottom: '8px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {agent.fallbackTask}
                      </div>
                      {/* Meta chips */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        {agent.meta.map((m, i) => (
                          <span key={i} style={{
                            fontSize: '11px',
                            color: m.attention ? '#e0c875' : 'var(--muted)',
                            fontWeight: m.attention ? 600 : 400,
                          }}>
                            {m.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Right detail panel */}
      {selectedDisplay ? (
        <div style={{
          width: '340px',
          flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          backgroundColor: 'var(--bg-mid)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: selectedDisplay.avatarBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
              }}>
                {selectedDisplay.emoji}
              </div>
              <div>
                <div style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  {selectedDisplay.name}
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: STATUS_COLORS[getStatus(selectedDisplay.id)],
                  }} />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{selectedDisplay.role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '12px',
                color: STATUS_COLORS[getStatus(selectedDisplay.id)],
                fontWeight: 500,
              }}>
                {STATUS_LABELS[getStatus(selectedDisplay.id)]}
              </span>
              <button
                onClick={() => setSelectedId(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}
              >
                {'\u2715'}
              </button>
            </div>
          </div>

          {/* Current task */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '8px',
            }}>
              Current Task
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>{selectedDisplay.fallbackTask}</div>
          </div>

          {/* Assigned services */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '8px',
            }}>
              Assigned Services
            </div>
            {selectedLive && selectedLive.boundServices.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedLive.boundServices.map((svc) => (
                  <span key={svc} style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'rgba(241,245,249,0.08)',
                    color: 'var(--text-2)',
                    border: '1px solid var(--border)',
                  }}>
                    {svc}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>No services bound</div>
            )}
          </div>

          {/* Activity / meta */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '8px',
            }}>
              Activity
            </div>
            {selectedDisplay.meta.map((m, i) => (
              <div key={i} style={{
                fontSize: '12px',
                color: m.attention ? '#e0c875' : 'var(--text-2)',
                padding: '3px 0',
                fontWeight: m.attention ? 600 : 400,
              }}>
                {m.label}
              </div>
            ))}
          </div>

          {/* Last seen */}
          {selectedLive?.lastSeen && (
            <div style={{ padding: '16px 20px' }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '8px',
              }}>
                Last Seen
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {new Date(selectedLive.lastSeen).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          width: '340px',
          flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          backgroundColor: 'var(--bg-mid)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '28px' }}>{'\u{1F9E0}'}</span>
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Select an agent to view details</span>
        </div>
      )}
    </div>
  );
}
