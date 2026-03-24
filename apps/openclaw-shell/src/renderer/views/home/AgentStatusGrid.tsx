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
  stats: AgentStat[];
}

export function AgentStatusGrid({ stats }: AgentStatusGridProps) {
  if (stats.length === 0) {
    return (
      <p
        style={{
          fontSize: '14px',
          color: 'var(--muted)',
          margin: '0 0 24px 0',
        }}
      >
        No dashboard metrics to display.
      </p>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        gap: '12px',
        marginBottom: '24px',
      }}
    >
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
