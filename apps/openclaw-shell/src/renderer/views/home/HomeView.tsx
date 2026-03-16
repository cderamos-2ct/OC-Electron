import React from 'react';
import { AgentStatusGrid } from './AgentStatusGrid';
import { BriefCard, AgentBrief } from './BriefCard';
import { BlockerCard, Blocker } from './BlockerCard';
import { TodaySummary } from './TodaySummary';

// ─── Mock data ─────────────────────────────────────────────────────────────────

const AGENT_STATS = [
  { emoji: '🟢', count: 8, label: 'Active', accent: '#22c55e' },
  { emoji: '⏸️', count: 2, label: 'Idle' },
  { emoji: '✅', count: 34, label: 'Completed today', accent: '#22c55e' },
  { emoji: '⚠️', count: 3, label: 'Needs review', accent: '#f59e0b' },
  { emoji: '🚫', count: 2, label: 'Blocked', accent: '#ef4444' },
];

const TODAY_SUMMARY = [
  { label: 'Tasks running', value: 8, accent: '#3b82f6' },
  { label: 'Approvals pending', value: 3, accent: '#f5c842' },
  { label: 'Completed', value: 34, accent: '#22c55e' },
  { label: 'Meetings today', value: 2 },
  { label: 'PRs open', value: 5 },
];

const AGENT_BRIEFS: AgentBrief[] = [
  {
    id: 'build',
    name: 'Build Agent',
    avatarColor: '#3b82f6',
    avatarInitial: 'B',
    badge: 'running',
    badgeColor: '#ff7b5b',
    summary:
      'Ran 12 CI pipelines overnight. 10 passed, 2 failed on the mobile branch. Staging deploy is queued for 9 AM.',
    actions: [
      { label: 'View Logs', variant: 'primary' },
      { label: 'Re-run Failed', variant: 'ghost' },
    ],
  },
  {
    id: 'research',
    name: 'Research Agent',
    avatarColor: '#8b5cf6',
    avatarInitial: 'R',
    badge: 'completed',
    badgeColor: '#22c55e',
    summary:
      'Compiled competitive analysis on 4 AI orchestration platforms. Report ready for review — 8 pages.',
    actions: [
      { label: 'Open Report', variant: 'primary' },
      { label: 'Share', variant: 'ghost' },
    ],
  },
  {
    id: 'comms',
    name: 'Comms Agent',
    avatarColor: '#f59e0b',
    avatarInitial: 'C',
    badge: 'approval',
    badgeColor: '#f5c842',
    summary:
      'Draft reply to Alphagraphics ready. 3 emails awaiting your review. 1 Slack message needs action.',
    actions: [
      { label: 'Review Drafts', variant: 'primary' },
      { label: 'Dismiss', variant: 'ghost' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance Agent',
    avatarColor: '#10b981',
    avatarInitial: 'F',
    badge: 'idle',
    badgeColor: '#a3a3a3',
    summary:
      'Monthly reconciliation complete. 2 subscriptions flagged for review — $340/mo unaccounted.',
    actions: [
      { label: 'View Details', variant: 'primary' },
      { label: 'Snooze', variant: 'ghost' },
    ],
  },
];

const BLOCKERS: Blocker[] = [
  {
    id: 'BLK-001',
    text: 'Mobile CI pipeline stuck at test step — 2h 14m. Node OOM on runner.',
    agent: 'build',
    actionLabel: 'Retry with more memory',
  },
  {
    id: 'BLK-002',
    text: 'Calendar agent missing Google OAuth token — events cannot sync.',
    agent: 'calendar',
    actionLabel: 'Re-authenticate',
  },
];

// ─── Greeting helpers ──────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <p
      style={{
        fontSize: '10px',
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        margin: '0 0 14px 0',
      }}
    >
      {title}
    </p>
  );
}

// ─── HomeView ──────────────────────────────────────────────────────────────────

export function HomeView() {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '40px 56px',
          minWidth: 0,
        }}
      >
        {/* Greeting */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 300,
              color: '#ffffff',
              margin: '0 0 6px 0',
              letterSpacing: '-0.5px',
            }}
          >
            {getGreeting()}, Christian.
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            {formatDate()}
          </p>
        </div>

        {/* Agent status stats */}
        <AgentStatusGrid stats={AGENT_STATS} />

        {/* Today summary strip */}
        <TodaySummary items={TODAY_SUMMARY} />

        {/* Blockers section */}
        {BLOCKERS.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <SectionHeader title={`Blockers (${BLOCKERS.length})`} />
            {BLOCKERS.map((b) => (
              <BlockerCard key={b.id} blocker={b} />
            ))}
          </div>
        )}

        {/* Agent briefs */}
        <div>
          <SectionHeader title="Agent Briefs" />
          {AGENT_BRIEFS.map((brief) => (
            <BriefCard key={brief.id} brief={brief} />
          ))}
        </div>
      </div>

      {/* Right rail placeholder */}
      <div
        style={{
          width: '280px',
          flexShrink: 0,
          borderLeft: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '24px 20px',
        }}
      >
        <p
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '0 0 12px 0',
          }}
        >
          Quick Actions
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Right rail — coming soon
        </p>
      </div>
    </div>
  );
}
