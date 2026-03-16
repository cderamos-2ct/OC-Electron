import React from 'react';

export type StatusDotColor = 'green' | 'yellow' | 'red' | 'dim' | 'accent';

const dotColors: Record<StatusDotColor, string> = {
  green:  'var(--green)',
  yellow: 'var(--yellow)',
  red:    'var(--red)',
  dim:    'var(--dimmer)',
  accent: 'var(--accent)',
};

export interface StatusDotProps {
  color?: StatusDotColor;
  size?: number;
  style?: React.CSSProperties;
}

export function StatusDot({ color = 'green', size = 8, style }: StatusDotProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: dotColors[color],
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
