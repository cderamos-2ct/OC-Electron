import React from 'react';

interface StatCard {
  emoji: string;
  count: number | string;
  label: string;
  accent?: string;
}

interface AgentStatusGridProps {
  stats: StatCard[];
}

function StatCardItem({ emoji, count, label, accent }: StatCard) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{emoji}</span>
      <span
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: accent ?? 'var(--text-primary)',
          lineHeight: 1,
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function AgentStatusGrid({ stats }: AgentStatusGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px',
        marginBottom: '32px',
      }}
    >
      {stats.map((stat) => (
        <StatCardItem key={stat.label} {...stat} />
      ))}
    </div>
  );
}
