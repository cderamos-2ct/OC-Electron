import React from 'react';

export interface RailProps {
  children: React.ReactNode;
  side?: 'left' | 'right';
  width?: string;
  style?: React.CSSProperties;
}

export function Rail({ children, side = 'right', width = 'var(--rail-w)', style }: RailProps) {
  const borderProp = side === 'right' ? 'borderLeft' : 'borderRight';
  return (
    <div
      style={{
        width,
        minWidth: width,
        background: 'var(--bg-mid)',
        [borderProp]: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface RailHeaderProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function RailHeader({ children, style }: RailHeaderProps) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface RailBodyProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function RailBody({ children, style }: RailBodyProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
