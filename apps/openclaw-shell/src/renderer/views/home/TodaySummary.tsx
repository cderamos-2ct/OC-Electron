import React from 'react';

interface SummaryItem {
  label: string;
  value: string | number;
  accent?: string;
}

interface TodaySummaryProps {
  items: SummaryItem[];
}

export function TodaySummary({ items }: TodaySummaryProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '32px',
        display: 'flex',
        gap: '32px',
        flexWrap: 'wrap',
      }}
    >
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
            {item.label}
          </span>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: item.accent ?? 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
