import React from 'react';

export interface TodayItem {
  text: string;
  dotColor?: string; // defaults to gold/accent
}

interface TodaySummaryProps {
  items?: TodayItem[];
}

export function TodaySummary({ items = [] }: TodaySummaryProps) {
  return (
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
        Today
      </p>
      {items.length === 0 ? (
        <p
          style={{
            fontSize: '14px',
            color: 'var(--muted)',
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          No items for today.
        </p>
      ) : (
        items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '10px',
              marginBottom: '10px',
              fontSize: '14px',
              color: 'var(--text-2)',
              lineHeight: '1.5',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: item.dotColor ?? 'var(--accent)',
                flexShrink: 0,
                marginTop: '6px',
              }}
            />
            <span>{item.text}</span>
          </div>
        ))
      )}
    </div>
  );
}
