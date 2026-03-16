import React from 'react';

interface StatItem {
  label: string;
  count: number;
  color: string;
}

interface StatusStatsProps {
  stats: StatItem[];
}

export function StatusStats({ stats }: StatusStatsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {stats.map((stat) => (
        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: stat.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stat.count}</span>
            {' '}
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
