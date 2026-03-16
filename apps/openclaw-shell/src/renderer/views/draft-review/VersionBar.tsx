import React from 'react';

interface Version {
  id: string;
  label: string;
  isCurrent: boolean;
}

interface VersionBarProps {
  versions: Version[];
  activeVersionId: string;
  onSelectVersion: (id: string) => void;
}

export function VersionBar({ versions, activeVersionId, onSelectVersion }: VersionBarProps) {
  return (
    <div
      style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4, whiteSpace: 'nowrap' }}>
        Versions
      </span>
      {versions.map((v) => (
        <button
          key={v.id}
          onClick={() => onSelectVersion(v.id)}
          style={{
            padding: '3px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            border: v.isCurrent
              ? '1px solid var(--accent-green)'
              : '1px solid var(--border-default)',
            background: v.isCurrent ? 'rgba(34,197,94,0.12)' : 'transparent',
            color: v.isCurrent ? 'var(--accent-green)' : 'var(--text-secondary)',
            opacity: activeVersionId === v.id ? 1 : v.isCurrent ? 1 : 0.6,
          }}
        >
          {v.label}
          {v.isCurrent && (
            <span style={{ marginLeft: 4, fontSize: 9, verticalAlign: 'middle' }}>●</span>
          )}
        </button>
      ))}
    </div>
  );
}
