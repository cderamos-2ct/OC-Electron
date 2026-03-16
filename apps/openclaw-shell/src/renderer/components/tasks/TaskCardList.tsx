import React, { useState } from 'react';
import type { TaskDocument } from '../../../shared/types';
import { TaskCard } from './TaskCard';

// ─── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  count: number;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

function SectionHeader({ title, count, collapsible, collapsed, onToggle }: SectionHeaderProps) {
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 0',
        marginBottom: '8px',
        cursor: collapsible ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#71717a',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: '10px',
          color: '#52525b',
          backgroundColor: '#3f3f46',
          padding: '1px 6px',
          borderRadius: '999px',
          fontWeight: 600,
        }}
      >
        {count}
      </span>
      {collapsible && (
        <span style={{ fontSize: '10px', color: '#52525b', marginLeft: 'auto' }}>
          {collapsed ? '▸' : '▾'}
        </span>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TaskSkeleton() {
  return (
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid #3f3f46',
        borderLeft: '3px solid #3f3f46',
        backgroundColor: '#27272a',
        padding: '12px',
        marginBottom: '8px',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <div style={{ width: '60px', height: '14px', backgroundColor: '#3f3f46', borderRadius: '4px' }} />
        <div style={{ flex: 1, height: '14px', backgroundColor: '#3f3f46', borderRadius: '4px' }} />
      </div>
      <div style={{ height: '12px', backgroundColor: '#3f3f46', borderRadius: '4px', marginBottom: '4px' }} />
      <div style={{ height: '12px', backgroundColor: '#3f3f46', borderRadius: '4px', width: '70%' }} />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: '8px',
      }}
    >
      <span style={{ fontSize: '24px' }}>✓</span>
      <p style={{ fontSize: '13px', color: '#71717a', margin: 0, textAlign: 'center' }}>
        All clear — no tasks need attention
      </p>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  tasks: TaskDocument[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDefer: (id: string) => Promise<void>;
  onComment: (id: string, comment: string) => Promise<void>;
}

function Section({
  title,
  tasks,
  collapsible,
  defaultCollapsed = false,
  onApprove,
  onReject,
  onDefer,
  onComment,
}: SectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (tasks.length === 0) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      <SectionHeader
        title={title}
        count={tasks.length}
        collapsible={collapsible}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
      {!collapsed &&
        tasks.map((task) => (
          <div key={task.id} style={{ marginBottom: '6px' }}>
            <TaskCard
              task={task}
              onApprove={onApprove}
              onReject={onReject}
              onDefer={onDefer}
              onComment={onComment}
            />
          </div>
        ))}
    </div>
  );
}

// ─── TaskCardList ─────────────────────────────────────────────────────────────

export interface TaskCardListProps {
  urgentTasks: TaskDocument[];
  inProgressTasks: TaskDocument[];
  queuedTasks: TaskDocument[];
  handledTasks: TaskDocument[];
  loading: boolean;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onDefer: (id: string) => Promise<void>;
  onComment: (id: string, comment: string) => Promise<void>;
}

export function TaskCardList({
  urgentTasks,
  inProgressTasks,
  queuedTasks,
  handledTasks,
  loading,
  onApprove,
  onReject,
  onDefer,
  onComment,
}: TaskCardListProps) {
  if (loading) {
    return (
      <div style={{ padding: '12px' }}>
        <TaskSkeleton />
        <TaskSkeleton />
        <TaskSkeleton />
      </div>
    );
  }

  const totalActive = urgentTasks.length + inProgressTasks.length + queuedTasks.length;

  if (totalActive === 0 && handledTasks.length === 0) {
    return <EmptyState />;
  }

  return (
    <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
      <Section
        title="Needs Your Call"
        tasks={urgentTasks}
        onApprove={onApprove}
        onReject={onReject}
        onDefer={onDefer}
        onComment={onComment}
      />
      <Section
        title="In Progress"
        tasks={inProgressTasks}
        onApprove={onApprove}
        onReject={onReject}
        onDefer={onDefer}
        onComment={onComment}
      />
      <Section
        title="Queued"
        tasks={queuedTasks}
        onApprove={onApprove}
        onReject={onReject}
        onDefer={onDefer}
        onComment={onComment}
      />
      <Section
        title="Handled"
        tasks={handledTasks}
        collapsible
        defaultCollapsed
        onApprove={onApprove}
        onReject={onReject}
        onDefer={onDefer}
        onComment={onComment}
      />
    </div>
  );
}
