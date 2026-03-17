import React from 'react';

export interface AgentStat {
  emoji: string;
  count: number | string;
  label: string;
  agent: string;
  accent?: string;
}

function StatCard({ emoji, count, label, agent, accent }: AgentStat) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: '20px', lineHeight: 1 }}>{emoji}</span>
      <span
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: accent ?? 'var(--text)',
          lineHeight: 1,
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-2)',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: '10px',
          color: 'var(--muted)',
          fontWeight: 400,
        }}
      >
        {agent}
      </span>
    </div>
  );
}

interface AgentStatusGridProps {
  stats?: AgentStat[];
}

const DEFAULT_STATS: AgentStat[] = [
  { emoji: '\u{1F6E1}\uFE0F', count: '—', label: 'Emails triaged', agent: 'Karoline' },
  { emoji: '\u{1F525}', count: '—', label: 'PRs merged', agent: 'Vulcan' },
  { emoji: '\u23F3', count: '—', label: 'Invites handled', agent: 'Kronos' },
  { emoji: '\u{1F52E}', count: '—', label: 'Recaps processed', agent: 'Ada' },
  { emoji: '\u{1F4E1}', count: '—', label: 'Risks flagged', agent: 'Hermes' },
];

export function AgentStatusGrid({ stats }: AgentStatusGridProps) {
  const displayStats = stats && stats.length > 0 ? stats : DEFAULT_STATS;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
        marginBottom: '24px',
      }}
    >
      {displayStats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
