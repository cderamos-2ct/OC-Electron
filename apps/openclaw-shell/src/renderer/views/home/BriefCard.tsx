import React, { useState } from 'react';

export interface AgentBrief {
  id: string;
  name: string;
  avatarColor: string;
  avatarInitial: string;
  badge: string;
  badgeColor: string;
  summary: string;
  actions: Array<{ label: string; variant: 'primary' | 'ghost' }>;
}

interface BriefCardProps {
  brief: AgentBrief;
}

function ActionBtn({ label, variant }: { label: string; variant: 'primary' | 'ghost' }) {
  const [hovered, setHovered] = useState(false);
  const isPrimary = variant === 'primary';
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 14px',
        borderRadius: '6px',
        border: isPrimary ? 'none' : '1px solid var(--border-default)',
        backgroundColor: isPrimary
          ? hovered ? '#2563eb' : 'var(--accent-blue)'
          : hovered ? 'var(--bg-tertiary)' : 'transparent',
        color: isPrimary ? '#fff' : 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

export function BriefCard({ brief }: BriefCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: `1px solid ${hovered ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderRadius: '10px',
        padding: '16px 20px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
        transition: 'border-color 0.15s',
        marginBottom: '10px',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: brief.avatarColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {brief.avatarInitial}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {brief.name}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: brief.badgeColor,
              backgroundColor: `${brief.badgeColor}22`,
              padding: '2px 8px',
              borderRadius: '4px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {brief.badge}
          </span>
        </div>

        {/* Summary */}
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            margin: '0 0 12px 0',
            lineHeight: '1.6',
          }}
        >
          {brief.summary}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {brief.actions.map((action) => (
            <ActionBtn key={action.label} label={action.label} variant={action.variant} />
          ))}
        </div>
      </div>
    </div>
  );
}
