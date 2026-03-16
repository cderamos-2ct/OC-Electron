import { MobileViewShell } from '../MobileViewShell';
import { BatchReview } from '../components/BatchReview';
import type { TaskDocument, QuickDecision } from '../../shared/types';

interface MobileTasksViewProps {
  tasks: TaskDocument[];
  handledCount: number;
  onDecision: (taskId: string, decision: QuickDecision) => void;
  onApproveAllSafe: () => void;
}

export function MobileTasksView({
  tasks,
  handledCount,
  onDecision,
  onApproveAllSafe,
}: MobileTasksViewProps) {
  return (
    <MobileViewShell
      title="Tasks"
      headerRight={
        tasks.length > 0 ? (
          <span
            style={{
              background: 'var(--error)',
              color: '#fff',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
            }}
          >
            {tasks.length}
          </span>
        ) : undefined
      }
    >
      <BatchReview
        tasks={tasks}
        handledCount={handledCount}
        onDecision={onDecision}
        onApproveAllSafe={onApproveAllSafe}
      />
    </MobileViewShell>
  );
}
