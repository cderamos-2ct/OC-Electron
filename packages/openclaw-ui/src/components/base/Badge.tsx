import React from 'react';

export type BadgeVariant = 'running' | 'approval' | 'blocked' | 'queued' | 'done' | 'default';

const badgeStyles: Record<BadgeVariant, React.CSSProperties> = {
  running:  { background: '#2d1a1a', color: '#ff7b5b' },
  approval: { background: '#5e4e1f', color: '#f5c842' },
  blocked:  { background: '#5e1f1f', color: '#ff6b6b' },
  queued:   { background: 'var(--border)', color: 'var(--muted)' },
  done:     { background: '#1f5e2d', color: '#6bffb0' },
  default:  { background: 'var(--border-2)', color: 'var(--text-3)' },
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge({ variant = 'default', children, style }: BadgeProps) {
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        display: 'inline-block',
        ...badgeStyles[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
