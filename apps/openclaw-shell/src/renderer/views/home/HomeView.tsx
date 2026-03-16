import React from 'react';
import { AgentStatusGrid } from './AgentStatusGrid';
import { BriefCard, AgentBrief } from './BriefCard';
import { TodaySummary } from './TodaySummary';

// ---- Mock data matching mockup exactly --------------------------------------

const AGENT_BRIEFS: AgentBrief[] = [
  {
    id: 'karoline',
    emoji: '\u{1F6E1}\uFE0F',
    name: 'Karoline',
    domain: 'Communications',
    badge: '3 Drafts',
    badgeVariant: 'action',
    summary: (
      <>
        Auto-archived <strong>38 newsletters</strong>, labeled <strong>9 as important</strong>.
        Created 3 draft replies: Sequoia partner, Lynn Nelson, Kyle Lasseter pipeline ping.
        Dispatched 2 invoices to Marcus.
      </>
    ),
    actions: [
      { label: 'Review Drafts', variant: 'primary' },
      { label: 'View Triage Log', variant: 'outline' },
    ],
  },
  {
    id: 'kronos',
    emoji: '\u23F3',
    name: 'Kronos',
    domain: 'Calendar',
    badge: '3 Meetings',
    badgeVariant: 'info',
    summary: (
      <>
        Accepted <strong>3 team standups</strong>, declined <strong>2 spam invites</strong>.
        Prep brief ready for 10:00 Investor sync. Detected scheduling conflict at 4:30 &mdash;
        PrintDeed overlaps with VG standup.
      </>
    ),
    actions: [
      { label: 'Resolve Conflict', variant: 'primary' },
      { label: 'View Prep Brief', variant: 'outline' },
    ],
  },
  {
    id: 'hermes',
    emoji: '\u{1F4E1}',
    name: 'Hermes',
    domain: 'People Intelligence',
    badge: '1 Alert',
    badgeVariant: 'alert',
    summary: (
      <>
        <strong>Lynn Nelson risk elevated</strong> &mdash; 3 deliverables overdue, Kyle added a 4th
        project. Commitment creep detected. Recommend pipeline review before next Kyle/Lynn
        interaction.
      </>
    ),
    actions: [
      { label: 'View Relationship Graph', variant: 'primary' },
      { label: 'Draft Pipeline Review', variant: 'secondary' },
    ],
  },
  {
    id: 'ada',
    emoji: '\u{1F52E}',
    name: 'Ada',
    domain: 'Knowledge',
    badge: 'Complete',
    badgeVariant: 'ok',
    summary: (
      <>
        Processed <strong>2 Fireflies recaps</strong> (Kyle/Lynn sync, VG partner review). Extracted{' '}
        <strong>5 action items</strong>, created tasks. 2 follow-up emails queued in Karoline&rsquo;s
        pipeline. Sanitized notes saved.
      </>
    ),
    actions: [
      { label: 'View Action Items', variant: 'outline' },
      { label: 'View Notes', variant: 'outline' },
    ],
  },
  {
    id: 'vesta',
    emoji: '\u{1F3E0}',
    name: 'Vesta',
    domain: 'Personal',
    badge: '1 Action',
    badgeVariant: 'action',
    summary: (
      <>
        Nashville cheer comp flights still not booked (March 26-29 for Bella + you). Found 3 options
        on Southwest. Ashley confirmed Dash is staying with grandparents.
      </>
    ),
    actions: [{ label: 'View Flight Options', variant: 'primary' }],
  },
];

// ---- Greeting helpers -------------------------------------------------------

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
    year: 'numeric',
  });
}

// ---- HomeView ---------------------------------------------------------------

export function HomeView() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '40px 56px',
        minWidth: 0,
        backgroundColor: 'var(--bg)',
      }}
    >
      {/* Greeting */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 300,
            color: 'var(--text)',
            margin: '0 0 6px 0',
            letterSpacing: '-0.5px',
          }}
        >
          {getGreeting()}, Christian.
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: 'var(--muted)',
            margin: 0,
          }}
        >
          {formatDate()}
        </p>
      </div>

      {/* Today summary bullets */}
      <TodaySummary />

      {/* Overnight Agent Activity */}
      <div style={{ marginBottom: '32px' }}>
        <p
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            margin: '0 0 14px 0',
          }}
        >
          Overnight Agent Activity
        </p>

        {/* Stat cards grid */}
        <AgentStatusGrid />

        {/* Agent briefs */}
        {AGENT_BRIEFS.map((brief) => (
          <BriefCard key={brief.id} brief={brief} />
        ))}
      </div>
    </div>
  );
}
