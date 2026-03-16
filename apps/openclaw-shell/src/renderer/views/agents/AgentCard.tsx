import React from 'react';

export type AgentStatus = 'active' | 'idle' | 'blocked' | 'offline';

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  avatarBg: string;
  role: string;
  status: AgentStatus;
  tasksActive: number;
  messagesToday: number;
  isCommander?: boolean;
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  active: '#22c55e',
  idle: '#eab308',
  blocked: '#ef4444',
  offline: '#525252',
};

interface AgentCardProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <div
      onClick={() => onClick(agent)}
      style={{
        background: 'var(--bg-secondary)',
        border: agent.isCommander
          ? '1px solid #3d2a22'
          : '1px solid var(--border-default)',
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        cursor: 'pointer',
        gridColumn: agent.isCommander ? '1 / -1' : undefined,
        transition: 'border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-blue)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = agent.isCommander
          ? '#3d2a22'
          : 'var(--border-default)';
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: agent.avatarBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: agent.isCommander ? 22 : 20,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {agent.emoji}
        {/* Status dot */}
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: STATUS_COLOR[agent.status],
            border: '1.5px solid var(--bg-secondary)',
          }}
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {agent.name}
          </span>
          {agent.isCommander && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'rgba(249,115,22,0.15)',
                color: 'var(--accent-orange)',
                border: '1px solid rgba(249,115,22,0.25)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Commander
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{agent.role}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{agent.tasksActive}</span> tasks
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{agent.messagesToday}</span> msgs today
          </span>
        </div>
      </div>

      {/* Status badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 6,
          background: `${STATUS_COLOR[agent.status]}18`,
          border: `1px solid ${STATUS_COLOR[agent.status]}33`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLOR[agent.status], textTransform: 'capitalize' }}>
          {agent.status}
        </span>
      </div>
    </div>
  );
}
