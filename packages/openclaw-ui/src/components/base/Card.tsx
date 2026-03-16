import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hover?: boolean;
  variant?: 'default' | 'urgent' | 'approval' | 'running' | 'queued' | 'done';
}

const variantAccent: Record<NonNullable<CardProps['variant']>, string> = {
  default:  'var(--border)',
  urgent:   'var(--red)',
  approval: 'var(--yellow)',
  running:  'var(--accent)',
  queued:   'var(--dimmer)',
  done:     'var(--green)',
};

export function Card({ children, style, onClick, hover = false, variant = 'default', className }: CardProps) {
  const hasAccentBorder = variant !== 'default';
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '16px 18px',
        cursor: onClick ? 'pointer' : undefined,
        transition: 'border-color 0.15s',
        ...(hasAccentBorder ? { borderLeft: `3px solid ${variantAccent[variant]}` } : {}),
        ...(variant === 'done' ? { opacity: 0.7 } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
