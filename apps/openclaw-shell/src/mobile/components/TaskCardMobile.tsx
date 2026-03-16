import type { TaskDocument, QuickDecision } from '../../shared/types';

interface TaskCardMobileProps {
  task: TaskDocument;
  onDecision: (taskId: string, decision: QuickDecision) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

export function TaskCardMobile({ task, onDecision }: TaskCardMobileProps) {
  const priorityColor = PRIORITY_COLORS[task.priority.toLowerCase()] ?? '#71717a';

  return (
    <div style={{
      background: '#27272a',
      borderRadius: '16px',
      padding: '16px',
      marginBottom: '12px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', color: '#71717a', fontFamily: 'monospace' }}>
          {task.id}
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: priorityColor,
          background: `${priorityColor}22`,
          borderRadius: '4px',
          padding: '2px 6px',
          textTransform: 'uppercase',
        }}>
          {task.priority}
        </span>
        <span style={{
          fontSize: '11px',
          color: '#a1a1aa',
          background: '#3f3f46',
          borderRadius: '4px',
          padding: '2px 6px',
          marginLeft: 'auto',
        }}>
          {task.owner_agent}
        </span>
      </div>

      {/* Title */}
      <p style={{ fontSize: '15px', fontWeight: 500, color: '#f4f4f5', marginBottom: '12px', lineHeight: 1.4 }}>
        {task.title}
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <ActionButton
          label="Approve"
          color="#22c55e"
          onClick={() => onDecision(task.id, 'approve')}
        />
        <ActionButton
          label="Defer"
          color="#eab308"
          onClick={() => onDecision(task.id, 'defer')}
        />
        <ActionButton
          label="Block"
          color="#ef4444"
          onClick={() => onDecision(task.id, 'block')}
        />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: '44px',
        border: `1px solid ${color}44`,
        borderRadius: '10px',
        background: `${color}18`,
        color,
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
