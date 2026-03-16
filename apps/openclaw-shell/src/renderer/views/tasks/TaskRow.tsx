import React, { useState } from 'react';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked' | 'cancelled';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  agent: string;
  agentEmoji: string;
  agentBg: string;
  updatedAt: string;
  tags: string[];
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#10b981',
  low: '#525252',
};

const STATUS_LABEL: Record<TaskStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#a3a3a3' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  done: { label: 'Done', color: '#22c55e' },
  blocked: { label: 'Blocked', color: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#525252' },
};

interface TaskRowProps {
  task: TaskItem;
  onClick: (task: TaskItem) => void;
}

export function TaskRow({ task, onClick }: TaskRowProps) {
  const [hovered, setHovered] = useState(false);
  const statusInfo = STATUS_LABEL[task.status];

  return (
    <div
      onClick={() => onClick(task)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        background: hovered ? 'var(--bg-secondary)' : 'transparent',
        transition: 'background 0.12s ease',
      }}
    >
      {/* Priority indicator */}
      <div
        style={{
          width: 3,
          height: 36,
          borderRadius: 2,
          background: PRIORITY_COLOR[task.priority],
          flexShrink: 0,
        }}
      />

      {/* Agent avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: task.agentBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {task.agentEmoji}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)',
              padding: '1px 6px',
              borderRadius: 4,
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {task.id}
          </span>
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
            {task.title}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{task.agent}</span>
          {task.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                border: '1px solid var(--border-default)',
                color: 'var(--text-muted)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Status */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: statusInfo.color,
          flexShrink: 0,
          minWidth: 72,
          textAlign: 'right',
        }}
      >
        {statusInfo.label}
      </div>

      {/* Time */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, width: 60, textAlign: 'right' }}>
        {task.updatedAt}
      </div>
    </div>
  );
}
