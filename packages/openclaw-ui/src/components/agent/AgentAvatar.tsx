import React from 'react';
import { Avatar, type AvatarProps } from '../base/Avatar.js';

export interface AgentAvatarProps extends Omit<AvatarProps, 'theme'> {
  agentId?: string;
  theme?: string;
}

// Map common agent IDs to their themes
const agentThemeMap: Record<string, string> = {
  cd:          'satellite',
  brain:       'brain',
  karoline:    'shield',
  themis:      'scale',
  finance:     'scale',
  calendar:    'hourglass',
  notes:       'scroll',
  comms:       'rainbow',
  ops:         'compass',
  research:    'crystal',
  build:       'fire',
  verifier:    'eye',
  db:          'temple',
  home:        'home',
};

export function AgentAvatar({ agentId, theme, emoji = '🤖', ...props }: AgentAvatarProps) {
  const resolvedTheme = theme ?? (agentId ? agentThemeMap[agentId] : undefined) ?? 'brain';
  return <Avatar emoji={emoji} theme={resolvedTheme} {...props} />;
}
