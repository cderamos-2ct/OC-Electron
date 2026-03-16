import React, { useState } from 'react';

export interface AgentBrief {
  id: string;
  emoji: string;
  name: string;
  domain: string;
  badge: string;
  badgeVariant: 'action' | 'info' | 'alert' | 'ok';
  summary: React.ReactNode;
  actions: Array<{ label: string; variant: 'primary' | 'outline' | 'secondary' }>;
}

const BADGE_COLORS: Record<string, { color: string; bg: string }> = {
  action: { color: '#e0c875', bg: 'rgba(224,200,117,0.15)' },
  info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  alert: { color: '#e74c3c', bg: 'rgba(231,76,60,0.15)' },
  ok: { color: '#2ecc71', bg: 'rgba(46,204,113,0.15)' },
};

function ActionBtn({ label, variant }: { label: string; variant: string }) {
  const [hovered, setHovered] = useState(false);
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 16px',
        borderRadius: '6px',
        border: isPrimary ? 'none' : '1px solid var(--border)',
        backgroundColor: isPrimary
          ? hovered ? '#b8962f' : 'var(--accent)'
          : isSecondary
          ? hovered ? 'rgba(163,134,42,0.25)' : 'var(--accent-bg)'
          : hovered ? 'rgba(241,245,249,0.08)' : 'transparent',
        color: isPrimary ? '#fff' : isSecondary ? 'var(--yellow)' : 'var(--text-2)',
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

export function BriefCard({ brief }: { brief: AgentBrief }) {
  const [hovered, setHovered] = useState(false);
  const badgeStyle = BADGE_COLORS[brief.badgeVariant] ?? BADGE_COLORS.info;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${hovered ? 'rgba(241,245,249,0.22)' : 'var(--border)'}`,
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
          backgroundColor: 'var(--accent-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          flexShrink: 0,
        }}
      >
        {brief.emoji}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            {brief.name} &mdash; {brief.domain}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: badgeStyle.color,
              backgroundColor: badgeStyle.bg,
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
            color: 'var(--text-2)',
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
