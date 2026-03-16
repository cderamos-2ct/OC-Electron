import React, { useState, useCallback } from 'react';
import type { TaskDocument } from '../../../shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityBorderColor(priority: string): string {
  switch (priority) {
    case 'critical': return '#ef4444'; // red-500
    case 'high': return '#f59e0b';     // amber-500
    case 'medium': return '#10b981';   // emerald-500
    default: return '#52525b';         // zinc-600
  }
}

function relativeTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function descriptionSnippet(text: string, lines = 2): string {
  return text
    .split('\n')
    .filter(Boolean)
    .slice(0, lines)
    .join(' ')
    .slice(0, 120);
}

function getDescription(task: TaskDocument): string {
  return task.description || '';
}

function getActivityLog(task: TaskDocument): string[] {
  return task.activityLog ?? [];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ActionButtonProps {
  label: string;
  color: string;
  hoverColor: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ label, color, hoverColor, onClick, disabled }: ActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '3px 10px',
        borderRadius: '4px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '11px',
        fontWeight: 600,
        color: '#fff',
        backgroundColor: hovered ? hoverColor : color,
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ─── Comment input ────────────────────────────────────────────────────────────

interface CommentInputProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

function CommentInput({ onSubmit, onCancel }: CommentInputProps) {
  const [text, setText] = useState('');
  return (
    <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) { onSubmit(text.trim()); }
          if (e.key === 'Escape') { onCancel(); }
        }}
        placeholder="Add a note..."
        style={{
          flex: 1,
          padding: '4px 8px',
          borderRadius: '4px',
          border: '1px solid #52525b',
          backgroundColor: '#27272a',
          color: '#f4f4f5',
          fontSize: '12px',
          outline: 'none',
        }}
      />
      <button
        onClick={() => text.trim() && onSubmit(text.trim())}
        style={{
          padding: '4px 10px',
          borderRadius: '4px',
          border: 'none',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 600,
          color: '#fff',
          backgroundColor: '#2563eb',
        }}
      >
        Send
      </button>
      <button
        onClick={onCancel}
        style={{
          padding: '4px 10px',
          borderRadius: '4px',
          border: '1px solid #52525b',
          cursor: 'pointer',
          fontSize: '11px',
          color: '#a1a1aa',
          backgroundColor: 'transparent',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

export interface TaskCardProps {
  task: TaskDocument;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDefer: (id: string) => Promise<void>;
  onComment: (id: string, comment: string) => Promise<void>;
}

export function TaskCard({ task, onApprove, onReject, onDefer, onComment }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [acting, setActing] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isHandled = task.status === 'done' || task.status === 'cancelled';

  const handleApprove = useCallback(async () => {
    setActing(true);
    try { await onApprove(task.id); } finally { setActing(false); }
  }, [onApprove, task.id]);

  const handleReject = useCallback(async () => {
    setActing(true);
    try { await onReject(task.id); } finally { setActing(false); }
  }, [onReject, task.id]);

  const handleDefer = useCallback(async () => {
    setActing(true);
    try { await onDefer(task.id); } finally { setActing(false); }
  }, [onDefer, task.id]);

  const handleComment = useCallback(async (text: string) => {
    setActing(true);
    setCommenting(false);
    try { await onComment(task.id, text); } finally { setActing(false); }
  }, [onComment, task.id]);

  const borderColor = priorityBorderColor(task.priority);
  const description = getDescription(task);
  const activityLog = getActivityLog(task);
  const snippet = descriptionSnippet(description || task.title);

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '8px',
        border: `1px solid ${hovered ? '#52525b' : '#3f3f46'}`,
        borderLeft: `3px solid ${borderColor}`,
        backgroundColor: '#27272a',
        padding: '12px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        userSelect: 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        {/* Task ID badge */}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#a1a1aa',
            backgroundColor: '#3f3f46',
            padding: '1px 6px',
            borderRadius: '4px',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          {task.id}
        </span>

        {/* Title */}
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#f4f4f5',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title}
        </span>

        {/* Agent badge */}
        {task.owner_agent && task.owner_agent !== 'unassigned' && (
          <span
            style={{
              fontSize: '10px',
              color: '#a1a1aa',
              backgroundColor: '#3f3f46',
              padding: '1px 8px',
              borderRadius: '999px',
              flexShrink: 0,
            }}
          >
            {task.owner_agent}
          </span>
        )}
      </div>

      {/* Description snippet */}
      {snippet && (
        <p
          style={{
            fontSize: '11px',
            color: '#a1a1aa',
            margin: '0 0 8px 0',
            lineHeight: '1.5',
          }}
        >
          {snippet}
          {!expanded && description && description.length > 120 && '…'}
        </p>
      )}

      {/* Expanded: full description + activity */}
      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ marginBottom: '8px' }}
        >
          {description && description.length > 120 && (
            <p style={{ fontSize: '11px', color: '#a1a1aa', margin: '0 0 8px 0', lineHeight: '1.6' }}>
              {description}
            </p>
          )}
          {activityLog.length > 0 && (
            <div
              style={{
                borderTop: '1px solid #3f3f46',
                paddingTop: '8px',
                marginTop: '4px',
              }}
            >
              <p style={{ fontSize: '10px', color: '#71717a', margin: '0 0 4px 0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Activity
              </p>
              {activityLog.slice(-5).map((entry, i) => (
                <p key={i} style={{ fontSize: '10px', color: '#71717a', margin: '2px 0', lineHeight: '1.5' }}>
                  {entry}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer: timestamp + actions */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span style={{ fontSize: '10px', color: '#52525b', flex: 1 }}>
          Updated {relativeTime(task.updated_at)}
        </span>

        {!isHandled && (
          <>
            <ActionButton
              label="Approve"
              color="#059669"
              hoverColor="#10b981"
              onClick={handleApprove}
              disabled={acting}
            />
            <ActionButton
              label="Reject"
              color="#dc2626"
              hoverColor="#ef4444"
              onClick={handleReject}
              disabled={acting}
            />
            <ActionButton
              label="Defer"
              color="#d97706"
              hoverColor="#f59e0b"
              onClick={handleDefer}
              disabled={acting}
            />
            <ActionButton
              label="Note"
              color="#2563eb"
              hoverColor="#3b82f6"
              onClick={() => setCommenting((v) => !v)}
              disabled={acting}
            />
          </>
        )}

        {isHandled && (
          <span
            style={{
              fontSize: '10px',
              color: task.status === 'done' ? '#10b981' : '#71717a',
              fontWeight: 600,
            }}
          >
            {task.status === 'done' ? 'Done' : 'Cancelled'}
          </span>
        )}
      </div>

      {/* Comment input */}
      {commenting && (
        <CommentInput
          onSubmit={handleComment}
          onCancel={() => setCommenting(false)}
        />
      )}
    </div>
  );
}
