import React from 'react';

interface TodayItem {
  text: string;
  dotColor?: string; // defaults to gold/accent
}

const TODAY_ITEMS: TodayItem[] = [
  { text: '3 meetings (first at 10:00 \u2014 Investor sync)' },
  { text: '7 tasks need decisions', dotColor: '#e67e22' },
  { text: '2 PRs awaiting your review' },
  { text: '1 relationship risk flagged (Lynn Nelson)', dotColor: 'var(--red)' },
];

export function TodaySummary() {
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
      {TODAY_ITEMS.map((item, i) => (
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
      ))}
    </div>
  );
}
