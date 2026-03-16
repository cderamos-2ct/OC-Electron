// ─── Task Engine ─────────────────────────────────────────────────
// Reads/writes .antigravity/tasks/items/*.md files,
// exposes list / get / mutate / quickDecision / batchApprove,
// watches the directory for external changes.

import { EventEmitter } from 'events';
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  watch,
  type FSWatcher,
} from 'fs';
import { join, basename } from 'path';
import { TASKS_DIR, SELF_WRITE_TTL_MS } from '../shared/constants.js';
import type { TaskPatch, QuickDecision } from '../shared/types.js';
import { readTaskDocument, renderTaskDocument, type TaskDocument } from '../shared/task-parser.js';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const QUICK_DECISION_STATUS: Record<QuickDecision, string> = {
  approve: 'in_progress',
  defer: 'queued',
  block: 'blocked',
  cancel: 'cancelled',
};

export interface TaskChangedEvent {
  taskId: string;
  task: TaskDocument;
}

export class TaskEngine extends EventEmitter {
  private readonly tasksDir: string;
  private readonly selfWrites = new Map<string, number>();
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingChanges = new Set<string>();

  constructor(tasksDir: string = TASKS_DIR) {
    super();
    this.tasksDir = tasksDir;
    this.startWatcher();
  }

  // ── Public API ──────────────────────────────────────────────────

  listTasks(): TaskDocument[] {
    const files = readdirSync(this.tasksDir)
      .filter((name) => name.endsWith('.md'))
      .sort();

    return files
      .map((name) => this.readFile(join(this.tasksDir, name)))
      .filter((t): t is TaskDocument => t !== null)
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99),
      );
  }

  getTask(taskId: string): TaskDocument | null {
    const filePath = join(this.tasksDir, `${taskId}.md`);
    return this.readFile(filePath);
  }

  mutateTask(
    taskId: string,
    patch: TaskPatch,
  ): TaskDocument | { conflict: true; currentTask: TaskDocument } {
    const filePath = join(this.tasksDir, `${taskId}.md`);
    const task = this.readFile(filePath);
    if (!task) throw new Error(`Task not found: ${taskId}`);

    // Optimistic locking
    if (patch.expectedUpdatedAt && patch.expectedUpdatedAt !== task.updated_at) {
      return { conflict: true, currentTask: task };
    }

    const now = new Date().toISOString();
    if (patch.status) task.status = patch.status;
    if (patch.priority) task.priority = patch.priority;
    if (patch.owner_agent) task.owner_agent = patch.owner_agent;
    task.updated_at = now;

    if (patch.reason) {
      task.activityLog.push(`- ${now} shell: ${patch.reason}`);
    }

    this.atomicWrite(filePath, task);
    return task;
  }

  quickDecision(taskId: string, decision: QuickDecision): TaskDocument {
    const newStatus = QUICK_DECISION_STATUS[decision];
    if (!newStatus) throw new Error(`Unknown decision: ${decision}`);

    const result = this.mutateTask(taskId, {
      status: newStatus,
      reason: `Quick decision: ${decision}`,
    });
    if ('conflict' in result) {
      throw new Error(`Conflict while applying quick decision on ${taskId}`);
    }
    return result;
  }

  batchApprove(taskIds: string[]): TaskDocument[] {
    return taskIds.map((id) => this.quickDecision(id, 'approve'));
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // ── Internals ───────────────────────────────────────────────────

  private readFile(filePath: string): TaskDocument | null {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      return readTaskDocument(filePath, raw);
    } catch {
      return null;
    }
  }

  private atomicWrite(filePath: string, task: TaskDocument): void {
    const tmpPath = filePath + '.tmp';
    const content = renderTaskDocument(task);
    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, filePath);

    // Track self-write to suppress echo from watcher
    const taskId = basename(filePath, '.md');
    this.selfWrites.set(taskId, Date.now());
  }

  private startWatcher(): void {
    try {
      this.watcher = watch(this.tasksDir, (_eventType, filename) => {
        if (!filename || !filename.endsWith('.md')) return;
        const taskId = filename.replace(/\.md$/, '');
        this.pendingChanges.add(taskId);
        this.scheduleDebouncedFlush();
      });
    } catch {
      // Directory may not exist yet — watcher will be null
    }
  }

  private scheduleDebouncedFlush(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.flushPendingChanges();
    }, 50);
  }

  private flushPendingChanges(): void {
    const ids = [...this.pendingChanges];
    this.pendingChanges.clear();

    const now = Date.now();
    for (const taskId of ids) {
      // Skip self-writes within the TTL window
      const writeTs = this.selfWrites.get(taskId);
      if (writeTs && now - writeTs < SELF_WRITE_TTL_MS) {
        continue;
      }
      this.selfWrites.delete(taskId);

      const task = this.getTask(taskId);
      if (task) {
        this.emit('task:changed', { taskId, task } satisfies TaskChangedEvent);
      }
    }
  }
}
