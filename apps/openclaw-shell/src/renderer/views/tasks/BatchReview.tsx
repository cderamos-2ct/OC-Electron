import React, { useState } from 'react';
import { TaskItem } from './TaskCard';

interface BatchReviewProps {
  tasks: TaskItem[];
  onApproveAll: (ids: string[]) => void;
  onDismiss: () => void;
}

export function BatchReview({ tasks, onApproveAll, onDismiss }: BatchReviewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(tasks.map((t) => t.id)));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApproveSelected = () => {
    onApproveAll([...selected]);
    onDismiss();
  };

  if (tasks.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '24px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 2px 0',
            }}
          >
            Batch Review
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
            {selected.size} of {tasks.length} selected
          </p>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
        {tasks.map((task) => (
          <label
            key={task.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: '7px',
              backgroundColor: selected.has(task.id) ? 'rgba(59,130,246,0.08)' : 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            <input
              type="checkbox"
              checked={selected.has(task.id)}
              onChange={() => toggle(task.id)}
              style={{ accentColor: 'var(--accent-blue)', width: '14px', height: '14px', flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-primary)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                flexShrink: 0,
              }}
            >
              {task.id}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.title}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
              {task.agent}
            </span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleApproveSelected}
          disabled={selected.size === 0}
          style={{
            padding: '7px 18px',
            borderRadius: '7px',
            border: 'none',
            backgroundColor: selected.size === 0 ? '#374151' : '#059669',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            opacity: selected.size === 0 ? 0.6 : 1,
          }}
        >
          Approve {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
        <button
          onClick={onDismiss}
          style={{
            padding: '7px 18px',
            borderRadius: '7px',
            border: '1px solid var(--border-default)',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
