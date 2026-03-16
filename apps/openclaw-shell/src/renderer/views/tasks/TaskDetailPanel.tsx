import React, { useState } from 'react';
import { TaskItem } from './TaskRow';

interface TaskDetailPanelProps {
  task: TaskItem;
  onClose: () => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#10b981',
  low: '#525252',
};

const STATUS_COLOR: Record<string, string> = {
  pending: '#a3a3a3',
  in_progress: '#3b82f6',
  done: '#22c55e',
  blocked: '#ef4444',
  cancelled: '#525252',
};

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const [note, setNote] = useState('');

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
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-muted)',
              background: 'var(--bg-tertiary)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {task.id}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Task Detail</span>
        </div>
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.4 }}>
          {task.title}
        </div>

        {/* Meta grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Status', value: task.status.replace('_', ' '), color: STATUS_COLOR[task.status] },
            { label: 'Priority', value: task.priority, color: PRIORITY_COLOR[task.priority] },
            { label: 'Agent', value: `${task.agentEmoji} ${task.agent}`, color: undefined },
            { label: 'Updated', value: task.updatedAt, color: undefined },
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 56, flexShrink: 0 }}>{row.label}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: row.color ?? 'var(--text-primary)',
                  textTransform: 'capitalize',
                }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {task.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 5,
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: 20,
            padding: '10px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
          }}
        >
          {task.description}
        </div>

        {/* Actions */}
        {task.status !== 'done' && task.status !== 'cancelled' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              style={{
                flex: 1,
                padding: '7px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent-green)',
                color: '#000',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Approve
            </button>
            <button
              style={{
                flex: 1,
                padding: '7px',
                borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)',
                color: 'var(--accent-red)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reject
            </button>
          </div>
        )}

        {/* Note input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Add Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Leave a note for the agent..."
            rows={3}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
              resize: 'none',
              lineHeight: 1.5,
              fontFamily: 'inherit',
            }}
          />
          <button
            style={{
              padding: '6px',
              borderRadius: 7,
              border: 'none',
              background: 'var(--accent-blue)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Send Note
          </button>
        </div>
      </div>
    </div>
  );
}
