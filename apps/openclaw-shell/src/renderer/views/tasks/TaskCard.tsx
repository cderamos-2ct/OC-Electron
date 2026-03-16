import React, { useState } from 'react';

export type TaskPriority = 'urgent' | 'approval' | 'running' | 'done' | 'pending';

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  agent: string;
  agentColor: string;
  agentInitial: string;
  updatedAt: string;
  tags?: string[];
}

function priorityBorder(priority: TaskPriority): string {
  switch (priority) {
    case 'urgent': return '#ef4444';
    case 'approval': return '#f5c842';
    case 'running': return '#3b82f6';
    case 'done': return '#22c55e';
    default: return '#52525b';
  }
}

function StatusBadge({ priority }: { priority: TaskPriority }) {
  const configs: Record<TaskPriority, { bg: string; color: string; label: string }> = {
    urgent: { bg: '#2d1a1a', color: '#ff7b5b', label: 'URGENT' },
    approval: { bg: '#3a3000', color: '#f5c842', label: 'APPROVAL' },
    running: { bg: '#1a2235', color: '#60a5fa', label: 'RUNNING' },
    done: { bg: '#0d2318', color: '#4ade80', label: 'DONE' },
    pending: { bg: '#1f1f1f', color: '#a3a3a3', label: 'PENDING' },
  };
  const cfg = configs[priority];
  return (
    <span
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: cfg.color,
        backgroundColor: cfg.bg,
        padding: '2px 8px',
        borderRadius: '4px',
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface TaskCardProps {
  task: TaskItem;
}

export function TaskCard({ task }: TaskCardProps) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        border: `1px solid ${hovered ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderLeft: `3px solid ${priorityBorder(task.priority)}`,
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        marginBottom: '10px',
      }}
    >
      {/* Agent avatar */}
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: task.agentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {task.agentInitial}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-secondary)',
              padding: '1px 6px',
              borderRadius: '4px',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {task.id}
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: expanded ? 'normal' : 'nowrap',
            }}
          >
            {task.title}
          </span>
          <StatusBadge priority={task.priority} />
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            margin: '0 0 10px 0',
            lineHeight: '1.5',
            display: '-webkit-box',
            WebkitLineClamp: expanded ? 999 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {task.description}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-secondary)',
              padding: '1px 8px',
              borderRadius: '999px',
            }}
          >
            {task.agent}
          </span>
          {task.tags?.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-secondary)',
                padding: '1px 8px',
                borderRadius: '999px',
              }}
            >
              {tag}
            </span>
          ))}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {relativeTime(task.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
