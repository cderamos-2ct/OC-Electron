"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { DashboardScreenLayout } from "@/components/DashboardScreenLayout";
import { useAgentOps } from "@/hooks/use-agent-ops";
import type {
  OpsSessionEntry,
  OpsTask,
  OpsTaskPriority,
  OpsTaskStatus,
} from "@/lib/ops-types";
import {
  Activity,
  AlarmClock,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  SquareKanban,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";

const STATUS_COLUMNS: Array<{
  status: OpsTaskStatus;
  title: string;
  accent: string;
}> = [
  { status: "new", title: "Queued", accent: "#f59e0b" },
  { status: "in-progress", title: "Running", accent: "#3b82f6" },
  { status: "blocked", title: "Blocked", accent: "#f97316" },
  { status: "done", title: "Done", accent: "#22c55e" },
  { status: "failed", title: "Failed", accent: "#ef4444" },
];

export default function OpsPage() {
  const { tasks, summary, loading, refreshing, error, refresh, createTask, updateTask, addNote, spawnTask, spawnBatch } =
    useAgentOps();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<OpsTaskPriority>("medium");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const filteredTasks = tasks.filter((task) => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return true;
    }
    return [task.title, task.description, task.assignee, task.source]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  const selectedTask =
    filteredTasks.find((task) => task.id === selectedTaskId) ??
    tasks.find((task) => task.id === selectedTaskId) ??
    null;

  useEffect(() => {
    if (!tasks.length) {
      setSelectedTaskId(null);
      setSelectedTaskIds([]);
      return;
    }

    if (!selectedTaskId) {
      setSelectedTaskId(tasks[0].id);
      return;
    }

    if (!tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0].id);
    }

    setSelectedTaskIds((current) => current.filter((id) => tasks.some((task) => task.id === id)));
  }, [selectedTaskId, tasks]);

  const handleCreateTask = async () => {
    if (!title.trim()) {
      setLocalError("Task title is required.");
      return;
    }

    setCreating(true);
    setLocalError(null);
    try {
      const created = await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setSelectedTaskId(created.id);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (task: OpsTask, status: OpsTaskStatus) => {
    setBusyAction(`status:${task.id}:${status}`);
    setLocalError(null);
    try {
      await updateTask(task.id, { status });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSpawnTask = async (taskId: string) => {
    setBusyAction(`spawn:${taskId}`);
    setLocalError(null);
    try {
      await spawnTask(taskId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleSpawnSelected = async () => {
    if (!selectedTaskIds.length) {
      return;
    }
    setBusyAction("spawn:selected");
    setLocalError(null);
    try {
      await spawnBatch(selectedTaskIds);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddNote = async () => {
    if (!selectedTask || !noteDraft.trim()) {
      return;
    }
    setBusyAction(`note:${selectedTask.id}`);
    setLocalError(null);
    try {
      await addNote(selectedTask.id, noteDraft.trim());
      setNoteDraft("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSelectedTask = (taskId: string) => {
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId],
    );
  };

  const allVisibleSelected =
    filteredTasks.length > 0 && filteredTasks.every((task) => selectedTaskIds.includes(task.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedTaskIds((current) =>
        current.filter((id) => !filteredTasks.some((task) => task.id === id)),
      );
      return;
    }

    setSelectedTaskIds((current) => {
      const next = new Set(current);
      for (const task of filteredTasks) {
        next.add(task.id);
      }
      return [...next];
    });
  };

  const sessionEntries: OpsSessionEntry[] = [
    ...(summary?.subagents.sessions ?? []),
    ...(summary?.hooks.sessions ?? []),
    ...(summary?.crons.sessions ?? []),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(error || localError) && (
        <div className="px-4 pt-4 md:px-6">
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              borderColor: "rgba(239, 68, 68, 0.24)",
              color: "#fca5a5",
            }}
          >
            {localError ?? error}
          </div>
        </div>
      )}

      <DashboardScreenLayout
        screenKey="ops"
        renderers={{
          "ops.summary": () => (
            <section
              className="min-w-0 rounded-2xl border p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                    Ops summary
                  </h2>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Live agent activity, hooks, cron, and session totals.
                  </p>
                </div>
                <button
                  onClick={() => void refresh(false)}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-white/5"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <SummaryCard
                  icon={<Bot className="w-5 h-5" />}
                  label="Main Agent"
                  value={summary?.mainAgent?.status === "active" ? "Active" : "Idle"}
                  detail={summary?.mainAgent?.model || "No model reported"}
                />
                <SummaryCard
                  icon={<Users className="w-5 h-5" />}
                  label="Subagents"
                  value={String(summary?.subagents.active ?? 0)}
                  detail={`${summary?.subagents.total ?? 0} total sessions`}
                />
                <SummaryCard
                  icon={<Radio className="w-5 h-5" />}
                  label="Hooks"
                  value={String(summary?.hooks.active ?? 0)}
                  detail={`${summary?.hooks.total ?? 0} total`}
                />
                <SummaryCard
                  icon={<AlarmClock className="w-5 h-5" />}
                  label="Cron"
                  value={String(summary?.crons.active ?? 0)}
                  detail={`${summary?.crons.total ?? 0} total`}
                />
                <SummaryCard
                  icon={<Activity className="w-5 h-5" />}
                  label="Active Sessions"
                  value={String(summary?.activeSessions ?? 0)}
                  detail={`${summary?.groups.total ?? 0} group sessions`}
                />
              </div>
            </section>
          ),
          "ops.create": () => (
            <section
              className="min-w-0 rounded-2xl border p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Create Task
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_140px_auto]">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ship the multi-agent monitor"
                  className="rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional execution notes"
                  className="rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as OpsTaskPriority)}
                  className="rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  onClick={() => void handleCreateTask()}
                  disabled={creating}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #2563eb, #4f46e5)" }}
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </section>
          ),
          "ops.board": () => (
            <section
              className="min-w-0 rounded-2xl border p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-2">
                  <SquareKanban className="w-4 h-4 text-indigo-400" />
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Task Board
                  </h2>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <label
                    className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                    style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    <Search className="w-4 h-4" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search tasks"
                      className="bg-transparent outline-none placeholder:text-inherit"
                      style={{ color: "var(--text-primary)" }}
                    />
                  </label>
                  <button
                    onClick={toggleAllVisible}
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    {allVisibleSelected ? "Clear Visible" : "Select Visible"}
                  </button>
                  <button
                    onClick={() => void handleSpawnSelected()}
                    disabled={!selectedTaskIds.length || busyAction === "spawn:selected"}
                    className="flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #0f766e, #2563eb)" }}
                  >
                    {busyAction === "spawn:selected" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Spawn Selected ({selectedTaskIds.length})
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--text-secondary)" }} />
                </div>
              ) : (
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2 2xl:grid-cols-4">
                  {STATUS_COLUMNS.map((column) => {
                    const columnTasks = filteredTasks
                      .filter((task) => task.status === column.status)
                      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                    return (
                      <div
                        key={column.status}
                        className="min-w-0 rounded-2xl border p-4"
                        style={{ background: "rgba(10, 10, 26, 0.7)", borderColor: "var(--border)" }}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: column.accent }} />
                            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                              {column.title}
                            </h3>
                          </div>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {columnTasks.length}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {columnTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              selected={task.id === selectedTaskId}
                              checked={selectedTaskIds.includes(task.id)}
                              onSelect={() => setSelectedTaskId(task.id)}
                              onToggle={() => toggleSelectedTask(task.id)}
                              onSpawn={() => void handleSpawnTask(task.id)}
                              spawning={busyAction === `spawn:${task.id}`}
                            />
                          ))}

                          {!columnTasks.length && (
                            <div
                              className="rounded-xl border border-dashed px-4 py-6 text-center text-sm"
                              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                            >
                              No tasks here.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ),
          "ops.detail": () => (
            <section
              className="min-w-0 rounded-2xl border p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Task Detail
                </h2>
              </div>

              {selectedTask ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                          {selectedTask.title}
                        </h3>
                        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                          {selectedTask.description || "No description yet."}
                        </p>
                      </div>
                      <PriorityBadge priority={selectedTask.priority} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {STATUS_COLUMNS.map((column) => (
                        <button
                          key={column.status}
                          onClick={() => void handleStatusChange(selectedTask, column.status)}
                          disabled={busyAction === `status:${selectedTask.id}:${column.status}`}
                          className="rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-60"
                          style={{
                            borderColor: selectedTask.status === column.status ? column.accent : "var(--border)",
                            color: selectedTask.status === column.status ? column.accent : "var(--text-secondary)",
                          }}
                        >
                          {busyAction === `status:${selectedTask.id}:${column.status}` ? "Updating..." : column.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <MetaCard label="Assignee" value={selectedTask.assignee || "main"} />
                    <MetaCard label="Source" value={selectedTask.source || "dashboard"} />
                    <MetaCard label="Updated" value={formatRelativeTime(selectedTask.updatedAt)} />
                    <MetaCard label="Created" value={formatRelativeTime(selectedTask.createdAt)} />
                  </div>

                  <button
                    onClick={() => void handleSpawnTask(selectedTask.id)}
                    disabled={busyAction === `spawn:${selectedTask.id}`}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #1d4ed8, #0f766e)" }}
                  >
                    {busyAction === `spawn:${selectedTask.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Respawn Task
                  </button>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-secondary)" }}>
                      Notes
                    </h4>
                    <div className="max-h-64 space-y-3 overflow-x-hidden overflow-y-auto">
                      {[...selectedTask.notes].reverse().map((note, index) => (
                        <div
                          key={`${note.timestamp}-${index}`}
                          className="rounded-xl border px-3 py-3"
                          style={{ background: "var(--background)", borderColor: "var(--border)" }}
                        >
                          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                            {note.text}
                          </p>
                          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
                            {formatRelativeTime(note.timestamp)}
                          </p>
                        </div>
                      ))}
                      {!selectedTask.notes.length && (
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          No notes on this task yet.
                        </p>
                      )}
                    </div>
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="Add an execution note or outcome"
                      className="min-h-28 w-full resize-y rounded-xl border px-3 py-2 text-sm outline-none"
                      style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    />
                    <button
                      onClick={() => void handleAddNote()}
                      disabled={!noteDraft.trim() || busyAction === `note:${selectedTask.id}`}
                      className="w-full rounded-xl border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                    >
                      {busyAction === `note:${selectedTask.id}` ? "Saving..." : "Add Note"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                  Select a task to inspect or update it.
                </div>
              )}
            </section>
          ),
          "ops.sessions": () => (
            <section
              className="min-w-0 rounded-2xl border p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Live Sessions
                </h2>
              </div>

              <div className="max-h-[34rem] space-y-3 overflow-y-auto">
                {summary?.mainAgent ? (
                  <SessionRow
                    title="Main Agent"
                    subtitle={summary.mainAgent.model || summary.mainAgent.channel || "No model reported"}
                    detail={`${summary.mainAgent.totalTokens?.toLocaleString() || "0"} tokens`}
                    active={summary.mainAgent.status === "active"}
                  />
                ) : null}

                {sessionEntries.map((entry) => (
                  <SessionRow
                    key={entry.key}
                    title={entry.label || entry.displayName || entry.key}
                    subtitle={entry.task || entry.model || entry.channel || entry.category}
                    detail={`${entry.category} · ${formatMinutes(entry.ageMinutes)}`}
                    active={entry.isActive}
                  />
                ))}

                {!summary ? (
                  <div className="py-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                    Loading session monitor...
                  </div>
                ) : null}

                {summary && !sessionEntries.length ? (
                  <div className="py-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                    No subagent, hook, or cron sessions are active right now.
                  </div>
                ) : null}
              </div>
            </section>
          ),
        }}
      />
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
        <div style={{ color: "var(--text-secondary)" }}>{icon}</div>
      </div>
      <p className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="mt-1 break-words text-sm" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
    </div>
  );
}

function TaskCard({
  task,
  selected,
  checked,
  onSelect,
  onToggle,
  onSpawn,
  spawning,
}: {
  task: OpsTask;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onSpawn: () => void;
  spawning: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full min-w-0 overflow-hidden rounded-2xl border p-4 text-left transition-colors"
      style={{
        background: selected ? "rgba(59, 130, 246, 0.08)" : "var(--card)",
        borderColor: selected ? "rgba(59, 130, 246, 0.32)" : "var(--border)",
      }}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          onClick={(event) => event.stopPropagation()}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h4 className="min-w-0 break-words pr-2 font-medium leading-6" style={{ color: "var(--text-primary)" }}>
              {task.title}
            </h4>
            <PriorityBadge priority={task.priority} />
          </div>
          <p className="mt-2 break-words text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            {task.description || "No description provided."}
          </p>
          <div className="flex items-center justify-between gap-2 mt-4">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {formatRelativeTime(task.updatedAt)}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSpawn();
              }}
              disabled={spawning}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              {spawning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}

function PriorityBadge({ priority }: { priority: OpsTaskPriority }) {
  const colors =
    priority === "high"
      ? { border: "rgba(239, 68, 68, 0.3)", text: "#fca5a5", bg: "rgba(239, 68, 68, 0.08)" }
      : priority === "low"
        ? { border: "rgba(148, 163, 184, 0.3)", text: "#cbd5e1", bg: "rgba(148, 163, 184, 0.08)" }
        : { border: "rgba(245, 158, 11, 0.3)", text: "#fcd34d", bg: "rgba(245, 158, 11, 0.08)" };

  return (
    <span
      className="rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.15em]"
      style={{ borderColor: colors.border, color: colors.text, background: colors.bg }}
    >
      {priority}
    </span>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border px-3 py-3"
      style={{ background: "var(--background)", borderColor: "var(--border)" }}
    >
      <p className="text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-1 break-words text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function SessionRow({
  title,
  subtitle,
  detail,
  active,
}: {
  title: string;
  subtitle: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-3"
      style={{ background: "var(--background)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {title}
          </p>
          <p className="text-xs mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
            {subtitle}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.15em]"
          style={{
            color: active ? "#86efac" : "#cbd5e1",
            background: active ? "rgba(34, 197, 94, 0.12)" : "rgba(148, 163, 184, 0.12)",
          }}
        >
          {active ? "Active" : "Idle"}
        </span>
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
    </div>
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value;
  }
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.round(diffMs / 60000);
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m old`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m old`;
}
