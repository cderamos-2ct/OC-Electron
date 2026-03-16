import React, { useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type CardVariant = 'approval' | 'urgent' | 'running' | 'queued' | 'done';
type BadgeVariant = 'approval' | 'blocked' | 'running' | 'queued' | 'done';

interface AgentTag {
  emoji: string;
  name: string;
}

interface TaskCardData {
  id: string;
  variant: CardVariant;
  avatarEmoji: string;
  avatarBg: string;
  taskId: string;
  badgeVariant: BadgeVariant;
  badgeLabel: string;
  title: string;
  description: string;
  agents: AgentTag[];
  agentSeparator?: 'arrow' | 'verified';
  time: string;
  actions?: Array<{ label: string; variant: 'primary' | 'secondary' | 'danger' }>;
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const TASKS: TaskCardData[] = [
  {
    id: 'ops-024',
    variant: 'approval',
    avatarEmoji: '🛡️',
    avatarBg: '#5e1f2d',
    taskId: 'OPS-024',
    badgeVariant: 'approval',
    badgeLabel: 'Approval',
    title: 'Draft reply to Sequoia partner email',
    description: 'Karoline drafted response — confirms March 21 meeting, references Q4 growth metrics. Tone: professional but warm.',
    agents: [{ emoji: '🛡️', name: 'Karoline' }],
    time: '8:44 AM',
    actions: [
      { label: 'Approve & Send', variant: 'primary' },
      { label: 'Edit tone', variant: 'secondary' },
    ],
  },
  {
    id: 'ops-019',
    variant: 'urgent',
    avatarEmoji: '🏛️',
    avatarBg: '#1f3d5e',
    taskId: 'OPS-019',
    badgeVariant: 'blocked',
    badgeLabel: 'Blocked',
    title: 'Budget approval needed for Q2 infrastructure',
    description: 'Marcus needs sign-off on $4,200 hosting upgrade. Breakdown attached. Hermes flagged — this vendor has been reliable.',
    agents: [{ emoji: '🏛️', name: 'Marcus' }],
    time: 'Yesterday',
    actions: [
      { label: 'Review', variant: 'primary' },
      { label: 'Defer', variant: 'secondary' },
    ],
  },
  {
    id: 'run-045',
    variant: 'running',
    avatarEmoji: '🛡️',
    avatarBg: '#5e1f2d',
    taskId: 'RUN-045',
    badgeVariant: 'running',
    badgeLabel: 'Running',
    title: 'Email triage batch (47 unread)',
    description: '38 auto-archived (newsletters), 9 labeled important, 3 drafts created for review. Dispatched 2 invoices to Marcus.',
    agents: [{ emoji: '🛡️', name: 'Karoline' }, { emoji: '🏛️', name: 'Marcus' }],
    agentSeparator: 'arrow',
    time: '8:42 AM',
  },
  {
    id: 'run-055',
    variant: 'running',
    avatarEmoji: '🔥',
    avatarBg: '#5e2d1f',
    taskId: 'RUN-055',
    badgeVariant: 'running',
    badgeLabel: 'Running',
    title: 'Electron shell — tab bar + IPC bridge',
    description: 'Tab system rendering, IPC bridge connected. Gateway WebSocket client integrated. Remaining: window state persistence.',
    agents: [{ emoji: '🔥', name: 'Vulcan' }],
    time: 'Running 45m',
  },
  {
    id: 'run-051',
    variant: 'queued',
    avatarEmoji: '⏳',
    avatarBg: '#5e4e1f',
    taskId: 'RUN-051',
    badgeVariant: 'queued',
    badgeLabel: 'Queued',
    title: 'Calendar sync — recurring events',
    description: 'Prep briefs for 3 meetings today. 10:00 Investor sync (prep ready), 2:00 VG standup, 4:30 PrintDeed review.',
    agents: [{ emoji: '⏳', name: 'Kronos' }],
    time: 'Next sync: 5m',
  },
  {
    id: 'run-060',
    variant: 'running',
    avatarEmoji: '🔮',
    avatarBg: '#3d1f5e',
    taskId: 'RUN-060',
    badgeVariant: 'running',
    badgeLabel: 'Running',
    title: 'Fireflies recap processing — 2 meetings',
    description: 'Extracting action items from Kyle/Lynn sync and VG partner review. 5 tasks created, 2 follow-ups pending.',
    agents: [{ emoji: '🔮', name: 'Ada' }, { emoji: '🛡️', name: 'Karoline' }],
    agentSeparator: 'arrow',
    time: '8:38 AM',
  },
  {
    id: 'run-062',
    variant: 'approval',
    avatarEmoji: '🏠',
    avatarBg: '#5e3d1f',
    taskId: 'RUN-062',
    badgeVariant: 'approval',
    badgeLabel: 'Needs You',
    title: 'Nashville cheer comp — book flights for Bella + Christian',
    description: 'March 26-29. Calendar event created. Vesta found 3 flight options. Need your pick to book.',
    agents: [{ emoji: '🏠', name: 'Vesta' }],
    time: 'Yesterday',
    actions: [
      { label: 'View Options', variant: 'primary' },
    ],
  },
  {
    id: 'alert-hermes',
    variant: 'urgent',
    avatarEmoji: '📡',
    avatarBg: '#1f4e5e',
    taskId: 'ALERT',
    badgeVariant: 'blocked',
    badgeLabel: 'Risk',
    title: 'Lynn Nelson — 3 deliverables overdue, Kyle adding more',
    description: 'Hermes: risk score elevated. Buckner site on hold, Alphagraphics Q2 prints stacking. Kyle sold another project without clearing backlog.',
    agents: [{ emoji: '📡', name: 'Hermes' }],
    time: 'Flagged 1m ago',
    actions: [
      { label: 'Escalate', variant: 'danger' },
      { label: 'View Graph', variant: 'secondary' },
    ],
  },
  {
    id: 'ops-010',
    variant: 'done',
    avatarEmoji: '👁️',
    avatarBg: '#2d2d5e',
    taskId: 'OPS-010',
    badgeVariant: 'done',
    badgeLabel: 'Done',
    title: 'Gateway WebSocket RPC — 40 methods typed',
    description: 'Contracts, auth, heartbeat all passing. Argus verified — all green.',
    agents: [{ emoji: '🔥', name: 'Vulcan' }, { emoji: '👁️', name: 'Argus' }],
    agentSeparator: 'verified',
    time: '7:55 AM',
  },
];

// ─── Badge styles ────────────────────────────────────────────────────────────

function badgeStyle(variant: BadgeVariant): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
  switch (variant) {
    case 'running':  return { ...base, background: '#2d1a1a', color: '#ff7b5b' };
    case 'approval': return { ...base, background: '#5e4e1f', color: '#f5c842' };
    case 'blocked':  return { ...base, background: '#5e1f1f', color: '#ff6b6b' };
    case 'queued':   return { ...base, background: 'rgba(241,245,249,0.14)', color: '#94a3b8' };
    case 'done':     return { ...base, background: '#1f5e2d', color: '#6bffb0' };
  }
}

function cardBorderLeft(variant: CardVariant): string {
  switch (variant) {
    case 'urgent':   return '3px solid #e74c3c';
    case 'approval': return '3px solid #e0c875';
    case 'running':  return '3px solid #a3862a';
    case 'queued':   return '3px solid #4a4a4a';
    case 'done':     return '3px solid #2ecc71';
  }
}

function actionBtnStyle(variant: 'primary' | 'secondary' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };
  switch (variant) {
    case 'primary':   return { ...base, background: '#a3862a', color: '#fff' };
    case 'secondary': return { ...base, background: 'rgba(241,245,249,0.14)', color: '#cbd5e1' };
    case 'danger':    return { ...base, background: '#5e1f1f', color: '#ff8888' };
  }
}

// ─── TaskCard ────────────────────────────────────────────────────────────────

function TaskCard({ card }: { card: TaskCardData }) {
  return (
    <div
      style={{
        background: '#131d33',
        border: '1px solid rgba(241,245,249,0.14)',
        borderLeft: cardBorderLeft(card.variant),
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        opacity: card.variant === 'done' ? 0.7 : 1,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: card.avatarBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        {card.avatarEmoji}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#a3862a',
              fontFamily: "'SF Mono', 'Menlo', monospace",
            }}
          >
            {card.taskId}
          </span>
          <span style={badgeStyle(card.badgeVariant)}>{card.badgeLabel}</span>
        </div>

        {/* Title */}
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>
          {card.title}
        </div>

        {/* Description */}
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
          {card.description}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {card.agents.map((agent, i) => (
            <React.Fragment key={agent.name + i}>
              {i > 0 && card.agentSeparator === 'arrow' && (
                <span style={{ color: '#4a4a4a', fontSize: '11px' }}>→</span>
              )}
              {i > 0 && card.agentSeparator === 'verified' && (
                <span style={{ color: '#4a4a4a', fontSize: '11px' }}>verified by</span>
              )}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: '#131d33',
                  border: '1px solid rgba(241,245,249,0.14)',
                }}
              >
                <span style={{ fontSize: '12px' }}>{agent.emoji}</span>
                <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{agent.name}</span>
              </div>
            </React.Fragment>
          ))}
          <span style={{ fontSize: '11px', color: '#4a4a5a', marginLeft: 'auto' }}>{card.time}</span>
        </div>
      </div>

      {/* Actions */}
      {card.actions && card.actions.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexShrink: 0, alignSelf: 'center', flexWrap: 'wrap' }}>
          {card.actions.map((action) => (
            <button key={action.label} style={actionBtnStyle(action.variant)}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Right Rail ──────────────────────────────────────────────────────────────

const RAIL_TABS = [
  { emoji: '🧠', badge: null, active: false },
  { emoji: '🛡️', badge: 3, active: true },
  { emoji: '🌈', badge: null, active: false },
  { emoji: '📡', badge: null, active: false },
  { emoji: '⏳', badge: null, active: false },
  { emoji: '🏛️', badge: null, active: false },
  { emoji: '🔮', badge: null, active: false },
  { emoji: '🏠', badge: null, active: false },
];

function RightRail() {
  return (
    <div
      style={{
        width: '300px',
        minWidth: '300px',
        borderLeft: '1px solid rgba(241,245,249,0.14)',
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Agent tabs */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '10px 12px',
          borderBottom: '1px solid rgba(241,245,249,0.14)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {RAIL_TABS.map((tab, i) => (
          <div
            key={i}
            style={{
              position: 'relative',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              cursor: 'pointer',
              flexShrink: 0,
              background: tab.active ? 'rgba(163,134,42,0.2)' : 'transparent',
              border: tab.active ? '1px solid #a3862a' : '1px solid transparent',
            }}
          >
            {tab.emoji}
            {tab.badge !== null && (
              <span
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#e74c3c',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tab.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Rail header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(241,245,249,0.14)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#5e1f2d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>Karoline</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Comms Commander</div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: '#2ecc71', fontWeight: 500 }}>Active</div>
      </div>

      {/* Chat */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Highlight message */}
        <div
          style={{
            background: 'rgba(163,134,42,0.2)',
            border: '1px solid #a3862a',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#e0e0e4',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#a3862a',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '6px',
            }}
          >
            🛡️ 3 DRAFTS READY
          </div>
          1. Sequoia partner reply<br />
          2. Lynn Nelson — Buckner hold<br />
          3. Kyle Lasseter — pipeline ping
        </div>

        {/* Agent message with draft preview */}
        <div
          style={{
            background: 'rgba(241,245,249,0.07)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#cbd5e1',
            alignSelf: 'flex-start',
            maxWidth: '100%',
          }}
        >
          <strong style={{ color: '#f1f5f9' }}>Karoline</strong><br />
          <span style={{ fontSize: '12px' }}>
            Sequoia draft is ready. Key points: confirms March 21 meeting, references Q4 growth, asks about Series B timeline. Tone is professional but warm.
          </span>

          {/* Draft preview */}
          <div
            style={{
              background: '#131d33',
              border: '1px solid rgba(241,245,249,0.14)',
              borderRadius: '8px',
              padding: '10px 12px',
              marginTop: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#a3862a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                DRAFT
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Gmail · r8518913...</span>
            </div>
            <div style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 500 }}>To: Marcus Chen &lt;marcus@sequoia...&gt;</div>
            <div style={{ fontSize: '12px', color: '#fff', fontWeight: 500, margin: '4px 0' }}>Re: Series A Term Sheet</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              Marcus, thank you for the follow-up. Yes sir, March 21st works perfectly for the deeper dive. I've attached our Q4 metrics as discussed...
            </div>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: '#a3862a',
                color: '#fff',
              }}
            >
              Approve &amp; send
            </button>
            <button
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: 'rgba(241,245,249,0.14)',
                color: '#cbd5e1',
              }}
            >
              Edit tone
            </button>
            <button
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: 'transparent',
                border: '1px solid #3a3a3e',
                color: '#94a3b8',
              }}
            >
              Defer to Monday
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#4a4a5a', marginTop: '6px', textAlign: 'right' }}>8:44 AM</div>
        </div>

        {/* Second agent message */}
        <div
          style={{
            background: 'rgba(241,245,249,0.07)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            color: '#cbd5e1',
            alignSelf: 'flex-start',
            maxWidth: '100%',
          }}
        >
          <strong style={{ color: '#f1f5f9' }}>Karoline</strong><br />
          <span style={{ fontSize: '12px' }}>
            Also — Kyle just sent Lynn another project. That's 4 active now with 3 overdue. Want me to draft the pipeline review email, or are you handling this one directly?
          </span>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: '#a3862a',
                color: '#fff',
              }}
            >
              Draft it
            </button>
            <button
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: 'rgba(241,245,249,0.14)',
                color: '#cbd5e1',
              }}
            >
              I'll handle
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#4a4a5a', marginTop: '6px', textAlign: 'right' }}>8:46 AM</div>
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(241,245,249,0.14)',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          placeholder="Message Karoline..."
          style={{
            width: '100%',
            background: '#131d33',
            border: '1px solid rgba(241,245,249,0.14)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '13px',
            color: '#f1f5f9',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

// ─── Filter pills ─────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Needs Me', 'Running', 'Blocked', 'By Agent'];

// ─── TasksView ────────────────────────────────────────────────────────────────

export function TasksView() {
  const [activeFilter, setActiveFilter] = useState('All');

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        background: '#0f172a',
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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 600,
                color: '#fff',
                margin: 0,
              }}
            >
              Operator Overview
            </h1>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '2px' }}>
              Phase 1 — Command Center
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
              const isActive = activeFilter === f;
              return (
                <div
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: isActive
                      ? '1px solid #a3862a'
                      : '1px solid rgba(241,245,249,0.14)',
                    background: isActive ? 'rgba(163,134,42,0.2)' : 'transparent',
                    color: isActive ? '#ffc8c8' : '#94a3b8',
                    userSelect: 'none',
                  }}
                >
                  {f}
                </div>
              );
            })}
          </div>
        </div>

        {/* Task grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {TASKS.map((card) => (
            <TaskCard key={card.id} card={card} />
          ))}
        </div>
      </div>

      {/* Right rail */}
      <RightRail />
    </div>
  );
}
