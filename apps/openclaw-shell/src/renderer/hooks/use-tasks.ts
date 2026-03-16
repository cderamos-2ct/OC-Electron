import { useState, useEffect, useCallback } from 'react';
import type { TaskDocument } from '../../shared/types';
import {
  taskList,
  taskQuickDecision,
  taskMutate,
  onTaskChanged,
} from '../lib/ipc-client';

// ─── Priority ordering ────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortByPriority(tasks: TaskDocument[]): TaskDocument[] {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    // secondary: updated_at descending
    return b.updated_at.localeCompare(a.updated_at);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface TaskCounts {
  total: number;
  needsDecision: number;
  inProgress: number;
  queued: number;
  handled: number;
  blocked: number;
}

export interface UseTasks {
  tasks: TaskDocument[];
  loading: boolean;
  error: string | null;
  urgentTasks: TaskDocument[];
  needsChristianTasks: TaskDocument[];
  inProgressTasks: TaskDocument[];
  queuedTasks: TaskDocument[];
  handledTasks: TaskDocument[];
  blockedTasks: TaskDocument[];
  taskCounts: TaskCounts;
  approveTask: (id: string) => Promise<void>;
  rejectTask: (id: string) => Promise<void>;
  deferTask: (id: string) => Promise<void>;
  commentOnTask: (id: string, comment: string) => Promise<void>;
  batchApprove: (ids: string[]) => Promise<void>;
}

export function useTasks(): UseTasks {
  const [tasks, setTasks] = useState<TaskDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Initial fetch ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    taskList()
      .then((result) => {
        if (!cancelled) {
          setTasks(sortByPriority((result as TaskDocument[]) ?? []));
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Live updates ─────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = onTaskChanged(({ taskId, task }) => {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === taskId);
        let next: TaskDocument[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = task;
        } else {
          next = [...prev, task];
        }
        return sortByPriority(next);
      });
    });

    return unsubscribe;
  }, []);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const approveTask = useCallback(async (id: string) => {
    await taskQuickDecision(id, 'approve');
  }, []);

  const rejectTask = useCallback(async (id: string) => {
    await taskQuickDecision(id, 'cancel');
  }, []);

  const deferTask = useCallback(async (id: string) => {
    await taskQuickDecision(id, 'defer');
  }, []);

  const commentOnTask = useCallback(async (id: string, comment: string) => {
    await taskMutate(id, { reason: comment });
  }, []);

  const batchApprove = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map((id) => taskQuickDecision(id, 'approve')));
  }, []);

  // ─── Derived slices ────────────────────────────────────────────────────────

  const activeTasks = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'cancelled',
  );

  const urgentTasks = activeTasks.filter(
    (t) => t.priority === 'critical' || t.priority === 'high',
  );

  const needsChristianTasks = activeTasks.filter(
    (t) =>
      (t.status === 'needs_christian' || t.status === 'queued') &&
      (t.priority === 'critical' || t.priority === 'high'),
  );

  const inProgressTasks = activeTasks.filter((t) => t.status === 'in_progress');

  const queuedTasks = activeTasks.filter(
    (t) =>
      t.status === 'queued' &&
      t.priority !== 'critical' &&
      t.priority !== 'high',
  );

  const handledTasks = tasks.filter(
    (t) => t.status === 'done' || t.status === 'cancelled',
  );

  const blockedTasks = activeTasks.filter((t) => t.status === 'blocked');

  const taskCounts: TaskCounts = {
    total: tasks.length,
    needsDecision: needsChristianTasks.length,
    inProgress: inProgressTasks.length,
    queued: queuedTasks.length,
    handled: handledTasks.length,
    blocked: blockedTasks.length,
  };

  return {
    tasks,
    loading,
    error,
    urgentTasks,
    needsChristianTasks,
    inProgressTasks,
    queuedTasks,
    handledTasks,
    blockedTasks,
    taskCounts,
    approveTask,
    rejectTask,
    deferTask,
    commentOnTask,
    batchApprove,
  };
}
