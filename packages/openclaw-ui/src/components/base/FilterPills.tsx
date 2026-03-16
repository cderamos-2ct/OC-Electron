import React from 'react';

export interface FilterPill {
  id: string;
  label: string;
}

export interface FilterPillsProps {
  pills: FilterPill[];
  active?: string;
  onChange?: (id: string) => void;
  style?: React.CSSProperties;
}

export function FilterPills({ pills, active, onChange, style }: FilterPillsProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', ...style }}>
      {pills.map((pill) => {
        const isActive = pill.id === active;
        return (
          <button
            key={pill.id}
            onClick={() => onChange?.(pill.id)}
            style={{
              padding: '6px 14px',
              borderRadius: '16px',
              fontSize: '12px',
              background: isActive ? 'var(--accent-bg)' : 'var(--bg-card)',
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              color: isActive ? '#ffc8c8' : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all 0.12s',
              fontFamily: 'inherit',
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {pill.label}
          </button>
        );
      })}
    </div>
  );
}
