import React, { useState } from 'react';
import { useTasks } from '../../hooks/use-tasks';
import { TaskCardList } from '../tasks/TaskCardList';
import { BatchReviewCard } from '../tasks/BatchReviewCard';

// ─── Slide-over panel ─────────────────────────────────────────────────────────

interface TaskPanelProps {
  onClose: () => void;
}

function TaskPanel({ onClose }: TaskPanelProps) {
  const {
    urgentTasks,
    inProgressTasks,
    queuedTasks,
    handledTasks,
    needsChristianTasks,
    loading,
    approveTask,
    rejectTask,
    deferTask,
    commentOnTask,
    batchApprove,
  } = useTasks();

  // FYI tasks: low priority handled tasks that can be batch-approved
  const fyiTaskIds = handledTasks
    .filter((t) => t.priority === 'low' && t.status === 'done')
    .map((t) => t.id);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          width: '400px',
          maxWidth: '90vw',
          height: '100%',
          backgroundColor: '#18181b',
          borderLeft: '1px solid #3f3f46',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Panel header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            height: '40px',
            borderBottom: '1px solid #3f3f46',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5', flex: 1 }}>
            Tasks
          </span>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#71717a',
              fontSize: '16px',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Batch summary */}
        <div style={{ padding: '12px 12px 0' }}>
          <BatchReviewCard
            handledTasks={handledTasks}
            needsDecisionTasks={needsChristianTasks}
            fyiTaskIds={fyiTaskIds}
            onBatchApprove={batchApprove}
            onReviewItems={() => {
              // handled section auto-scrolls when expanded
            }}
          />
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TaskCardList
            urgentTasks={urgentTasks}
            inProgressTasks={inProgressTasks}
            queuedTasks={queuedTasks}
            handledTasks={handledTasks}
            loading={loading}
            onApprove={approveTask}
            onReject={rejectTask}
            onDefer={deferTask}
            onComment={commentOnTask}
          />
        </div>
      </div>
    </div>
  );
}

// ─── NeedsChristianCard ───────────────────────────────────────────────────────

export function NeedsChristianCard() {
  const [panelOpen, setPanelOpen] = useState(false);
  const { needsChristianTasks, loading } = useTasks();

  const count = needsChristianTasks.length;
  const hasItems = count > 0;

  if (loading) return null;

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          margin: '0',
          border: 'none',
          borderBottom: '1px solid #3f3f46',
          borderRadius: 0,
          backgroundColor: 'transparent',
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#27272a';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
      >
        {/* Red dot or check */}
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: hasItems ? '#ef4444' : '#3f3f46',
            flexShrink: 0,
            transition: 'background-color 0.3s',
          }}
        />

        {hasItems ? (
          <span style={{ fontSize: '11px', color: '#fef2f2', fontWeight: 600, flex: 1 }}>
            {count} item{count > 1 ? 's' : ''} need your call
          </span>
        ) : (
          <span style={{ fontSize: '11px', color: '#52525b', flex: 1 }}>
            All clear
          </span>
        )}

        {hasItems && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#fff',
              backgroundColor: '#ef4444',
              padding: '1px 6px',
              borderRadius: '999px',
              flexShrink: 0,
            }}
          >
            {count}
          </span>
        )}

        <span style={{ fontSize: '10px', color: '#52525b' }}>›</span>
      </button>

      {panelOpen && <TaskPanel onClose={() => setPanelOpen(false)} />}
    </>
  );
}
