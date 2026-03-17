import React, { useState, useEffect } from 'react';
import { invoke } from '../../lib/ipc-client';
import type { GitHubPR, GitHubIssue, GitHubNotification } from '../../../shared/types';

// ─── Keyframe injection ────────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes ghCiPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
@keyframes ghDeployProg { from{width:32%} to{width:76%} }
@keyframes toastIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
@keyframes toastProgress { from{width:100%} to{width:0%} }
@keyframes ghSkelPulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
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
type Priority = 'high' | 'med' | 'low';

interface PRRow {
  id: string;
  ci: CiStatus;
  repo: string;
  num: number;
  title: string;
  authorInitials: string;
  authorColor: string;
  authorName: string;
  statuses: { variant: BadgeVariant; label: string }[];
  time: string;
  url: string;
}

interface IssueRow {
  priority: Priority;
  num: number;
  repo: string;
  title: string;
  meta: string;
  url: string;
}

// ─── Converters ───────────────────────────────────────────────────────────────

function prToCiStatus(pr: GitHubPR): CiStatus {
  // GitHub API doesn't return CI in summary — default to running; detail view would have it
  return 'running';
}

function prToBadges(pr: GitHubPR): { variant: BadgeVariant; label: string }[] {
  const badges: { variant: BadgeVariant; label: string }[] = [];

  if (pr.state === 'closed') {
    badges.push({ variant: 'merged', label: '▶ Merged' });
    return badges;
  }

  // state == 'open'
  const isDraft = pr.title.startsWith('[WIP]') || pr.title.toLowerCase().startsWith('draft:');
  if (isDraft) {
    badges.push({ variant: 'draft', label: '✎ Draft' });
  } else {
    badges.push({ variant: 'open', label: '● Open' });
  }

  if (pr.reviewDecision === 'APPROVED') {
    badges.push({ variant: 'approved', label: '✓ Approved' });
  } else if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    badges.push({ variant: 'changes', label: '▲ Changes requested' });
  } else {
    badges.push({ variant: 'pending', label: '● Pending review' });
  }

  return badges;
}

function authorInitials(name: string): string {
  const parts = name.replace(/[-_]/g, ' ').split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AUTHOR_COLORS = ['#1f3d2d', '#3d1a2d', '#1f1f3d', '#3d2d1a', '#1a3d3d'];
function authorColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AUTHOR_COLORS[Math.abs(h) % AUTHOR_COLORS.length];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

function convertPR(pr: GitHubPR, repo: string): PRRow {
  return {
    id:             `${repo}#${pr.number}`,
    ci:             prToCiStatus(pr),
    repo,
    num:            pr.number,
    title:          pr.title,
    authorInitials: authorInitials(pr.user),
    authorColor:    authorColor(pr.user),
    authorName:     pr.user,
    statuses:       prToBadges(pr),
    time:           '',
    url:            pr.url,
  };
}

function issuePriority(issue: GitHubIssue): Priority {
  const labels = issue.labels.map((l: string) => l.toLowerCase());
  if (labels.some((l: string) => l.includes('critical') || l.includes('high') || l.includes('p0') || l.includes('p1'))) return 'high';
  if (labels.some((l: string) => l.includes('medium') || l.includes('p2'))) return 'med';
  return 'low';
}

function convertIssue(issue: GitHubIssue, repo: string): IssueRow {
  const isMe = issue.assignees.length > 0;
  return {
    priority: issuePriority(issue),
    num:      issue.number,
    repo,
    title:    issue.title,
    meta:     isMe ? 'assigned: you' : 'open',
    url:      issue.url,
  };
}

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

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(241,245,249,0.1)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ height: 10, borderRadius: 3, background: 'rgba(241,245,249,0.08)', width: '70%', animation: 'ghSkelPulse 1.6s ease-in-out infinite' }} />
        <div style={{ height: 8, borderRadius: 3, background: 'rgba(241,245,249,0.05)', width: '45%', animation: 'ghSkelPulse 1.6s ease-in-out infinite' }} />
      </div>
    </div>
  );
}

// ─── Nav icon data ────────────────────────────────────────────────────────────
const NAV_ICONS = [
  { icon: '⚓', title: 'Pull Requests', activeDot: true },
  { icon: '⚠',  title: 'Issues' },
  { icon: '▶',  title: 'Actions' },
  { icon: '📄', title: 'Code' },
  { icon: '📈', title: 'Insights' },
];

const AGENT_ID = 'primary';

// ─── Main Export ──────────────────────────────────────────────────────────────
export function GitHubView() {
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [activeFilter, setActiveFilter]     = useState<number>(0);
  const [activeNav, setActiveNav]           = useState<number>(0);
  const [toastDismissed, setToastDismissed] = useState(false);

  const [prs, setPRs]         = useState<PRRow[]>([]);
  const [issues, setIssues]   = useState<IssueRow[]>([]);
  const [notifications, setNotifications] = useState<GitHubNotification[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Load notifications to discover active repos
    invoke('api.github.notifications', AGENT_ID, true)
      .then((raw) => {
        if (cancelled) return;
        const notifs = Array.isArray(raw) ? (raw as GitHubNotification[]) : [];
        setNotifications(notifs);

        // Gather unique repos from notifications
        const repoSet = new Set<string>();
        for (const n of notifs) repoSet.add(n.repository.full_name);

        if (repoSet.size === 0) {
          setLoading(false);
          return;
        }

        // Fetch PRs and issues for each repo (up to 5 repos to avoid flooding)
        const repos = Array.from(repoSet).slice(0, 5);
        const prPromises = repos.map(full => {
          const [owner, repo] = full.split('/');
          return invoke('api.github.prs', AGENT_ID, owner, repo, 'open')
            .then(r => ({ repo: full, prs: Array.isArray(r) ? (r as GitHubPR[]) : [] }))
            .catch(() => ({ repo: full, prs: [] as GitHubPR[] }));
        });
        const issuePromises = repos.map(full => {
          const [owner, repo] = full.split('/');
          return invoke('api.github.issues', AGENT_ID, owner, repo, 'open')
            .then(r => ({ repo: full, issues: Array.isArray(r) ? (r as GitHubIssue[]) : [] }))
            .catch(() => ({ repo: full, issues: [] as GitHubIssue[] }));
        });

        Promise.all([...prPromises, ...issuePromises]).then(results => {
          if (cancelled) return;
          const half = results.length / 2;
          const prResults  = results.slice(0, half) as { repo: string; prs: GitHubPR[] }[];
          const issResults = results.slice(half)    as { repo: string; issues: GitHubIssue[] }[];

          const allPRs: PRRow[] = [];
          for (const { repo, prs: list } of prResults) {
            for (const pr of list) allPRs.push(convertPR(pr, repo));
          }

          const allIssues: IssueRow[] = [];
          for (const { repo, issues: list } of issResults) {
            for (const issue of list) allIssues.push(convertIssue(issue, repo));
          }

          // Sort: open needs-review first, then by number desc
          allPRs.sort((a, b) => b.num - a.num);
          allIssues.sort((a, b) => {
            const p = { high: 0, med: 1, low: 2 };
            return p[a.priority] - p[b.priority];
          });

          setPRs(allPRs.slice(0, 20));
          setIssues(allIssues.slice(0, 10));
          setLoading(false);
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(String(err));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Counts for filter tabs
  const needsReview = prs.filter(p => p.statuses.some(s => s.variant === 'pending')).length;
  const mine        = prs.length;
  const all         = prs.length;

  const filterTabs = [
    { label: 'Needs Review', count: needsReview },
    { label: 'Mine',         count: mine },
    { label: 'All',          count: all },
  ];

  const filteredPRs = activeFilter === 0
    ? prs.filter(p => p.statuses.some(s => s.variant === 'pending'))
    : prs;

  // Notification toast: first unread notification
  const firstNotif = notifications.find(n => n.unread);

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

          {/* Loading skeletons */}
          {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

          {/* Error state */}
          {!loading && error && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>⚠</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 6 }}>Failed to load GitHub data</div>
              <div style={{ fontSize: 12, color: C.muted }}>{error}</div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredPRs.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: C.muted }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚓</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text2, marginBottom: 6 }}>
                {prs.length === 0 ? 'No repositories connected' : 'No PRs need review'}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {prs.length === 0 ? 'Connect GitHub to see pull requests' : 'All caught up!'}
              </div>
            </div>
          )}

          {/* PR rows */}
          {!loading && !error && filteredPRs.map((pr) => {
            const isExpanded = expandedId === pr.id;

            return (
              <div
                key={pr.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  setExpandedId(isExpanded ? null : pr.id);
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
                    </div>
                  </div>
                  {pr.time && (
                    <span style={{ fontSize: 11, color: C.dim, flexShrink: 0, marginLeft: 'auto' }}>{pr.time}</span>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    padding: '0 16px 16px 35px',
                    borderTop: `1px solid ${C.border2}`,
                    background: '#0f1320',
                  }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                      <button
                        onClick={() => pr.url && window.open(pr.url, '_blank')}
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                          cursor: 'pointer', border: 'none', fontFamily: 'inherit', whiteSpace: 'nowrap',
                          background: C.accent, color: '#fff',
                        }}
                      >
                        Open on GitHub →
                      </button>
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
            {loading ? (
              <span>Loading GitHub data…</span>
            ) : error ? (
              <span style={{ color: C.red }}>GitHub connection error</span>
            ) : (
              <>
                <span style={{ color: C.accent, fontWeight: 500 }}>{prs.length} PRs loaded</span>
                <span style={{ color: C.border, margin: '0 4px' }}>·</span>
                <span>{needsReview} need review</span>
                <span style={{ color: C.border, margin: '0 4px' }}>·</span>
                <span>{issues.length} open issues</span>
              </>
            )}
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
          </div>
        </div>

        {/* Toast notification for first unread notification */}
        {!toastDismissed && firstNotif && (
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
                {firstNotif.subject.title} — {firstNotif.repository.full_name}
              </div>
              <span
                onClick={() => firstNotif.subject.url && window.open(firstNotif.subject.url, '_blank')}
                style={{ fontSize: 11, color: C.accent, cursor: 'pointer', fontWeight: 500, display: 'inline-block', marginTop: 4 }}
              >
                View →
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

        {/* Issues — Flagged */}
        <div style={{ padding: '14px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', color: C.dim, marginBottom: 12 }}>
            Issues — Open
          </div>

          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(241,245,249,0.1)', marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 10, borderRadius: 3, background: 'rgba(241,245,249,0.07)', marginBottom: 5, animation: 'ghSkelPulse 1.6s ease-in-out infinite' }} />
                <div style={{ height: 8, borderRadius: 3, background: 'rgba(241,245,249,0.04)', width: '60%', animation: 'ghSkelPulse 1.6s ease-in-out infinite' }} />
              </div>
            </div>
          ))}

          {!loading && issues.length === 0 && (
            <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '20px 0' }}>
              No open issues
            </div>
          )}

          {!loading && issues.map((issue) => (
            <div key={`${issue.repo}#${issue.num}`} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              cursor: 'pointer',
            }}
              onClick={() => issue.url && window.open(issue.url, '_blank')}
            >
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
