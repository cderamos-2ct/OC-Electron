"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useShellCommandContext } from "@/components/ShellCommandContext";
import { useHeaderActions } from "@/components/HeaderActionsContext";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import { useAgentOps } from "@/hooks/use-agent-ops";
import { ArrowLeft, Bot, ChevronDown, ChevronRight, Mail, RefreshCcw, Send, User } from "lucide-react";
import type { HealthStatus, NeedsChristianItem, AgentTaskSummary } from "@/lib/types";
import type { OpsTask, OpsTaskStatus } from "@/lib/ops-types";
import { usePersonalOps } from "@/hooks/use-personal-ops";
import type { CommsBoardItem } from "@/lib/personal-ops-types";
import { COMMS_BUCKET_META } from "@/lib/personal-ops-types";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OpenClawOverviewPage() {
  const { isConnected, state, rpc, subscribe } = useOpenClaw();
  const { setActiveContext } = useShellCommandContext();
  const setHeaderActions = useHeaderActions();
  const { visibility: agentVisibility } = useOpenClawAgents();
  const { tasks: opsTasks, visibility: opsVisibility, updateTask, addNote } = useAgentOps();
  const { snapshot: commsSnapshot } = usePersonalOps();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    rpc("health").then((r: any) => setHealth(r));
  }, [isConnected, rpc]);

  useEffect(() => {
    if (!isConnected) return;
    return subscribe("health", (payload) => {
      if (payload && typeof payload === "object") setHealth(payload as HealthStatus);
    });
  }, [isConnected, subscribe]);

  // Gateway indicator in topbar — always visible, green when connected, muted gray when offline
  const gatewayOk = health?.ok || state === "connected";
  const gatewayColor = gatewayOk ? "#34d399" : "var(--text-muted)";
  const gatewayLabel = gatewayOk ? (health?.ok ? "Healthy" : "Live") : "Offline";
  useEffect(() => {
    setHeaderActions(
      <span className="hidden items-center gap-1.5 text-xs font-medium sm:inline-flex" style={{ color: gatewayColor }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: gatewayColor, boxShadow: gatewayOk ? `0 0 6px ${gatewayColor}` : "none" }} />
        {gatewayLabel}
      </span>,
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, gatewayOk, gatewayColor, gatewayLabel]);

  // Data
  const serverVisibility = opsVisibility ?? agentVisibility;
  const needsYou = serverVisibility?.needsChristian ?? [];
  const rollups = serverVisibility?.rollups ?? [];
  const currentTasks = serverVisibility?.taskState.find((b) => b.key === "current")?.tasks ?? [];
  const pendingTasks = serverVisibility?.taskState.find((b) => b.key === "pending")?.tasks ?? [];
  const blockedTasks = serverVisibility?.taskState.find((b) => b.key === "blocked")?.tasks ?? [];
  const recentCompletions = useMemo(
    () => rollups.filter((item) => item.kind === "completed" || item.kind === "fyi").slice(0, 5),
    [rollups],
  );

  const needsYouIds = useMemo(() => new Set(needsYou.map((item) => item.id)), [needsYou]);

  // Separate ongoing/recurring lanes from discrete tasks
  const isOngoingLane = (title: string) =>
    /managed\s+(operating\s+)?lane|maintain\s|continuous|recurring|standing\s+order/i.test(title);

  const dedupedRunning = useMemo(
    () => currentTasks.filter((t) => !needsYouIds.has(t.id) && !isOngoingLane(t.title)),
    [currentTasks, needsYouIds],
  );
  const dedupedPending = useMemo(
    () => pendingTasks.filter((t) => !needsYouIds.has(t.id) && !isOngoingLane(t.title)),
    [pendingTasks, needsYouIds],
  );
  const dedupedBlocked = useMemo(
    () => blockedTasks.filter((t) => !needsYouIds.has(t.id) && !isOngoingLane(t.title)),
    [blockedTasks, needsYouIds],
  );
  const ongoingLanes = useMemo(
    () => currentTasks.filter((t) => !needsYouIds.has(t.id) && isOngoingLane(t.title)),
    [currentTasks, needsYouIds],
  );

  // Comms triage — urgent + needs_reply email items from personal ops snapshot
  const triageItems = useMemo(() => {
    if (!commsSnapshot) return [];
    return [
      ...commsSnapshot.board.buckets.urgent,
      ...commsSnapshot.board.buckets.needs_reply,
    ].filter((item) => item.source_type === "email");
  }, [commsSnapshot]);

  // Selected task detail
  const selectedOpsTask = useMemo(() => opsTasks.find((t) => t.id === selectedTaskId) ?? null, [opsTasks, selectedTaskId]);
  const selectedNeedsItem = useMemo(() => needsYou.find((t) => t.id === selectedTaskId) ?? null, [needsYou, selectedTaskId]);

  const selectTask = (
    id: string,
    opts?: {
      agentId?: string | null;
      sessionKey?: string | null;
      routeBackTo?: { kind: "task" | "needs_christian" | "rollup"; taskId: string; agentId?: string | null; sessionKey?: string | null } | null;
      suggestedReplies?: Array<{ label: string; text: string }>;
    },
  ) => {
    setSelectedTaskId(id);
    setNoteDraft("");
    const task = opsTasks.find((t) => t.id === id);
    const agentId = opts?.agentId ?? task?.assignee ?? null;
    const route = opts?.routeBackTo ?? { kind: "task" as const, taskId: id, agentId, sessionKey: opts?.sessionKey ?? null };
    setActiveContext({
      id: `task:${id}`,
      kind: "task",
      title: task?.title ?? id,
      description: task?.description ?? "",
      sourceLabel: "Home",
      taskId: id,
      agentId,
      sessionKey: opts?.sessionKey ?? route.sessionKey ?? null,
      status: task?.status ?? null,
      priority: task?.priority ?? null,
      routeBackTo: route,
      suggestedReplies: opts?.suggestedReplies,
    });
  };

  const handleStatusChange = async (taskId: string, status: OpsTaskStatus) => {
    setBusy(true);
    try { await updateTask(taskId, { status }); } finally { setBusy(false); }
  };

  const handleAddNote = async () => {
    const text = noteDraft.trim();
    if (!text || !selectedTaskId) return;
    setBusy(true);
    try {
      await addNote(selectedTaskId, text);
      setNoteDraft("");
    } finally { setBusy(false); }
  };

  const gwConnected = isConnected;

  // ── Render ──
  if (selectedTaskId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {!gwConnected && (
          <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs font-medium text-amber-400">
            <span>⚠</span>
            <span>Gateway offline — showing cached data</span>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
          <TaskDetailView
            taskId={selectedTaskId}
            opsTask={selectedOpsTask}
            needsItem={selectedNeedsItem}
            busy={busy}
            noteDraft={noteDraft}
            onNoteDraftChange={setNoteDraft}
            onAddNote={handleAddNote}
            onStatusChange={handleStatusChange}
            onBack={() => setSelectedTaskId(null)}
            rpc={rpc}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!gwConnected && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs font-medium text-amber-400">
          <span>⚠</span>
          <span>Gateway offline — showing cached data</span>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
      {/* ── Summary strip ── */}
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border px-4 py-2.5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <CountChip icon={<User className="h-3 w-3" />} label="You" value={needsYou.length} tone={needsYou.length ? "orange" : "slate"} />
        <CountChip icon={<Bot className="h-3 w-3" />} label="Agents" value={dedupedRunning.length} tone="green" />
        <CountChip label="Queued" value={dedupedPending.length} tone={dedupedPending.length ? "slate" : "slate"} />
        <CountChip label="Blocked" value={dedupedBlocked.length} tone={dedupedBlocked.length ? "red" : "slate"} />
      </div>

      {/* ── Ongoing lanes ── */}
      {ongoingLanes.length > 0 && (
        <div
          className="mt-3 rounded-2xl border px-3 py-2"
          style={{ borderColor: "rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.05)" }}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <RefreshCcw className="h-3 w-3" style={{ color: "#a78bfa" }} />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#a78bfa" }}>Ongoing Lanes</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{ongoingLanes.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {ongoingLanes.map((lane) => {
              // Shorten "Make X a managed (operating) lane for Y" → "X"
              const short = lane.title
                .replace(/^Make\s+/i, "")
                .replace(/\s+a\s+managed\s+(operating\s+)?lane.*/i, "")
                .replace(/\s+with\s+.*/i, "")
                .replace(/\s+across\s+.*/i, "")
                .replace(/\s+for\s+.*/i, "");
              const label = short.length > 40 ? `${short.slice(0, 37)}…` : short;
              return (
                <button
                  key={lane.id}
                  type="button"
                  onClick={() => selectTask(lane.id, { agentId: lane.ownerAgent })}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-white/[0.04]"
                  style={{ borderColor: "rgba(139,92,246,0.25)", color: "var(--text-primary)" }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#a78bfa" }} />
                  <span className="font-medium">{label}</span>
                  {lane.ownerAgent && (
                    <span className="text-[10px]" style={{ color: "#a78bfa" }}>{lane.ownerAgent}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Comms triage queue ── */}
      {triageItems.length > 0 && (
        <CommsQueueStrip items={triageItems} readOnly={commsSnapshot?.capabilities?.readOnly ?? true} onSelectTask={selectTask} rpc={rpc} />
      )}

      {/* ── Kanban columns ── */}
      <div className="mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* YOUR tasks — warm orange tint */}
        <KanbanColumn
          title="Needs You"
          subtitle="Waiting for your input"
          count={needsYou.length}
          accent="#fb923c"
          headerBg="rgba(251,146,60,0.08)"
          icon={<User className="h-3.5 w-3.5" style={{ color: "#fb923c" }} />}
        >
          {needsYou.map((item) => (
            <NeedsYouCard
              key={item.id}
              item={item}
              rpc={rpc}
              onClick={() => {
                const sk = item.routeBackTo?.sessionKey ?? null;
                selectTask(item.id, {
                  agentId: item.ownerAgentId,
                  sessionKey: sk,
                  routeBackTo: item.routeBackTo ?? { kind: "needs_christian", taskId: item.id, agentId: item.ownerAgentId, sessionKey: sk },
                  suggestedReplies: item.suggestedReplies,
                });
              }}
            />
          ))}
        </KanbanColumn>

        {/* AGENT tasks — green tint */}
        <KanbanColumn
          title="Agents Working"
          subtitle="Autonomous execution"
          count={dedupedRunning.length}
          accent="#34d399"
          headerBg="rgba(52,211,153,0.08)"
          icon={<Bot className="h-3.5 w-3.5" style={{ color: "#34d399" }} />}
        >
          {dedupedRunning.map((task) => (
            <AgentTaskCard
              key={task.id}
              task={task}
              onClick={() => selectTask(task.id, { agentId: task.ownerAgent })}
            />
          ))}
        </KanbanColumn>

        {/* QUEUED / PENDING — tasks waiting to be picked up */}
        <KanbanColumn
          title="Queued"
          subtitle="Pending execution"
          count={dedupedPending.length}
          accent="#a78bfa"
          headerBg="rgba(167,139,250,0.08)"
        >
          {dedupedPending.map((task) => (
            <AgentTaskCard
              key={task.id}
              task={task}
              onClick={() => selectTask(task.id, { agentId: task.ownerAgent })}
            />
          ))}
        </KanbanColumn>

        {/* BLOCKED */}
        <KanbanColumn title="Blocked" count={dedupedBlocked.length} accent="#f97316">
          {dedupedBlocked.map((task) => (
            <AgentTaskCard
              key={task.id}
              task={task}
              onClick={() => selectTask(task.id, { agentId: task.ownerAgent })}
            />
          ))}
        </KanbanColumn>
      </div>

      {/* ── Recent ── */}
      {recentCompletions.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>Recent</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {recentCompletions.map((item) => (
              <span key={item.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="uppercase" style={{ color: "var(--text-muted)" }}>{item.kind}</span>
                {" "}{item.title}
              </span>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Comms triage queue strip                                           */
/* ------------------------------------------------------------------ */

type RpcFn = ReturnType<typeof useOpenClaw>["rpc"];

function buildGmailUrl(item: CommsBoardItem): string | null {
  if (!item.sourceThreadId) return null;
  return `https://mail.google.com/mail/u/0/#inbox/${item.sourceThreadId}`;
}

function sendToCD(rpc: RpcFn, message: string) {
  return rpc("chat.send", {
    sessionKey: "agent:main:cd",
    message,
    idempotencyKey: crypto.randomUUID(),
  });
}

function CommsQueueStrip({
  items,
  readOnly,
  onSelectTask,
  rpc,
}: {
  items: CommsBoardItem[];
  readOnly: boolean;
  onSelectTask: (id: string, opts?: any) => void;
  rpc: RpcFn;
}) {
  const [stripFeedback, setStripFeedback] = useState<string | null>(null);

  const showStripFeedback = useCallback((msg: string) => {
    setStripFeedback(msg);
    setTimeout(() => setStripFeedback(null), 3000);
  }, []);

  return (
    <div
      className="mt-3 rounded-2xl border px-3 py-2.5"
      style={{ borderColor: "rgba(251,113,133,0.2)", background: "rgba(251,113,133,0.04)" }}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Mail className="h-3 w-3" style={{ color: "#fb7185" }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#fb7185" }}>
          Email Triage
        </span>
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{items.length}</span>
        {stripFeedback && (
          <span className="ml-auto text-[10px] font-medium" style={{ color: "#facc15" }}>{stripFeedback}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <CommsTriageCard
            key={item.id}
            item={item}
            readOnly={readOnly}
            onSelectTask={onSelectTask}
            rpc={rpc}
            onFeedback={showStripFeedback}
          />
        ))}
      </div>
    </div>
  );
}

function CommsTriageCard({
  item,
  readOnly,
  onSelectTask,
  rpc,
  onFeedback,
}: {
  item: CommsBoardItem;
  readOnly: boolean;
  onSelectTask: (id: string, opts?: any) => void;
  rpc: RpcFn;
  onFeedback: (msg: string) => void;
}) {
  const meta = COMMS_BUCKET_META[item.bucket];
  const linkedTask = item.linkedTaskId;
  const linkedTaskInfo = item.linkedTask;
  const [sending, setSending] = useState<string | null>(null); // key of the button being sent

  async function handleCDAction(key: string, message: string) {
    setSending(key);
    try {
      await sendToCD(rpc, message);
      onFeedback("Sent to CD ✓");
    } catch {
      onFeedback("Failed to send — gateway offline?");
    } finally {
      setTimeout(() => setSending(null), 2000);
    }
  }

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    const url = buildGmailUrl(item);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      onFeedback("No email URL available for this thread");
    }
  }

  function handleLinkTask(e: React.MouseEvent) {
    e.stopPropagation();
    if (linkedTask) {
      onSelectTask(linkedTask, { agentId: linkedTaskInfo?.ownerAgent ?? null });
      return;
    }
    const taskId = window.prompt("Enter task ID to link:");
    if (taskId?.trim()) {
      handleCDAction("link_task", `[Comms Action] Link ${item.subject} to task ${taskId.trim()}`);
    }
  }

  return (
    <div
      className="rounded-xl border px-3 py-2"
      style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{ borderColor: `${meta.accent}44`, color: meta.accent }}
            >
              {meta.label}
            </span>
            <span className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {item.subject}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <span className="truncate">{item.sourceAccount} · {item.displayName}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          {/* Open */}
          <button
            type="button"
            onClick={handleOpen}
            className="rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-white/[0.06]"
            style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
          >
            Open
          </button>
          {/* Link Task */}
          <button
            type="button"
            disabled={sending === "link_task"}
            onClick={handleLinkTask}
            className="rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 hover:enabled:bg-white/[0.06]"
            style={{ borderColor: linkedTask ? "rgba(251,113,133,0.3)" : "rgba(255,255,255,0.08)", color: linkedTask ? "#fb7185" : "var(--text-secondary)" }}
            title={linkedTask ? (linkedTaskInfo?.title ?? `Linked: ${linkedTask}`) : "Link to a task"}
          >
            {linkedTask ? `🔗 ${linkedTask}` : "Link Task"}
          </button>
          {/* Follow Up */}
          <button
            type="button"
            disabled={sending === "follow_up"}
            onClick={(e) => { e.stopPropagation(); handleCDAction("follow_up", `[Comms Action] Set follow-up on "${item.subject}"`); }}
            className="rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 hover:enabled:bg-white/[0.06]"
            style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
          >
            {sending === "follow_up" ? "Sending…" : "Follow Up"}
          </button>
          {/* Archive */}
          <button
            type="button"
            disabled={sending === "archive"}
            onClick={(e) => { e.stopPropagation(); handleCDAction("archive", `[Comms Action] Archive "${item.subject}" from ${item.sourceAccount}`); }}
            className="rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 hover:enabled:bg-white/[0.06]"
            style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
            title={readOnly ? "Will send request to CD" : "Archive"}
          >
            {sending === "archive" ? "Sending…" : "Archive"}
          </button>
          {/* Mark Read */}
          <button
            type="button"
            disabled={sending === "mark_read"}
            onClick={(e) => { e.stopPropagation(); handleCDAction("mark_read", `[Comms Action] Mark read "${item.subject}" from ${item.sourceAccount}`); }}
            className="rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 hover:enabled:bg-white/[0.06]"
            style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
            title={readOnly ? "Will send request to CD" : "Mark Read"}
          >
            {sending === "mark_read" ? "Sending…" : "Mark Read"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary count chip                                                 */
/* ------------------------------------------------------------------ */

function CountChip({ icon, label, value, tone = "slate" }: { icon?: React.ReactNode; label: string; value: number; tone?: "green" | "orange" | "red" | "slate" }) {
  const color = tone === "green" ? "#34d399" : tone === "orange" ? "#fb923c" : tone === "red" ? "#f97316" : "var(--text-primary)";
  return (
    <div className="flex items-center gap-1.5">
      {icon && <span style={{ color }}>{icon}</span>}
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Kanban column                                                      */
/* ------------------------------------------------------------------ */

function KanbanColumn({
  title, subtitle, count, accent, headerBg, icon, children,
}: {
  title: string; subtitle?: string; count: number; accent: string;
  headerBg?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid var(--border)`, background: headerBg }}>
        {icon ?? <span className="inline-block h-2 w-2 rounded-full" style={{ background: accent }} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{title}</span>
            <span className="text-xs font-semibold" style={{ color: accent }}>{count}</span>
          </div>
          {subtitle && <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{subtitle}</div>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {items.length ? (
          <div className="flex flex-col gap-1">{items}</div>
        ) : (
          <div className="py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>None</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  "Needs You" card — YOUR tasks, warm orange tint                    */
/* ------------------------------------------------------------------ */

const URGENCY_LABEL: Record<string, { text: string; color: string }> = {
  needs_now: { text: "NOW", color: "#ef4444" },
  attention_soon: { text: "SOON", color: "#fb923c" },
  fyi: { text: "FYI", color: "#6b7280" },
};

function NeedsYouCard({ item, onClick, rpc }: { item: NeedsChristianItem; onClick: () => void; rpc: RpcFn }) {
  const urgency = item.urgency ? URGENCY_LABEL[item.urgency] : null;
  const [chipSent, setChipSent] = useState<string | null>(null); // label of sent chip

  async function handleChipClick(e: React.MouseEvent, replyText: string, label: string) {
    e.stopPropagation();
    setChipSent(label);
    try {
      await sendToCD(rpc, `[Decision on ${item.id}] ${replyText}`);
    } catch {
      // ignore — CD offline, feedback still shows then fades
    } finally {
      setTimeout(() => setChipSent(null), 2000);
    }
  }

  const replies = item.suggestedReplies ?? [];

  return (
    <div
      className="w-full rounded-xl border px-2.5 py-2 text-left transition-colors hover:border-[rgba(251,146,60,0.4)] cursor-pointer"
      style={{ background: "rgba(251,146,60,0.06)", borderColor: "rgba(251,146,60,0.18)" }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
    >
      <div className="flex items-start gap-2">
        <User className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#fb923c" }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{item.id}</span>
            {urgency && (
              <span className="shrink-0 rounded px-1 text-[9px] font-bold" style={{ background: `${urgency.color}20`, color: urgency.color }}>{urgency.text}</span>
            )}
            <span className="min-w-0 truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>{item.title}</span>
          </div>
          {item.reason && (
            <div className="mt-0.5 truncate text-[11px]" style={{ color: "#fb923c" }}>{item.reason}</div>
          )}
          {item.ownerAgentId && (
            <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>via {item.ownerAgentId}</div>
          )}
        </div>
      </div>
      {replies.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {replies.map((reply) => (
            <button
              key={reply.label}
              type="button"
              onClick={(e) => handleChipClick(e, reply.text, reply.label)}
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all hover:bg-[rgba(251,146,60,0.15)]"
              style={{
                borderColor: chipSent === reply.label ? "rgba(251,146,60,0.6)" : "rgba(251,146,60,0.3)",
                color: chipSent === reply.label ? "#fb923c" : "var(--text-secondary)",
              }}
            >
              {chipSent === reply.label ? `${reply.label} ✓` : reply.label}
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all hover:bg-white/[0.06]"
            style={{ borderColor: "rgba(255,255,255,0.12)", color: "var(--text-muted)" }}
          >
            Other…
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Agent task card — AGENT tasks, green tint with agent badge         */
/* ------------------------------------------------------------------ */

function AgentTaskCard({ task, onClick }: { task: AgentTaskSummary; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#34d399" }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{task.id}</span>
            <span className="min-w-0 truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>{task.title}</span>
          </div>
          {task.ownerAgent && (
            <div className="mt-0.5 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#34d399" }} />
              <span className="text-[10px] font-medium" style={{ color: "#34d399" }}>{task.ownerAgent}</span>
              {task.latestActivity && (
                <span className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>· {task.latestActivity}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Task detail view                                                   */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS: Array<{ value: OpsTaskStatus; label: string; accent: string }> = [
  { value: "new", label: "Queued", accent: "#f59e0b" },
  { value: "in-progress", label: "Running", accent: "#3b82f6" },
  { value: "blocked", label: "Blocked", accent: "#f97316" },
  { value: "done", label: "Done", accent: "#22c55e" },
  { value: "failed", label: "Failed", accent: "#ef4444" },
];

function TaskDetailView({
  taskId,
  opsTask,
  needsItem,
  busy,
  noteDraft,
  onNoteDraftChange,
  onAddNote,
  onStatusChange,
  onBack,
  rpc,
}: {
  taskId: string;
  opsTask: OpsTask | null;
  needsItem: NeedsChristianItem | null;
  busy: boolean;
  noteDraft: string;
  onNoteDraftChange: (v: string) => void;
  onAddNote: () => void;
  onStatusChange: (taskId: string, status: OpsTaskStatus) => void;
  onBack: () => void;
  rpc: RpcFn;
}) {
  const title = opsTask?.title ?? needsItem?.title ?? taskId;
  const description = opsTask?.description || "";
  const content = opsTask?.content || "";
  const status = opsTask?.status ?? needsItem?.status ?? "new";
  const priority = opsTask?.priority ?? needsItem?.priority ?? "medium";
  const assignee = opsTask?.assignee ?? needsItem?.ownerAgentId ?? "unassigned";
  const updatedAt = opsTask?.updatedAt ?? needsItem?.updatedAt ?? "";
  const notes = opsTask?.notes ?? [];
  const blockedBy = needsItem?.blockedBy?.[0] ?? "";
  const reason = blockedBy || needsItem?.reason || "";
  const nextStep = needsItem?.nextStep ?? "";
  const suggestedReplies = needsItem?.suggestedReplies ?? [];

  const [decisionSending, setDecisionSending] = useState<string | null>(null);
  const [decisionInput, setDecisionInput] = useState("");
  const [decisionFeedback, setDecisionFeedback] = useState<string | null>(null);

  async function sendDecision(text: string, key: string) {
    setDecisionSending(key);
    try {
      await sendToCD(rpc, `[Decision on ${taskId}] ${text}`);
      setDecisionFeedback("Sent ✓");
    } catch {
      setDecisionFeedback("Failed — gateway offline?");
    } finally {
      setTimeout(() => { setDecisionSending(null); setDecisionFeedback(null); }, 2500);
    }
  }

  const timeAgo = updatedAt ? formatTimeAgo(updatedAt) : "";

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{taskId}</span>
            <h1 className="text-lg font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>{title}</h1>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>{assignee}</span>
            {timeAgo && <><span>·</span><span>{timeAgo}</span></>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge text={priority} tone={priority === "high" ? "orange" : "slate"} />
          <Badge text={status} tone={status === "blocked" ? "orange" : status === "done" ? "green" : "slate"} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
        {/* Blocker / decision prompt (from needsChristian) */}
        {reason && (
          <DetailSection title="What's needed">
            <div
              className="rounded-lg border px-3 py-2.5 text-sm font-medium leading-6"
              style={{ borderColor: "rgba(251,146,60,0.35)", background: "rgba(251,146,60,0.06)", color: "var(--text-primary)" }}
            >
              {reason}
            </div>
          </DetailSection>
        )}

        {/* Description */}
        {description && (
          <DetailSection title="Description">
            <p className="whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{description}</p>
          </DetailSection>
        )}

        {/* Content (full body — current state, acceptance, etc.) */}
        {content && (
          <DetailSection title="Detail">
            <div className="whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{content}</div>
          </DetailSection>
        )}

        {/* Next step */}
        {nextStep && (
          <DetailSection title="Next step">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{nextStep}</p>
          </DetailSection>
        )}

        {/* Quick Decisions — inline reply chips from needsChristian */}
        {suggestedReplies.length > 0 && (
          <DetailSection title="Quick Decisions">
            <div className="flex flex-wrap gap-1.5">
              {suggestedReplies.map((reply) => (
                <button
                  key={reply.label}
                  type="button"
                  disabled={!!decisionSending}
                  onClick={() => sendDecision(reply.text, reply.label)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                  style={{
                    borderColor: decisionSending === reply.label ? "#fb923c" : "rgba(251,146,60,0.35)",
                    background: decisionSending === reply.label ? "rgba(251,146,60,0.15)" : "transparent",
                    color: decisionSending === reply.label ? "#fb923c" : "var(--text-secondary)",
                  }}
                >
                  {decisionSending === reply.label ? `${reply.label} ✓` : reply.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={decisionInput}
                onChange={(e) => setDecisionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && decisionInput.trim() && !decisionSending) {
                    sendDecision(decisionInput.trim(), "__custom__");
                    setDecisionInput("");
                  }
                }}
                placeholder="Or type your decision…"
                className="flex-1 rounded-xl border bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-[color:var(--text-muted)]"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <button
                type="button"
                disabled={!decisionInput.trim() || !!decisionSending}
                onClick={() => { sendDecision(decisionInput.trim(), "__custom__"); setDecisionInput(""); }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{ background: "var(--primary)", color: "var(--text-on-primary)" }}
              >
                <Send className="h-3 w-3" />
                Send
              </button>
            </div>
            {decisionFeedback && (
              <div className="mt-1 text-xs font-medium" style={{ color: "#34d399" }}>{decisionFeedback}</div>
            )}
          </DetailSection>
        )}

        {/* Status controls */}
        <DetailSection title="Status">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={busy || status === opt.value}
                onClick={() => onStatusChange(taskId, opt.value)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                style={{
                  borderColor: status === opt.value ? opt.accent : "var(--border)",
                  background: status === opt.value ? `${opt.accent}20` : "transparent",
                  color: status === opt.value ? opt.accent : "var(--text-secondary)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </DetailSection>

        {/* Notes + Activity (split view) */}
        <NotesAndActivity
          notes={notes}
          busy={busy}
          noteDraft={noteDraft}
          onNoteDraftChange={onNoteDraftChange}
          onAddNote={onAddNote}
        />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Notes + Activity split                                             */
/* ------------------------------------------------------------------ */

// Agent activity entries typically start with "agentName: ..." (e.g. "CD:", "finance:", "main:")
const ACTIVITY_PREFIX = /^[a-zA-Z][\w-]{0,28}:\s/;

function NotesAndActivity({
  notes,
  busy,
  noteDraft,
  onNoteDraftChange,
  onAddNote,
}: {
  notes: Array<{ text: string; timestamp: string }>;
  busy: boolean;
  noteDraft: string;
  onNoteDraftChange: (v: string) => void;
  onAddNote: () => void;
}) {
  const [activityOpen, setActivityOpen] = useState(false);

  // Split: activity = agent-prefixed auto-generated entries, notes = everything else
  const activity: typeof notes = [];
  const humanNotes: typeof notes = [];
  for (const note of notes) {
    if (ACTIVITY_PREFIX.test(note.text)) {
      activity.push(note);
    } else {
      humanNotes.push(note);
    }
  }

  return (
    <>
      {/* Notes — persistent comments (human or agent authored) */}
      <DetailSection title={`Notes${humanNotes.length ? ` (${humanNotes.length})` : ""}`}>
        {humanNotes.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {humanNotes.map((note, i) => (
              <div key={i} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
                <div className="text-sm leading-5" style={{ color: "var(--text-secondary)" }}>{note.text}</div>
                <div className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{formatTimestamp(note.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={noteDraft}
            onChange={(e) => onNoteDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onAddNote(); }
            }}
            rows={2}
            placeholder="Add a note…"
            className="flex-1 resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-[color:var(--text-muted)]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={onAddNote}
            disabled={busy || !noteDraft.trim()}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--primary)", color: "var(--text-on-primary)" }}
          >
            <Send className="h-3 w-3" />
            Add
          </button>
        </div>
      </DetailSection>

      {/* Activity log — agent-generated progress (collapsible) */}
      {activity.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setActivityOpen(!activityOpen)}
            className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {activityOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Activity log ({activity.length})
          </button>
          {activityOpen && (
            <div className="mt-2 flex flex-col gap-1.5">
              {activity.map((entry, i) => {
                const colonIdx = entry.text.indexOf(":");
                const agent = colonIdx > 0 ? entry.text.slice(0, colonIdx).trim() : null;
                const body = agent ? entry.text.slice(colonIdx + 1).trim() : entry.text;
                return (
                  <div key={i} className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center justify-between gap-2">
                      {agent && <span className="text-[10px] font-medium" style={{ color: "#a78bfa" }}>{agent}</span>}
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{formatTimestamp(entry.timestamp)}</span>
                    </div>
                    <div className="mt-0.5 text-xs leading-5" style={{ color: "var(--text-muted)" }}>{body}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{title}</h3>
      {children}
    </div>
  );
}

function Badge({ text, tone = "slate" }: { text: string; tone?: "green" | "orange" | "slate" }) {
  const color = tone === "green" ? "#34d399" : tone === "orange" ? "#fb923c" : "var(--text-secondary)";
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{ borderColor: tone !== "slate" ? `${color}40` : "var(--border)", color }}
    >
      {text}
    </span>
  );
}

function formatTimeAgo(isoOrMs: string): string {
  const ms = Date.parse(isoOrMs);
  if (!Number.isFinite(ms)) return "";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(isoOrMs: string): string {
  try {
    return new Date(isoOrMs).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoOrMs;
  }
}
