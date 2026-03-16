import React from 'react';
import { Avatar } from '../base/Avatar.js';
import { type AgentAvatarTheme } from '../../tokens/index.js';

export interface AgentTab {
  id: string;
  emoji?: string;
  theme?: AgentAvatarTheme | string;
  badge?: number;
}

export interface AgentOverlayToolbarProps {
  agents: AgentTab[];
  activeAgentId?: string;
  onSelectAgent?: (id: string) => void;
  style?: React.CSSProperties;
}

export function AgentOverlayToolbar({ agents, activeAgentId, onSelectAgent, style }: AgentOverlayToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        padding: '8px 12px',
        gap: '4px',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        flexShrink: 0,
        ...style,
      }}
    >
      {agents.map((agent) => {
        const isActive = agent.id === activeAgentId;
        return (
          <button
            key={agent.id}
            onClick={() => onSelectAgent?.(agent.id)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              background: isActive ? 'var(--accent-bg)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              flexShrink: 0,
              transition: 'background 0.12s',
              padding: 0,
            }}
          >
            <Avatar
              emoji={agent.emoji}
              theme={agent.theme}
              size={24}
              borderRadius={6}
            />
            {agent.badge != null && agent.badge > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  background: 'var(--red)',
                  color: '#fff',
                  fontSize: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                }}
              >
                {agent.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
