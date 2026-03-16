import React from 'react';
import { agentAvatarColors, type AgentAvatarTheme } from '../../tokens/index.js';

export interface AvatarProps {
  emoji?: string;
  theme?: AgentAvatarTheme | string;
  size?: number;
  borderRadius?: number;
  style?: React.CSSProperties;
  className?: string;
}

export function Avatar({ emoji = '🤖', theme = 'brain', size = 32, borderRadius = 8, style, className }: AvatarProps) {
  const bg = agentAvatarColors[theme] ?? agentAvatarColors['brain'];
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        background: bg,
        flexShrink: 0,
        ...style,
      }}
    >
      {emoji}
    </div>
  );
}
