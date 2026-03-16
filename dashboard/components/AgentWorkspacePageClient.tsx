"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, BrainCircuit, ChevronRight, MessageSquareMore, Radio, RefreshCw, Workflow, X } from "lucide-react";
import { useShellCommandContext } from "@/components/ShellCommandContext";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import { useAgentOps } from "@/hooks/use-agent-ops";
import type { ChatMessage, ChatMessagePart } from "@/hooks/use-openclaw-chat";
import { buildAgentRosterCards, buildCommandChatView } from "@/lib/command-chat-view";
import type {
  AgentDetail,
  AgentRosterCard,
  AgentTaskSummary,
  InterAgentCommunication,
  OpsTaskLike,
} from "@/lib/types";

type WorkspaceTab = "agents" | "visibility";
type WorkspaceTaskCard = AgentTaskSummary & {
  nextStep?: string | null;
  latestActivity?: string | null;
  blockedBy?: string[];
};

const ACTIVE_TASK_STATUSES = new Set(["in_progress", "review", "blocked", "queued", "new"]);

export function AgentWorkspacePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAgentId = searchParams.get("agent")?.trim().toLowerCase() || null;
  const { setActiveContext, clearActiveContext } = useShellCommandContext();
  const [agentSearch, setAgentSearch] = useState("");
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("agents");
  const deferredAgentSearch = useDeferredValue(agentSearch);

  const {
    agents,
    defaultId,
    visibility: agentVisibility,
    loading: agentsLoading,
    error: agentsError,
    refresh: refreshAgents,
    getAgent,
  } = useOpenClawAgents();
  const {
    tasks,
    visibility: opsVisibility,
    loading: opsLoading,
    refreshing: opsRefreshing,
    error: opsError,
    refresh: refreshOps,
  } = useAgentOps();

  const serverVisibility = opsVisibility ?? agentVisibility;
  const visibilityAgents = serverVisibility?.agents ?? agents;
  const visibilityTaskSummaries = serverVisibility?.tasks ?? [];
  const visibilityTasks = useMemo<OpsTaskLike[]>(
    () =>
      visibilityTaskSummaries.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.ownerAgent,
        updatedAt: task.updatedAt,
      })),
    [visibilityTaskSummaries],
  );
  const visibilitySessions = serverVisibility?.sessions ?? [];
  const effectiveTasks = visibilityTasks.length ? visibilityTasks : tasks;
  const searchableRoster = useMemo<AgentRosterCard[]>(
    () =>
      (serverVisibility?.rosterCards ??
        buildAgentRosterCards({
          agents: visibilityAgents,
          tasks: effectiveTasks,
          sessions: visibilitySessions,
        }))
        .filter((card) => card.id !== "cd"),
    [effectiveTasks, serverVisibility?.rosterCards, visibilityAgents, visibilitySessions],
  );

  const rosterCards = useMemo(() => {
    const needle = deferredAgentSearch.trim().toLowerCase();
    if (!needle) {
      return searchableRoster;
    }

    return searchableRoster.filter((card) =>
      [
        card.displayName,
        card.id,
        card.lane,
        card.persona,
        ...card.currentTasks.map((task) => task.title),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [deferredAgentSearch, searchableRoster]);

  const selectedAgentId = useMemo(() => {
    if (requestedAgentId && searchableRoster.some((card) => card.id === requestedAgentId)) {
      return requestedAgentId;
    }

    if (requestedAgentId && visibilityAgents.some((agent) => normalizeText(agent.id) === requestedAgentId)) {
      return requestedAgentId;
    }

    const nonCdDefault = normalizeText(defaultId) !== "cd" ? defaultId : null;
    if (nonCdDefault && searchableRoster.some((card) => card.id === nonCdDefault)) {
      return nonCdDefault;
    }

    return rosterCards[0]?.id ?? searchableRoster[0]?.id ?? visibilityAgents.find((agent) => normalizeText(agent.id) !== "cd")?.id ?? visibilityAgents[0]?.id ?? null;
  }, [defaultId, requestedAgentId, rosterCards, searchableRoster, visibilityAgents]);

  const selectedAgent = useMemo(
    () => visibilityAgents.find((agent) => normalizeText(agent.id) === normalizeText(selectedAgentId)) ?? null,
    [selectedAgentId, visibilityAgents],
  );
  const selectedRosterCard = useMemo(
    () => searchableRoster.find((card) => card.id === selectedAgentId) ?? null,
    [searchableRoster, selectedAgentId],
  );
  const selectedSessionKey = useMemo(() => {
    if (!selectedAgentId) return undefined;
    return (
      selectedAgent?.runtime?.sessionKey?.trim() ||
      selectedRosterCard?.linkedSessions[0]?.key ||
      `agent:${selectedAgentId}:main`
    );
  }, [selectedAgent?.runtime?.sessionKey, selectedAgentId, selectedRosterCard?.linkedSessions]);

  const hasLiveRuntime = Boolean(selectedAgent?.runtime?.sessionKey || selectedRosterCard?.linkedSessions.length);
  const relayLabel = hasLiveRuntime ? "Live relay" : "Canonical relay";
  const relayNote = hasLiveRuntime
    ? "Use the global CD rail on the right to message this lane. The rail will route against the agent's active main session."
    : "Use the global CD rail on the right. No active runtime session was found, so CD will route against the canonical main lane and replies may arrive later.";
  const commandChatView = useMemo(
    () =>
      buildCommandChatView({
        sessions: visibilitySessions,
        agents: visibilityAgents,
        tasks: effectiveTasks,
        activeSessionKey: selectedSessionKey ?? "agent-workspace:empty",
        commandSession: {
          key: "agent:main:main",
          displayName: "Command",
          label: "Chief of Staff",
          agentId: "main",
        },
        needsChristianItems: serverVisibility?.needsChristian ?? undefined,
        rollups: serverVisibility?.rollups ?? undefined,
        taskState: serverVisibility?.taskState ?? undefined,
      }),
    [effectiveTasks, selectedSessionKey, serverVisibility?.needsChristian, serverVisibility?.rollups, serverVisibility?.taskState, visibilityAgents, visibilitySessions],
  );
  const filteredWorkerGroups = useMemo(
    () =>
      commandChatView.backgroundGroups.filter(
        (group) =>
          normalizeText(group.parentAgentId) === normalizeText(selectedAgentId) ||
          group.sessions.some((session) => normalizeText(session.agentId) === normalizeText(selectedAgentId)),
      ),
    [commandChatView.backgroundGroups, selectedAgentId],
  );
  const filteredCommunications = useMemo(
    () =>
      (serverVisibility?.communications ?? []).filter(
        (item) =>
          normalizeText(item.senderAgentId) === normalizeText(selectedAgentId) ||
          item.recipientAgentIds.some((recipient) => normalizeText(recipient) === normalizeText(selectedAgentId)),
      ),
    [selectedAgentId, serverVisibility?.communications],
  );

  useEffect(() => {
    if (!selectedAgentId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let alive = true;
    setDetailLoading(true);
    setDetailError(null);
    void getAgent(selectedAgentId)
      .then((payload) => {
        if (!alive) return;
        setDetail(payload);
      })
      .catch((err) => {
        if (!alive) return;
        setDetailError(err instanceof Error ? err.message : "Failed to load agent detail");
      })
      .finally(() => {
        if (!alive) return;
        setDetailLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [getAgent, selectedAgentId]);

  useEffect(() => {
    setWorkspaceOpen(false);
  }, [selectedAgentId]);

  const runtimeState = selectedAgent?.runtime?.observedState ?? selectedRosterCard?.runtimeState ?? selectedAgent?.status ?? "unknown";
  const selectedTaskCards = useMemo(
    () => buildSelectedTaskCards(selectedAgentId, visibilityTaskSummaries, detail),
    [detail, selectedAgentId, visibilityTaskSummaries],
  );
  const currentTask = selectedTaskCards.active[0] ?? selectedTaskCards.queue[0] ?? null;
  const activityItems = detail?.recentActivity ?? [];
  const communicationFeed = detail?.recentCommunications ?? [];
  const selectedAgentName = selectedRosterCard?.displayName ?? selectedAgent?.displayName ?? "Agent";
  const latestLaneSignal = communicationFeed[0]?.body ?? activityItems[0]?.body ?? currentTask?.latestActivity ?? null;

  useEffect(() => {
    if (!selectedAgentId) {
      setActiveContext(null);
      return;
    }

    setActiveContext({
      id: currentTask ? `agent-workspace:${selectedAgentId}:${currentTask.id}` : `agent-workspace:${selectedAgentId}`,
      kind: currentTask ? "task" : "agent",
      title: currentTask ? `${currentTask.id} · ${currentTask.title}` : `${selectedAgentName} lane overview`,
      description: latestLaneSignal ?? relayNote,
      sourceLabel: "Agent workspace",
      sessionKey: selectedSessionKey ?? null,
      agentId: selectedAgentId,
      taskId: currentTask?.id ?? null,
      status: currentTask?.status ?? runtimeState,
      priority: currentTask?.priority ?? null,
      nextStep: currentTask?.nextStep ?? null,
      routeBackTo: currentTask
        ? { kind: "task", taskId: currentTask.id, agentId: selectedAgentId, sessionKey: selectedSessionKey ?? null }
        : null,
      suggestedReplies: currentTask
        ? [
            { label: "Status", text: "Give me a crisp status, blocker, and next step update." },
            { label: "Need", text: "What do you need from me to move this forward?" },
            { label: "Risks", text: "Surface the main risk or drift I should know about." },
          ]
        : [
            { label: "Focus", text: `What is ${selectedAgentName} focused on right now?` },
            { label: "Blockers", text: "What blocker or dependency is most likely to slow this lane down?" },
          ],
    });
  }, [currentTask, latestLaneSignal, relayNote, runtimeState, selectedAgentId, selectedAgentName, selectedSessionKey, setActiveContext]);

  useEffect(() => () => clearActiveContext(), [clearActiveContext]);

  const refreshAll = async () => {
    await Promise.all([refreshAgents(), refreshOps(true)]);
    if (selectedAgentId) {
      setDetailLoading(true);
      try {
        const payload = await getAgent(selectedAgentId);
        setDetail(payload);
        setDetailError(null);
      } catch (err) {
        setDetailError(err instanceof Error ? err.message : "Failed to refresh agent detail");
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const selectAgent = (agentId: string) => {
    startTransition(() => {
      const next = normalizeText(agentId);
      if (!next) {
        router.replace("/agents/workspace", { scroll: false });
        return;
      }
      router.replace(`/agents/workspace?agent=${encodeURIComponent(next)}`, { scroll: false });
    });
  };

  const workspaceSummary = (
    <div className="rounded-[var(--radius-card)] border p-4" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
            Global CD rail
          </div>
          <div className="mt-2 flex items-center gap-2 text-lg font-semibold font-display" style={{ color: "var(--text-primary)" }}>
            <span>Christian</span>
            <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--primary)" }}>CD</span>
            <ChevronRight className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            <span>{selectedAgentName}</span>
          </div>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: toneBorder(runtimeState), color: toneText(runtimeState) }}>
          {relayLabel}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {relayNote}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric label="Needs Christian" value={String(serverVisibility?.needsChristian?.length ?? 0)} />
        <MiniMetric label="Rollups" value={String(serverVisibility?.rollups?.length ?? 0)} />
        <MiniMetric label="Workers" value={String(filteredWorkerGroups.length)} />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
            Agent Workspace
          </div>
          <h1 className="mt-1 text-3xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Agent workboard with one primary chat surface
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
            Pick an agent, inspect the live lane, and use the global CD rail for chat so the work context and conversation stay in the same shell.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/agents"
            className="rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Back to agents
          </Link>
          {selectedSessionKey ? (
            <Link
              href={`/chat?session=${encodeURIComponent(selectedSessionKey)}`}
              className="rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Open raw session
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <RefreshCw className={`h-4 w-4 ${(agentsLoading || opsLoading || opsRefreshing || detailLoading) ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="hidden min-h-0 xl:flex xl:flex-col xl:gap-4">
          {workspaceSummary}
          <div className="min-h-0 rounded-[var(--radius-shell)] border" style={{ borderColor: "var(--border)", background: "rgba(9, 18, 24, 0.92)" }}>
            <div className="border-b px-4 py-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[var(--primary)]" />
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Agent roster
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.03)" }}>
                <MessageSquareMore className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                <input
                  value={agentSearch}
                  onChange={(event) => setAgentSearch(event.target.value)}
                  placeholder="Search lanes or tasks..."
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="space-y-2">
                {rosterCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => selectAgent(card.id)}
                    className="w-full rounded-2xl border px-3 py-3 text-left transition-colors"
                    style={{
                      borderColor: card.id === selectedAgentId ? "rgba(255, 122, 26, 0.34)" : "var(--border)",
                      background: card.id === selectedAgentId ? "linear-gradient(135deg, rgba(255, 122, 26, 0.16), rgba(99, 211, 189, 0.06))" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {card.emoji || "🤖"} {card.displayName}
                        </div>
                        <div className="mt-1 truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          {[card.lane, card.persona].filter(Boolean).join(" · ") || "Unassigned lane"}
                        </div>
                      </div>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: toneBorder(card.runtimeState), color: toneText(card.runtimeState) }}>
                        {card.runtimeState || "unknown"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      <MiniPane icon={<Workflow className="h-3.5 w-3.5" />} label={`${card.currentTasks.length} current`} />
                      <MiniPane icon={<Radio className="h-3.5 w-3.5" />} label={`${card.linkedSessions.length} sessions`} />
                    </div>
                    <div className="mt-3 line-clamp-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                      {card.currentTasks[0]
                        ? <>Now: <span style={{ color: "var(--text-primary)" }}>{card.currentTasks[0].id}</span> · {card.currentTasks[0].title}</>
                        : "No active task attached."}
                    </div>
                  </button>
                ))}
                {!rosterCards.length ? (
                  <EmptyState
                    title="No agents match this search"
                    detail="Try a different lane, task ID, or agent name."
                  />
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <section className="min-h-0 min-w-0">
          <div className="flex h-full min-h-[42rem] flex-col overflow-hidden rounded-[var(--radius-shell)] border" style={{ borderColor: "var(--border)", background: "rgba(9, 18, 24, 0.92)" }}>
            <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
                    Active lane brief
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                    <span>{selectedAgentName}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border px-2.5 py-1" style={{ borderColor: toneBorder(runtimeState), color: toneText(runtimeState) }}>
                      {runtimeState}
                    </span>
                    {currentTask ? (
                      <span className="rounded-full border px-2.5 py-1" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        {currentTask.id} · {currentTask.status}
                      </span>
                    ) : null}
                    {selectedSessionKey ? (
                      <span className="rounded-full border px-2.5 py-1" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        {selectedSessionKey}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 xl:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceTab("agents");
                      setWorkspaceOpen(true);
                    }}
                    className="rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    Workspace
                  </button>
                </div>
              </div>
            </div>

            <div className="border-b px-5 py-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              Chat is handled in the global CD rail. This page pins the selected lane into that rail so the conversation stays contextual instead of forking into a second composer.
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
              {(agentsError || opsError || detailError) ? (
                <div className="mb-4 rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(248, 113, 113, 0.26)", background: "rgba(248, 113, 113, 0.08)", color: "#fca5a5" }}>
                  {agentsError || opsError || detailError}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                <VisibilityCard
                  title="Pinned into CD"
                  subtitle="This is the work object the global right rail now carries as chat context."
                >
                  <div className="space-y-3">
                    <div className="rounded-xl border px-3 py-3" style={{ borderColor: "rgba(255,122,26,0.2)", background: "rgba(255,122,26,0.07)" }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>
                        Active route
                      </div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {currentTask ? `${currentTask.id} · ${currentTask.title}` : `${selectedAgentName} lane overview`}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        <span>{relayLabel}</span>
                        {currentTask ? <span>{currentTask.priority}</span> : null}
                        {selectedSessionKey ? <span>{selectedSessionKey}</span> : null}
                      </div>
                    </div>
                    {currentTask?.nextStep ? (
                      <div className="rounded-xl border px-3 py-2 text-sm leading-6" style={{ borderColor: "rgba(99,211,189,0.22)", background: "rgba(99,211,189,0.06)", color: "var(--text-primary)" }}>
                        <span className="font-semibold" style={{ color: "#8de7d6" }}>Next step:</span> {currentTask.nextStep}
                      </div>
                    ) : null}
                    {latestLaneSignal ? (
                      <div className="rounded-xl border px-3 py-2 text-sm leading-6" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        {latestLaneSignal}
                      </div>
                    ) : null}
                    <div className="rounded-xl border px-3 py-2 text-sm leading-6" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      {relayNote} On smaller screens, open the rail from the top-bar <span style={{ color: "var(--text-primary)" }}>CD</span> button.
                    </div>
                  </div>
                </VisibilityCard>

                <VisibilityCard
                  title="Latest signal"
                  subtitle="Fastest way to understand what changed before you open the rail."
                >
                  {latestLaneSignal ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
                        <div className="text-sm leading-6" style={{ color: "var(--text-primary)" }}>
                          {latestLaneSignal}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <StatChip label="Workers" value={String(filteredWorkerGroups.length)} />
                        <StatChip label="Comms" value={String(filteredCommunications.length)} />
                        <StatChip label="Activity" value={String(activityItems.length)} />
                        <StatChip label="Runtime" value={runtimeState} tone={runtimeState} />
                      </div>
                    </div>
                  ) : (
                    <EmptyState title="No recent lane signal" detail="The canonical detail feed has not surfaced a recent activity or communication item for this lane yet." compact />
                  )}
                </VisibilityCard>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <VisibilityCard
                  title={`Active work (${selectedTaskCards.active.length})`}
                  subtitle="Current tasks mapped to this lane."
                >
                  <WorkspaceTaskList tasks={selectedTaskCards.active} emptyDetail="No active tasks are currently mapped to this lane." />
                </VisibilityCard>
                <VisibilityCard
                  title={`Queue + parked (${selectedTaskCards.queue.length})`}
                  subtitle="Queued or less-active items still attached to this lane."
                >
                  <WorkspaceTaskList tasks={selectedTaskCards.queue} emptyDetail="No queued or parked tasks are attached to this lane right now." />
                </VisibilityCard>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <VisibilityCard
                  title={`Recent activity (${activityItems.length})`}
                  subtitle="Canonical lane activity without opening a second chat surface."
                >
                  {activityItems.length ? (
                    <div className="space-y-2">
                      {activityItems.slice(0, 4).map((item) => (
                        <FeedRow key={item.id} title={item.title} body={item.body} meta={`${item.source} · ${formatRelativeTime(item.timestamp)}`} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No recent activity" detail="This lane has not published a recent activity item yet." compact />
                  )}
                </VisibilityCard>
                <VisibilityCard
                  title={`Recent coordination (${filteredCommunications.length + communicationFeed.length})`}
                  subtitle="Cross-agent communication and returns touching this lane."
                >
                  {filteredCommunications.length || communicationFeed.length ? (
                    <div className="space-y-2">
                      {filteredCommunications.slice(0, 2).map((item) => (
                        <CommunicationRow key={item.id} communication={item} />
                      ))}
                      {communicationFeed.slice(0, 2).map((item) => (
                        <FeedRow key={item.id} title={item.title} body={item.body} meta={`${item.source} · ${formatRelativeTime(item.timestamp)}`} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No recent coordination" detail="No communications or return feed items are currently mapped for this lane." compact />
                  )}
                </VisibilityCard>
              </div>
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 xl:flex xl:flex-col xl:gap-4">
          <div className="min-h-0 rounded-[var(--radius-shell)] border px-4 py-4" style={{ borderColor: "var(--border)", background: "rgba(9, 18, 24, 0.92)" }}>
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-[var(--accent)]" />
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Visibility stack
              </div>
            </div>
            <div className="mt-4 space-y-4 overflow-y-auto pr-1">
              <VisibilityCard
                title="Current task"
                subtitle="What this agent appears to be driving right now."
              >
                {currentTask ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {currentTask.id} · {currentTask.title}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        {currentTask.status} · {currentTask.priority} · updated {formatRelativeTime(currentTask.updatedAt)}
                      </div>
                    </div>
                    {currentTask.nextStep ? (
                      <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        Next step: {currentTask.nextStep}
                      </div>
                    ) : null}
                    {currentTask.latestActivity ? (
                      <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        Latest activity: {currentTask.latestActivity}
                      </div>
                    ) : null}
                    {currentTask.blockedBy?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {currentTask.blockedBy.map((item) => (
                          <span key={item} className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: "rgba(251, 191, 36, 0.28)", color: "#fbbf24" }}>
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState title="No mapped task" detail="This lane does not currently have an active task tied into the canonical ledger." compact />
                )}
              </VisibilityCard>

              <VisibilityCard
                title="Runtime + trace"
                subtitle="Session health, model, and worker activity for this lane."
              >
                <div className="grid grid-cols-2 gap-2">
                  <StatChip label="State" value={runtimeState || "unknown"} tone={runtimeState} />
                  <StatChip label="Model" value={selectedAgent?.runtime?.model || "Not observed"} />
                  <StatChip label="Last seen" value={selectedAgent?.runtime?.lastSeenAt ? formatRelativeTime(selectedAgent.runtime.lastSeenAt) : "No heartbeat"} />
                  <StatChip label="Workers" value={String(filteredWorkerGroups.length)} />
                </div>
                <div className="mt-3 space-y-2">
                  <PathLike label="Session" value={selectedSessionKey} />
                  <PathLike label="Runtime agent" value={selectedAgent?.runtime?.runtimeAgentId || selectedAgent?.runtimeAgentId || selectedAgent?.id} />
                  <PathLike label="Current task" value={selectedAgent?.runtime?.currentTaskId || currentTask?.id || null} />
                </div>
                {filteredWorkerGroups.length ? (
                  <div className="mt-3 space-y-2">
                    {filteredWorkerGroups.slice(0, 4).map((group) => (
                      <div key={group.groupId} className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {group.label}
                          </div>
                          <span className="text-[11px]" style={{ color: toneText(group.status) }}>
                            {group.status}
                          </span>
                        </div>
                        <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {group.sessions.length} worker session{group.sessions.length === 1 ? "" : "s"} · latest {group.latestSessionAt ? formatRelativeTime(group.latestSessionAt) : "unknown"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    No worker groups are currently linked to this lane.
                  </div>
                )}
              </VisibilityCard>

              <VisibilityCard
                title="Coordination"
                subtitle="Recent lane communications, escalations, and activity."
              >
                <div className="space-y-2">
                  {filteredCommunications.slice(0, 3).map((item) => (
                    <CommunicationRow key={item.id} communication={item} />
                  ))}
                  {!filteredCommunications.length ? (
                    <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      No active inter-agent coordination items are mapped for this lane.
                    </div>
                  ) : null}
                </div>
                {communicationFeed.length ? (
                  <div className="mt-3 space-y-2">
                    {communicationFeed.slice(0, 3).map((item) => (
                      <FeedRow key={item.id} title={item.title} body={item.body} meta={`${item.source} · ${formatRelativeTime(item.timestamp)}`} />
                    ))}
                  </div>
                ) : null}
                {activityItems.length ? (
                  <div className="mt-3 space-y-2">
                    {activityItems.slice(0, 3).map((item) => (
                      <FeedRow key={item.id} title={item.title} body={item.body} meta={`${item.source} · ${formatRelativeTime(item.timestamp)}`} />
                    ))}
                  </div>
                ) : null}
              </VisibilityCard>
            </div>
          </div>
        </aside>
      </div>

      {workspaceOpen ? (
        <div className="fixed inset-0 z-[80] bg-[rgba(3,7,10,0.76)] backdrop-blur-sm xl:hidden">
          <div className="absolute inset-x-3 bottom-3 top-3 flex flex-col overflow-hidden rounded-[var(--radius-shell)] border" style={{ borderColor: "var(--border)", background: "rgba(9, 18, 24, 0.98)" }}>
            <div className="flex items-center justify-between gap-3 border-b px-4 py-4" style={{ borderColor: "var(--border)" }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Workspace
                </div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Change agents or inspect runtime detail without leaving the thread.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWorkspaceOpen(false)}
                className="rounded-full border p-2"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              {(["agents", "visibility"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setWorkspaceTab(tab)}
                  className="rounded-full px-3 py-2 text-sm font-medium"
                  style={{
                    background: workspaceTab === tab ? "var(--primary-soft)" : "transparent",
                    color: workspaceTab === tab ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {tab === "agents" ? "Agents" : "Visibility"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {workspaceTab === "agents" ? (
                <div className="space-y-4">
                  {workspaceSummary}
                  <label className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.03)" }}>
                    <MessageSquareMore className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                    <input
                      value={agentSearch}
                      onChange={(event) => setAgentSearch(event.target.value)}
                      placeholder="Search agents or tasks..."
                      className="w-full bg-transparent text-sm outline-none"
                      style={{ color: "var(--text-primary)" }}
                    />
                  </label>
                  <div className="space-y-2">
                    {rosterCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => selectAgent(card.id)}
                        className="w-full rounded-2xl border px-3 py-3 text-left"
                        style={{
                          borderColor: card.id === selectedAgentId ? "rgba(255, 122, 26, 0.34)" : "var(--border)",
                          background: card.id === selectedAgentId ? "linear-gradient(135deg, rgba(255, 122, 26, 0.16), rgba(99, 211, 189, 0.06))" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {card.emoji || "🤖"} {card.displayName}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {card.currentTasks[0] ? `${card.currentTasks[0].id} · ${card.currentTasks[0].title}` : "No current task"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <VisibilityCard title="Current task" subtitle="Live lane summary.">
                    {currentTask ? (
                      <div>
                        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {currentTask.id} · {currentTask.title}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {currentTask.status} · {currentTask.priority}
                        </div>
                      </div>
                    ) : (
                      <EmptyState title="No mapped task" detail="Nothing active is tied to this lane." compact />
                    )}
                  </VisibilityCard>
                  <VisibilityCard title="Runtime + trace" subtitle="Status, model, and worker visibility.">
                    <div className="grid grid-cols-2 gap-2">
                      <StatChip label="State" value={runtimeState || "unknown"} tone={runtimeState} />
                      <StatChip label="Workers" value={String(filteredWorkerGroups.length)} />
                    </div>
                    <div className="mt-3 space-y-2">
                      <PathLike label="Session" value={selectedSessionKey} />
                      <PathLike label="Model" value={selectedAgent?.runtime?.model || "Not observed"} />
                    </div>
                  </VisibilityCard>
                  <VisibilityCard title="Coordination" subtitle="Recent communication and activity.">
                    <div className="space-y-2">
                      {filteredCommunications.slice(0, 2).map((item) => (
                        <CommunicationRow key={item.id} communication={item} />
                      ))}
                      {communicationFeed.slice(0, 2).map((item) => (
                        <FeedRow key={item.id} title={item.title} body={item.body} meta={`${item.source} · ${formatRelativeTime(item.timestamp)}`} />
                      ))}
                    </div>
                  </VisibilityCard>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildSelectedTaskCards(
  selectedAgentId: string | null,
  visibilityTasks: AgentTaskSummary[],
  detail: AgentDetail | null,
) {
  const visibilityOwned: WorkspaceTaskCard[] = visibilityTasks
    .filter((task) => normalizeText(task.ownerAgent) === normalizeText(selectedAgentId))
    .sort((left, right) => sortByUpdated(right.updatedAt) - sortByUpdated(left.updatedAt));

  const active = visibilityOwned.filter((task) => ACTIVE_TASK_STATUSES.has(normalizeStatus(task.status)));
  const queue = visibilityOwned.filter((task) => !ACTIVE_TASK_STATUSES.has(normalizeStatus(task.status)));

  if (visibilityOwned.length) {
    return { active, queue };
  }

  const fallback: WorkspaceTaskCard[] = (detail?.ownedTasks ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    ownerAgent: task.ownerAgent,
    updatedAt: task.updatedAt,
  }));

  return {
    active: fallback.filter((task) => ACTIVE_TASK_STATUSES.has(normalizeStatus(task.status))),
    queue: fallback.filter((task) => !ACTIVE_TASK_STATUSES.has(normalizeStatus(task.status))),
  };
}

function MessageBubble({
  message,
  selectedAgent,
}: {
  message: ChatMessage;
  selectedAgent: string;
}) {
  const isUser = message.role === "user";
  const bubbleBackground = isUser
    ? "linear-gradient(135deg, rgba(255, 122, 26, 0.22), rgba(255, 122, 26, 0.08))"
    : "rgba(255,255,255,0.04)";
  const provenanceLabel = isUser ? "routed by CD" : "returned for Christian";
  const speakerLabel = isUser ? "Christian via CD" : `${selectedAgent} via CD`;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[88%] rounded-[24px] border px-4 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.18)]"
        style={{
          borderColor: isUser ? "rgba(255, 122, 26, 0.24)" : "var(--border)",
          background: bubbleBackground,
        }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          <span>{speakerLabel}</span>
          <span className="rounded-full border px-2 py-0.5" style={{ borderColor: isUser ? "rgba(255, 122, 26, 0.24)" : "rgba(99, 211, 189, 0.26)", color: isUser ? "#fed7aa" : "#8de7d6" }}>
            {provenanceLabel}
          </span>
          <span>{formatRelativeTime(message.timestamp)}</span>
        </div>
        <div className="prose prose-invert max-w-none text-sm leading-7">
          {message.content ? (
            isUser ? (
              <div className="whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                {message.content}
              </div>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            )
          ) : (
            <div style={{ color: "var(--text-secondary)" }}>No visible message content.</div>
          )}
        </div>
        {message.parts.some((part) => part.type !== "text") ? (
          <div className="mt-3 space-y-2">
            {message.parts.filter(isRenderableMessagePart).map((part, index) => (
              <MessagePartRow key={`${message.id}:${part.type}:${index}`} part={part} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessagePartRow({
  part,
}: {
  part: Exclude<ChatMessagePart, { type: "text"; text: string }>;
}) {
  if (part.type === "thinking") {
    return (
      <details className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        <summary className="cursor-pointer font-medium">Internal reasoning</summary>
        <div className="mt-2 whitespace-pre-wrap leading-6">{part.text}</div>
      </details>
    );
  }

  if (part.type === "tool-call") {
    return (
      <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(255, 122, 26, 0.24)", color: "var(--text-secondary)" }}>
        <div className="font-medium" style={{ color: "#fed7aa" }}>Tool call · {part.name}</div>
        {part.args ? <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">{part.args}</pre> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(99, 211, 189, 0.24)", color: "var(--text-secondary)" }}>
      <div className="font-medium" style={{ color: "#8de7d6" }}>Tool result · {part.name}</div>
      {part.text ? <div className="mt-2 whitespace-pre-wrap leading-6">{part.text}</div> : null}
    </div>
  );
}

function isRenderableMessagePart(
  part: ChatMessagePart,
): part is Exclude<ChatMessagePart, { type: "text"; text: string }> {
  return part.type !== "text";
}

function VisibilityCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.03)" }}>
      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </div>
      <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
        {subtitle}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function WorkspaceTaskList({
  tasks,
  emptyDetail,
}: {
  tasks: WorkspaceTaskCard[];
  emptyDetail: string;
}) {
  if (!tasks.length) {
    return <EmptyState title="Nothing mapped" detail={emptyDetail} compact />;
  }

  return (
    <div className="space-y-2">
      {tasks.slice(0, 4).map((task) => (
        <div key={task.id} className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {task.id} · {task.title}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {task.status} · {task.priority} · updated {formatRelativeTime(task.updatedAt)}
              </div>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: toneBorder(task.status), color: toneText(task.status) }}>
              {task.status}
            </span>
          </div>
          {task.nextStep ? (
            <div className="mt-3 rounded-xl border px-3 py-2 text-sm leading-6" style={{ borderColor: "rgba(99,211,189,0.22)", background: "rgba(99,211,189,0.05)", color: "var(--text-primary)" }}>
              <span className="font-semibold" style={{ color: "#8de7d6" }}>Next:</span> {task.nextStep}
            </div>
          ) : null}
          {task.latestActivity ? (
            <div className="mt-3 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              {task.latestActivity}
            </div>
          ) : null}
          {task.blockedBy?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {task.blockedBy.slice(0, 3).map((item) => (
                <span key={item} className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: "rgba(251, 191, 36, 0.28)", color: "#fbbf24" }}>
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CommunicationRow({ communication }: { communication: InterAgentCommunication }) {
  return (
    <div className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {communication.typeLabel}
        </div>
        <span className="text-[11px]" style={{ color: communication.urgency === "needs_now" ? "#fca5a5" : "var(--text-secondary)" }}>
          {communication.urgency}
        </span>
      </div>
      <div className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {communication.summary}
      </div>
      <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {communication.senderDisplayName} → {communication.recipientDisplayNames.join(", ")} · {formatRelativeTime(communication.updatedAt)}
      </div>
    </div>
  );
}

function FeedRow({
  title,
  body,
  meta,
}: {
  title: string;
  body: string;
  meta: string;
}) {
  return (
    <div className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {title}
      </div>
      <div className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {body}
      </div>
      <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {meta}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function MiniPane({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border px-2.5 py-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <span style={{ color: "var(--text-secondary)" }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string | null;
}) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: toneBorder(tone), background: "rgba(255,255,255,0.02)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 text-sm font-medium" style={{ color: toneText(tone) }}>
        {value}
      </div>
    </div>
  );
}

function PathLike({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 break-all" style={{ color: "var(--text-primary)" }}>
        {value || "Not available"}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  detail,
  compact = false,
}: {
  title: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-[var(--radius-card)] border px-4 py-4 ${compact ? "" : "text-center"}`} style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        {title}
      </div>
      <div className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </div>
    </div>
  );
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeStatus(value: string) {
  const normalized = normalizeText(value);
  if (normalized === "in-progress") {
    return "in_progress";
  }
  return normalized;
}

function sortByUpdated(value: string | number | undefined) {
  if (typeof value === "number") return value;
  return new Date(value ?? 0).getTime();
}

function formatRelativeTime(value?: string | number | null) {
  if (!value) return "No recent update";
  const timestamp = typeof value === "number" ? value : new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return String(value);
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function toneBorder(value?: string | null) {
  const tone = normalizeText(value);
  if (tone === "healthy" || tone === "active" || tone === "live") return "rgba(52, 211, 153, 0.24)";
  if (tone === "busy") return "rgba(96, 165, 250, 0.24)";
  if (tone === "blocked" || tone === "missing" || tone === "drifted" || tone === "orphaned") return "rgba(251, 191, 36, 0.24)";
  if (tone === "error" || tone === "failed") return "rgba(248, 113, 113, 0.24)";
  return "var(--border)";
}

function toneText(value?: string | null) {
  const tone = normalizeText(value);
  if (tone === "healthy" || tone === "active" || tone === "live") return "#6ee7b7";
  if (tone === "busy") return "#93c5fd";
  if (tone === "blocked" || tone === "missing" || tone === "drifted" || tone === "orphaned") return "#fbbf24";
  if (tone === "error" || tone === "failed") return "#fca5a5";
  return "var(--text-secondary)";
}
