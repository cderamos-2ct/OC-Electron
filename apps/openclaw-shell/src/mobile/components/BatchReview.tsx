import { useState } from 'react';
import type { TaskDocument, QuickDecision } from '../../shared/types';
import { TaskCardMobile } from './TaskCardMobile';

interface BatchReviewProps {
  tasks: TaskDocument[];
  handledCount: number;
  onDecision: (taskId: string, decision: QuickDecision) => void;
  onApproveAllSafe: () => void;
}

export function BatchReview({ tasks, handledCount, onDecision, onApproveAllSafe }: BatchReviewProps) {
  const [expanded, setExpanded] = useState(true);

  const safeToApprove = tasks.filter(
    (t) => t.priority.toLowerCase() === 'low' || t.priority.toLowerCase() === 'medium'
  );

  return (
    <div style={{ padding: '16px' }}>
      {/* Summary bar */}
      <div style={{
        background: '#27272a',
        borderRadius: '12px',
        padding: '14px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', color: '#a1a1aa' }}>Batch Review</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', marginTop: '2px' }}>
            {handledCount} handled &middot; {tasks.length} need your call
          </div>
        </div>
        {safeToApprove.length > 0 && (
          <button
            onClick={onApproveAllSafe}
            style={{
              minHeight: '44px',
              padding: '0 16px',
              background: '#16a34a',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Approve All Safe ({safeToApprove.length})
          </button>
        )}
      </div>

      {/* Toggle */}
      {tasks.length > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            width: '100%',
            minHeight: '44px',
            background: '#3f3f46',
            border: 'none',
            borderRadius: '10px',
            color: '#a1a1aa',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '12px',
          }}
        >
          {expanded ? 'Collapse' : `Show ${tasks.length} items`}
        </button>
      )}

      {/* Task list */}
      {expanded && tasks.map((task) => (
        <TaskCardMobile key={task.id} task={task} onDecision={onDecision} />
      ))}

      {tasks.length === 0 && (
        <div style={{ textAlign: 'center', color: '#52525b', padding: '32px 0', fontSize: '15px' }}>
          Nothing needs your attention right now.
        </div>
      )}
    </div>
  );
}
