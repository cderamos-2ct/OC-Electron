import React, { useState } from 'react';

// ─── Keyframe injection ────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes ghCiPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
@keyframes ghDeployProg { from{width:32%} to{width:76%} }
@keyframes toastIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
@keyframes toastProgress { from{width:100%} to{width:0%} }
`;

if (typeof document !== 'undefined') {
  const existing = document.getElementById('gh-view-keyframes');
  if (!existing) {
    const style = document.createElement('style');
    style.id = 'gh-view-keyframes';
    style.textContent = KEYFRAMES;
    document.head.appendChild(style);
  }
}

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:        '#0f172a',
  bgMid:     '#131d33',
  bgCard:    '#131d33',
  border:    'rgba(241,245,249,0.14)',
  border2:   'rgba(241,245,249,0.08)',
  text:      '#f1f5f9',
  text2:     '#cbd5e1',
  muted:     '#94a3b8',
  accent:    '#a3862a',
  accentBg:  'rgba(163,134,42,0.2)',
  green:     '#2ecc71',
  yellow:    '#e0c875',
  red:       '#e74c3c',
  dim:       'rgba(148,163,184,0.55)',
  dimmer:    'rgba(148,163,184,0.35)',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type CiStatus = 'pass' | 'fail' | 'running';
type BadgeVariant = 'open' | 'draft' | 'merged' | 'approved' | 'changes' | 'pending';
type AgentBadgeVariant = 'reviewed' | 'auto-approved' | 'needs-you';
type Priority = 'high' | 'med' | 'low';
type DeployEnv = 'prod' | 'staging' | 'preview';

interface PR {
  id: string;
  ci: CiStatus;
  repo: string;
  num: number;
  title: string;
  authorInitials: string;
  authorColor: string;
  authorName: string;
  statuses: { variant: BadgeVariant; label: string }[];
  agentBadge?: { variant: AgentBadgeVariant; label: string };
  time: string;
}

interface Issue {
  priority: Priority;
  num: number;
  repo: string;
  title: string;
  meta: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PRS: PR[] = [
  {
    id: 'gateway47',
    ci: 'pass',
    repo: 'aegilume/gateway',
    num: 47,
    title: 'WebSocket RPC — type all 40 gateway methods with Zod schemas',
    authorInitials: 'VB',
    authorColor: '#1f3d2d',
    authorName: 'vulcan-bot',
    statuses: [
      { variant: 'open',     label: '● Open' },
      { variant: 'approved', label: '✓ Approved' },
    ],
    agentBadge: { variant: 'auto-approved', label: '⚡ Auto-approved' },
    time: '32m ago',
  },
  {
    id: 'dashboard31',
    ci: 'pass',
    repo: 'aegilume/dashboard',
    num: 31,
    title: 'AgentRosterCardView — new card grid layout',
    authorInitials: 'CD',
    authorColor: '#3d1a2d',
    authorName: 'christian',
    statuses: [
      { variant: 'open',    label: '● Open' },
      { variant: 'pending', label: '● Pending review' },
    ],
    agentBadge: { variant: 'needs-you', label: '⚠ Needs you' },
    time: '1h ago',
  },
  {
    id: 'shell14',
    ci: 'running',
    repo: 'aegilume/shell',
    num: 14,
    title: 'Browser shell platform',
    authorInitials: 'VB',
    authorColor: '#1f3d2d',
    authorName: 'vulcan-bot',
    statuses: [
      { variant: 'draft',   label: '✎ Draft' },
      { variant: 'pending', label: '● CI running' },
    ],
    agentBadge: { variant: 'reviewed', label: '🔥 Vulcan reviewed' },
    time: '2h ago',
  },
  {
    id: 'gateway46',
    ci: 'pass',
    repo: 'aegilume/gateway',
    num: 46,
    title: 'Auth middleware — JWT validation',
    authorInitials: 'VB',
    authorColor: '#1f3d2d',
    authorName: 'vulcan-bot',
    statuses: [
      { variant: 'open',     label: '● Open' },
      { variant: 'approved', label: '✓ Approved' },
    ],
    agentBadge: { variant: 'auto-approved', label: '⚡ Auto-approved' },
    time: '4h ago',
  },
  {
    id: 'dashboard29',
    ci: 'fail',
    repo: 'aegilume/dashboard',
    num: 29,
    title: 'personal-ops-store',
    authorInitials: 'CD',
    authorColor: '#3d1a2d',
    authorName: 'christian',
    statuses: [
      { variant: 'open',    label: '● Open' },
      { variant: 'changes', label: '▲ Changes requested' },
    ],
    agentBadge: { variant: 'reviewed', label: '🔥 Vulcan reviewed' },
    time: '6h ago',
  },
  {
    id: 'shell13',
    ci: 'pass',
    repo: 'aegilume/shell',
    num: 13,
    title: 'NotificationLayer',
    authorInitials: 'VB',
    authorColor: '#1f3d2d',
    authorName: 'vulcan-bot',
    statuses: [
      { variant: 'merged', label: '▶ Merged' },
    ],
    agentBadge: { variant: 'auto-approved', label: '⚡ Auto-approved' },
    time: 'Yesterday',
  },
];

const DEPLOYS = [
  {
    env: 'prod' as DeployEnv,
    label: 'Production',
    chipCls: 'live',
    chipText: '● Live',
    commit: 'a3f8c91',
    author: 'vulcan-bot',
    time: '4h ago',
    progress: false,
  },
  {
    env: 'staging' as DeployEnv,
    label: 'Staging',
    chipCls: 'deploying',
    chipText: '↻ Deploying...',
    commit: 'e91b2d4',
    author: 'vulcan-bot',
    time: 'just now',
    progress: true,
  },
  {
    env: 'preview' as DeployEnv,
    label: 'Preview',
    chipCls: 'ready',
    chipText: '✓ Ready',
    commit: '7c4a1f8',
    author: 'christian',
    time: '1h ago',
    progress: false,
  },
];

const ISSUES: Issue[] = [
  { priority: 'high', num: 82, repo: 'aegilume/gateway',   title: 'Gateway: session timeout not propagating to shell',      meta: 'assigned: you' },
  { priority: 'high', num: 44, repo: 'aegilume/dashboard', title: 'Dashboard: agent heartbeat polling causes memory leak',   meta: 'Vulcan flagged' },
  { priority: 'med',  num: 17, repo: 'aegilume/shell',     title: 'Shell: mobile drawer z-index conflict',                  meta: 'assigned: you' },
  { priority: 'med',  num: 78, repo: 'aegilume/gateway',   title: 'Gateway: Zod parse errors swallowed in dev mode',        meta: 'Vulcan flagged' },
  { priority: 'low',  num: 38, repo: 'aegilume/dashboard', title: 'Dashboard: tab bar overflow on narrow viewports',        meta: 'low priority' },
];

// ─── Style helpers ────────────────────────────────────────────────────────────
function statusBadgeStyle(v: BadgeVariant): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 10, fontWeight: 500, padding: '1px 7px',
    borderRadius: 10, whiteSpace: 'nowrap',
  };
  const map: Record<BadgeVariant, React.CSSProperties> = {
    open:     { background: '#1a2d1a', color: '#6bffb0', border: '1px solid #2a4a2a' },
    approved: { background: '#1a2d1a', color: '#6bffb0', border: '1px solid #2a4a2a' },
    pending:  { background: '#2d2a14', color: C.yellow,  border: '1px solid #4a421a' },
    changes:  { background: '#2d1a1a', color: '#ff8888', border: '1px solid #4a2a2a' },
    draft:    { background: C.border2, color: C.muted,   border: `1px solid ${C.border}` },
    merged:   { background: '#2d1a4a', color: '#c89bff', border: '1px solid #4a2a7a' },
  };
  return { ...base, ...map[v] };
}

function agentBadgeStyle(v: AgentBadgeVariant): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 10, fontWeight: 500, padding: '1px 7px',
    borderRadius: 4, whiteSpace: 'nowrap',
  };
  const map: Record<AgentBadgeVariant, React.CSSProperties> = {
    'auto-approved': { background: '#1a2d1a',                  color: '#6bffb0', border: '1px solid #2a4a2a' },
    'needs-you':     { background: '#2d1f0a',                  color: '#ffcc66', border: '1px solid #5a3a10' },
    'reviewed':      { background: 'rgba(163,94,42,0.2)',       color: '#ff9b7b', border: '1px solid #4d1f15' },
  };
  return { ...base, ...map[v] };
}

function ciDotStyle(ci: CiStatus): React.CSSProperties {
  const base: React.CSSProperties = { width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 2 };
  if (ci === 'pass')    return { ...base, background: C.green,  boxShadow: '0 0 5px rgba(46,204,113,0.4)' };
  if (ci === 'fail')    return { ...base, background: C.red,    boxShadow: '0 0 5px rgba(231,76,60,0.4)' };
  return { ...base, background: C.yellow, animation: 'ghCiPulse 1.4s ease-in-out infinite' };
}

function priorityDotColor(p: Priority): string {
  if (p === 'high') return C.red;
  if (p === 'med')  return C.yellow;
  return C.muted;
}

function deployBorderColor(env: DeployEnv): string {
  if (env === 'prod')    return C.green;
  if (env === 'staging') return C.yellow;
  return '#4a9fff';
}

function deployChipStyle(cls: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 10, fontWeight: 500, padding: '1px 7px',
    borderRadius: 10, whiteSpace: 'nowrap',
  };
  if (cls === 'live')      return { ...base, background: '#1a2d1a', color: '#6bffb0', border: '1px solid #2a4a2a' };
  if (cls === 'deploying') return { ...base, background: '#2d2a14', color: C.yellow,  border: '1px solid #4a421a', animation: 'ghCiPulse 1.2s ease-in-out infinite' };
  return { ...base, background: '#1a2040', color: '#4a9fff', border: '1px solid #2a3a6a' };
}

// ─── Nav icon data ────────────────────────────────────────────────────────────
const NAV_ICONS = [
  { icon: '⚓', title: 'Pull Requests', activeDot: true },
  { icon: '⚠',  title: 'Issues' },
  { icon: '▶',  title: 'Actions' },
  { icon: '📄', title: 'Code' },
  { icon: '📈', title: 'Insights' },
];

// ─── Main Export ──────────────────────────────────────────────────────────────
export function GitHubView() {
  const [expandedId, setExpandedId]     = useState<string>('gateway47');
  const [activeFilter, setActiveFilter] = useState<number>(0);
  const [activeNav, setActiveNav]       = useState<number>(0);
  const [toastDismissed, setToastDismissed] = useState(false);

  const filterTabs = [
    { label: 'Needs Review', count: 2 },
    { label: 'Mine',         count: 4 },
    { label: 'All',          count: 11 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100%', background: C.bg, overflow: 'hidden' }}>

      {/* ── Left icon nav rail (~48px) ── */}
      <div style={{
        width: 48, minWidth: 48, flexShrink: 0,
        background: '#0c0c10',
        borderRight: `1px solid ${C.border2}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 0', gap: 2,
      }}>
        {NAV_ICONS.map((nav, i) => (
          <div
            key={nav.title}
            title={nav.title}
            onClick={() => setActiveNav(i)}
            style={{
              width: 34, height: 34, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, cursor: 'pointer',
              color:      activeNav === i ? C.accent : C.muted,
              background: activeNav === i ? C.accentBg : 'transparent',
              position: 'relative',
              transition: 'background 0.1s, color 0.1s',
            }}
          >
            {nav.icon}
            {nav.activeDot && activeNav === i && (
              <div style={{
                position: 'absolute', top: 4, right: 4,
                width: 7, height: 7, borderRadius: '50%',
                background: C.accent, border: '1.5px solid #0c0c10',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Main panel (flex 1) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative' }}>

        {/* Section header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: `1px solid ${C.border2}`,
          flexShrink: 0, gap: 12,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>
            Pull Requests
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            {filterTabs.map((tab, i) => (
              <div
                key={tab.label}
                onClick={() => setActiveFilter(i)}
                style={{
                  padding: '4px 11px', borderRadius: 6,
                  fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  color:      activeFilter === i ? '#ffb8a0' : C.muted,
                  background: activeFilter === i ? C.accentBg : 'transparent',
                  transition: 'background 0.1s, color 0.1s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}{' '}
                <span style={{
                  display: 'inline-block', marginLeft: 4,
                  background: 'rgba(163,134,42,0.22)', color: C.accent,
                  fontSize: 10, padding: '0 4px', borderRadius: 4, fontWeight: 600,
                }}>{tab.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable PR list */}
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 56 }}>
          {PRS.map((pr) => {
            const isExpanded = expandedId === pr.id;
            const isFirst    = pr.id === 'gateway47';

            return (
              <div
                key={pr.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  setExpandedId(isExpanded ? '' : pr.id);
                }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  borderBottom: `1px solid rgba(255,255,255,0.04)`,
                  cursor: 'pointer',
                  background: isExpanded ? '#131d33' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                {/* PR top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                  <div style={ciDotStyle(pr.ci)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Repo + number + title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: C.dim, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <span style={{ color: C.muted }}>{pr.repo}</span> #{pr.num}
                      </span>
                      <span style={{
                        fontSize: 13, fontWeight: 500, color: C.text,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        flex: 1, minWidth: 0,
                      }}>{pr.title}</span>
                    </div>
                    {/* Author + badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.dim }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4,
                          background: pr.authorColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 7, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>{pr.authorInitials}</div>
                        {pr.authorName}
                      </div>
                      {pr.statuses.map((s) => (
                        <span key={s.label} style={statusBadgeStyle(s.variant)}>{s.label}</span>
                      ))}
                      {pr.agentBadge && (
                        <span style={agentBadgeStyle(pr.agentBadge.variant)}>{pr.agentBadge.label}</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: C.dim, flexShrink: 0, marginLeft: 'auto' }}>{pr.time}</span>
                </div>

                {/* Expanded detail — only first PR */}
                {isExpanded && isFirst && (
                  <div style={{
                    padding: '0 16px 16px 35px',
                    borderTop: `1px solid ${C.border2}`,
                    background: '#0f1320',
                  }}>
                    {/* Description */}
                    <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, margin: '12px 0 10px', maxWidth: 600 }}>
                      Adds complete Zod type coverage to all 40 WebSocket RPC methods in the gateway layer.
                      Includes runtime validation, auto-generated TypeScript types, and updated API surface documentation.
                      Required for the Shell integration milestone.
                    </p>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                      {[
                        { icon: '📄', val: '18 files', suffix: ' changed' },
                        { icon: '+',  val: '1,204',    suffix: '' },
                        { icon: '−',  val: '87',       suffix: '' },
                        { icon: '👥', val: '2',        suffix: ' reviewers' },
                      ].map((s) => (
                        <span key={s.val} style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>{s.icon}</span>
                          <span style={{ color: C.text2, fontWeight: 500 }}>{s.val}</span>
                          {s.suffix}
                        </span>
                      ))}
                    </div>

                    {/* Vulcan Analysis card */}
                    <div style={{
                      background: '#151519',
                      border: `1px solid #3a1f14`,
                      borderLeft: `3px solid ${C.accent}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                    }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 5,
                          background: C.accentBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, flexShrink: 0,
                        }}>🔥</div>
                        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.accent }}>
                          Vulcan — Analysis
                        </span>
                      </div>

                      {/* Summary text */}
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>
                        All 40 RPC methods typed and verified against the gateway spec. Zod schemas enforce runtime contracts.
                        No breaking changes to existing consumers — additive only. Test coverage at 94%. Recommended for merge.
                      </div>

                      {/* Risk chip + quality bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 5,
                          textTransform: 'uppercase', letterSpacing: '0.5px',
                          background: '#1a2d1a', color: '#6bffb0', border: '1px solid #2a4a2a',
                        }}>● Low Risk</span>
                        <span style={{ fontSize: 10, color: C.dim, whiteSpace: 'nowrap' }}>Code quality</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, maxWidth: 200 }}>
                          <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: '91%', height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${C.accent}, #ffb347)` }} />
                          </div>
                          <span style={{ fontSize: 11, color: C.text2, fontWeight: 600 }}>91/100</span>
                        </div>
                      </div>

                      {/* Suggested reviewers */}
                      <div style={{ fontSize: 10, color: C.dim, marginBottom: 5 }}>Suggested reviewers</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                        {['👤 christian (you)', '👤 argus-bot'].map((chip) => (
                          <span key={chip} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, padding: '2px 8px', borderRadius: 5,
                            background: C.border2, color: C.muted, border: `1px solid ${C.border}`,
                          }}>{chip}</span>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                          cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
                          background: C.accent, color: '#fff',
                        }}>✓ Approve</button>
                        <button style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                          background: 'transparent', border: '1px solid #4d1f1f', color: '#ff8888',
                        }}>⚠ Request Changes</button>
                        <button style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                          cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
                          background: C.border, color: C.muted,
                        }}>📄 View Diff</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Vulcan agent overlay toolbar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 52,
          background: 'rgba(14,14,18,0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(232,93,58,0.35)',
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 0,
          zIndex: 20, boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
        }}>
          {/* Agent identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginRight: 16 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: '#3d1a0a', border: '1px solid rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0, position: 'relative',
            }}>
              🔥
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 8, height: 8, borderRadius: '50%',
                background: C.green, border: '2px solid #0e0e12',
              }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>Vulcan</span>
          </div>

          <div style={{ width: 1, height: 24, background: C.border, margin: '0 14px', flexShrink: 0 }} />

          <div style={{ flex: 1, fontSize: 12, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            <span style={{ color: C.accent, fontWeight: 500 }}>3 PRs reviewed</span>
            <span style={{ color: C.border, margin: '0 4px' }}>·</span>
            <span>2 need you</span>
            <span style={{ color: C.border, margin: '0 4px' }}>·</span>
            <span>staging deploy in progress</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 14 }}>
            <button style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: C.accent, color: '#fff',
            }}>Review Queue</button>
            <button style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: C.border, color: C.muted,
            }}>Deploy Status</button>
            <button style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: 'transparent', border: `1px solid ${C.border}`, color: C.muted,
            }}>Pause Agent</button>
          </div>
        </div>

        {/* Toast notification */}
        {!toastDismissed && (
          <div style={{
            position: 'absolute', top: 48, right: 16, width: 340,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.accent}`,
            borderRadius: 8, padding: '12px 14px',
            zIndex: 30, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'toastIn 0.2s ease-out',
            display: 'flex', gap: 10, alignItems: 'flex-start',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>🔥</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: C.accent, marginBottom: 3 }}>
                Vulcan
              </div>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.45 }}>
                PR #47 gateway WebSocket RPC — CI passed, auto-approved (low risk)
              </div>
              <span style={{ fontSize: 11, color: C.accent, cursor: 'pointer', fontWeight: 500, display: 'inline-block', marginTop: 4 }}>
                View PR →
              </span>
            </div>
            <button
              onClick={() => setToastDismissed(true)}
              style={{
                background: 'transparent', border: 'none', color: C.dimmer,
                fontSize: 14, cursor: 'pointer', flexShrink: 0, padding: 0, lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >✕</button>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, height: 2,
              background: C.accent, borderRadius: '0 0 0 8px',
              animation: 'toastProgress 6s linear forwards', opacity: 0.6,
            }} />
          </div>
        )}
      </div>

      {/* ── Right column (~260px) ── */}
      <div style={{
        width: 260, minWidth: 240, flexShrink: 0,
        borderLeft: `1px solid ${C.border2}`,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', paddingBottom: 56,
        background: C.bg,
      }}>

        {/* Deploy Status */}
        <div style={{ padding: '14px 14px', borderBottom: `1px solid ${C.border2}` }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: C.dim, marginBottom: 12 }}>
            Deploy Status
          </div>
          {DEPLOYS.map((d) => (
            <div key={d.env} style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${deployBorderColor(d.env)}`,
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 8,
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text2 }}>{d.label}</span>
                <span style={deployChipStyle(d.chipCls)}>{d.chipText}</span>
              </div>
              <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
                <span style={{ fontFamily: "'SF Mono',ui-monospace,monospace", color: C.muted, fontSize: 10 }}>{d.commit}</span>
                {' · '}{d.author}{' · '}{d.time}
              </div>
              {d.progress && (
                <div style={{ height: 2, background: C.border, borderRadius: 1, marginTop: 7, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 1, background: C.yellow, animation: 'ghDeployProg 2.8s ease-in-out infinite alternate' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Issues — Flagged */}
        <div style={{ padding: '14px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: C.dim, marginBottom: 12 }}>
            Issues — Flagged
          </div>
          {ISSUES.map((issue) => (
            <div key={issue.num} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              cursor: 'pointer',
            }}>
              {/* Priority dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                background: priorityDotColor(issue.priority),
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: C.text2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  marginBottom: 2,
                }}>
                  {issue.title}
                </div>
                <div style={{ fontSize: 10, color: C.dim, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: "'SF Mono',ui-monospace,monospace", color: C.dimmer }}>#{issue.num}</span>
                  <span>{issue.repo}</span>
                  <span>·</span>
                  <span>{issue.meta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
