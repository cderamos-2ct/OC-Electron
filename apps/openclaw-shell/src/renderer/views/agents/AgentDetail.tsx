import React from 'react';
import { Agent } from './AgentCard';

interface AgentDetailProps {
  agent: Agent;
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  idle: '#eab308',
  blocked: '#ef4444',
  offline: '#525252',
};

export function AgentDetail({ agent, onClose }: AgentDetailProps) {
  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        borderLeft: '1px solid var(--border-default)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Agent Detail</span>
        <button
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: '1px solid var(--border-default)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Agent profile */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: agent.avatarBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
          }}
        >
          {agent.emoji}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{agent.role}</div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 8,
            background: `${STATUS_COLOR[agent.status]}18`,
            border: `1px solid ${STATUS_COLOR[agent.status]}33`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[agent.status] }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[agent.status], textTransform: 'capitalize' }}>
            {agent.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', gap: 0 }}>
        {[
          { label: 'Active Tasks', value: agent.tasksActive },
          { label: 'Msgs Today', value: agent.messagesToday },
          { label: 'Uptime', value: '99.2%' },
        ].map((stat, i) => (
          <div
            key={stat.label}
            style={{
              flex: 1,
              textAlign: 'center',
              borderRight: i < 2 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent activity placeholder */}
      <div style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Recent Activity
        </div>
        {[
          { text: 'Completed draft for Partnership Proposal', time: '2m ago' },
          { text: 'Replied to Chronos re: scheduling conflict', time: '14m ago' },
          { text: 'Task TASK-142 marked complete', time: '1h ago' },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              padding: '8px 0',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.text}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: 1 }}>{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
