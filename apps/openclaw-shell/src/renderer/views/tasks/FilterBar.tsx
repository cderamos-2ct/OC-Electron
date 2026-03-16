import React, { useState } from 'react';
import { TaskPriority } from './TaskCard';

type FilterKey = 'all' | TaskPriority;

interface FilterOption {
  key: FilterKey;
  label: string;
  count?: number;
}

interface FilterBarProps {
  options: FilterOption[];
  active: FilterKey;
  onChange: (key: FilterKey) => void;
}

export function FilterBar({ options, active, onChange }: FilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const isActive = opt.key === active;
        return (
          <FilterPill
            key={opt.key}
            label={opt.label}
            count={opt.count}
            active={isActive}
            onClick={() => onChange(opt.key)}
          />
        );
      })}
    </div>
  );
}

interface FilterPillProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function FilterPill({ label, count, active, onClick }: FilterPillProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 14px',
        borderRadius: '16px',
        border: `1px solid ${active ? 'var(--accent-blue)' : hovered ? 'var(--accent-blue)' : 'var(--border-default)'}`,
        backgroundColor: active ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)',
        color: active ? 'var(--accent-blue)' : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      {label}
      {count !== undefined && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
            backgroundColor: active ? 'rgba(59,130,246,0.2)' : 'var(--bg-secondary)',
            padding: '0 5px',
            borderRadius: '999px',
            lineHeight: '16px',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export type { FilterKey };
