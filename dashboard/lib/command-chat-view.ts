import type {
  AgentRosterCard,
  AgentSummary,
  CommandChatViewModel,
  CommandRollupCard,
  NeedsChristianItem,
  OpsTaskLike,
  SessionSummary,
  TaskStateBucket,
  WorkerSessionGroup,
} from "@/lib/types";

const COMMAND_LABEL = "Command";

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isSubagentSession(session: SessionSummary) {
  return normalizeText(session.key).includes(":subagent:");
}

function extractTaskIds(text: string) {
  const matches = text.match(/\b[A-Z]{2,5}-\d{3}\b/g);
  return matches ?? [];
}

function inferTaskId(session: SessionSummary, taskIds: Set<string>) {
  const haystack = [session.key, session.displayName, session.label, session.origin?.label]
    .filter(Boolean)
    .join(" ");
  return extractTaskIds(haystack).find((id) => taskIds.has(id)) ?? null;
}

function inferAgentId(session: SessionSummary, agents: AgentSummary[]) {
  const direct = normalizeText(session.agentId);
  if (direct && agents.some((agent) => agent.id === direct || normalizeText(agent.runtimeAgentId) === direct)) {
    return agents.find((agent) => agent.id === direct || normalizeText(agent.runtimeAgentId) === direct)?.id ?? null;
  }

  const key = normalizeText(session.key);
  const label = normalizeText(`${session.displayName ?? ""} ${session.label ?? ""} ${session.origin?.label ?? ""}`);
  return agents.find((agent) => {
    const agentKey = normalizeText(agent.id);
    const runtimeKey = normalizeText(agent.runtime?.sessionKey);
    return (runtimeKey && runtimeKey === key) || key.includes(`:${agentKey}`) || label.includes(agentKey);
  })?.id ?? null;
}

function summarizeGroupStatus(sessions: SessionSummary[]) {
  const latest = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
  if (!latest) return "idle";
  if (sessions.some((session) => isSubagentSession(session))) return "busy";
  return latest.updatedAt && Date.now() - latest.updatedAt < 15 * 60_000 ? "active" : "idle";
}

function normalizeTaskStatus(status: string) {
  const value = normalizeText(status);
  if (value === "in-progress") return "in_progress";
  return value;
}

function sessionSortValue(session: SessionSummary) {
  return typeof session.updatedAt === "number" ? session.updatedAt : new Date(session.updatedAt ?? 0).getTime();
}

function taskSortValue(task: OpsTaskLike) {
  return new Date(task.updatedAt ?? 0).getTime();
}

export function buildAgentRosterCards(params: {
  agents: AgentSummary[];
  tasks: OpsTaskLike[];
  sessions: SessionSummary[];
  search?: string;
}): AgentRosterCard[] {
  const needle = normalizeText(params.search);

  return params.agents
    .map((agent) => {
      const agentTasks = params.tasks.filter((task) => normalizeText(task.assignee) === normalizeText(agent.id));
      const currentTasks = agentTasks
        .filter((task) => ["in_progress", "review", "blocked", "new", "queued"].includes(normalizeTaskStatus(task.status)))
        .sort((a, b) => taskSortValue(b) - taskSortValue(a));
      const recentCompleted = agentTasks
        .filter((task) => ["done", "failed", "cancelled"].includes(normalizeTaskStatus(task.status)))
        .sort((a, b) => taskSortValue(b) - taskSortValue(a))
        .slice(0, 3);
      const linkedSessions = params.sessions
        .filter((session) => normalizeText(session.agentId) === normalizeText(agent.id) || normalizeText(session.key) === normalizeText(agent.runtime?.sessionKey))
        .sort((a, b) => sessionSortValue(b) - sessionSortValue(a));

      const card: AgentRosterCard = {
        id: agent.id,
        displayName: agent.displayName || agent.identity?.displayName || agent.identity?.name || agent.name || agent.id,
        emoji: agent.identity?.emoji,
        lane: agent.lane,
        persona: agent.persona || agent.identity?.persona,
        operatingStyle: agent.operatingStyle || agent.identity?.operatingStyle,
        strengths: agent.strengths || agent.identity?.strengths,
        escalationStyle: agent.escalationStyle || agent.identity?.escalationStyle,
        signatureTone: agent.signatureTone || agent.identity?.signatureTone,
        supervisor: agent.supervisor || agent.identity?.supervisor || null,
        status: agent.status,
        runtimeState: agent.runtime?.observedState,
        currentTasks: currentTasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          ownerAgent: agent.id,
          updatedAt: task.updatedAt,
        })),
        pendingCount: agentTasks.filter((task) => ["new", "queued", "review"].includes(normalizeTaskStatus(task.status))).length,
        blockedCount: agentTasks.filter((task) => normalizeTaskStatus(task.status) === "blocked").length,
        recentCompleted: recentCompleted.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          ownerAgent: agent.id,
          updatedAt: task.updatedAt,
        })),
        lastMeaningfulUpdate: currentTasks[0]?.updatedAt || recentCompleted[0]?.updatedAt || agent.runtime?.lastSeenAt || null,
        linkedSessions,
      };

      return card;
    })
    .filter((card) => {
      if (!needle) return true;
      return [card.displayName, card.id, card.lane, card.persona, ...(card.currentTasks.map((task) => task.title))]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(needle));
    })
    .sort((a, b) => {
      const aBusy = (a.currentTasks.length ? 1 : 0) + a.blockedCount;
      const bBusy = (b.currentTasks.length ? 1 : 0) + b.blockedCount;
      return bBusy - aBusy || a.displayName.localeCompare(b.displayName);
    });
}

export function buildCommandChatView(params: {
  sessions: SessionSummary[];
  agents: AgentSummary[];
  tasks: OpsTaskLike[];
  activeSessionKey: string;
  commandSession: SessionSummary;
  needsChristianItems?: NeedsChristianItem[];
  rollups?: CommandRollupCard[];
  taskState?: TaskStateBucket[];
}): CommandChatViewModel {
  const { sessions, agents, tasks, activeSessionKey, commandSession } = params;
  const visibleSessions = sessions.filter((session) => normalizeText(session.agentId) !== "heartbeat");
  const taskIds = new Set(tasks.map((task) => task.id));
  const commandSessionKey = commandSession.key;
  const commandSessionPresent = visibleSessions.some((session) => session.key === commandSessionKey);
  const commandSessionSummary = commandSessionPresent
    ? visibleSessions.find((session) => session.key === commandSessionKey) ?? commandSession
    : commandSession;

  const backgroundGroups = new Map<string, WorkerSessionGroup>();
  const ungroupedSessions: SessionSummary[] = [];

  for (const session of visibleSessions) {
    if (session.key === commandSessionKey) continue;

    const owningAgentId = inferAgentId(session, agents);
    const taskId = inferTaskId(session, taskIds);
    const isPrimaryAgentSession = agents.some((agent) => normalizeText(agent.runtime?.sessionKey) === normalizeText(session.key));
    if (isPrimaryAgentSession) {
      continue;
    }

    let groupKey: string | null = null;
    let parentType: WorkerSessionGroup["parentType"] = "system";
    let label = session.displayName || session.label || session.key;

    if (taskId) {
      groupKey = `task:${taskId}`;
      parentType = "task";
      label = `${taskId} work`;
    } else if (owningAgentId && isSubagentSession(session)) {
      groupKey = `agent:${owningAgentId}`;
      parentType = "agent";
      label = `${agents.find((agent) => agent.id === owningAgentId)?.identity?.displayName || owningAgentId} workers`;
    }

    if (!groupKey) {
      ungroupedSessions.push(session);
      continue;
    }

    const existing = backgroundGroups.get(groupKey);
    const nextSessions = [...(existing?.sessions ?? []), session];
    backgroundGroups.set(groupKey, {
      groupId: groupKey,
      label,
      parentType,
      parentAgentId: owningAgentId ?? existing?.parentAgentId ?? null,
      parentTaskId: taskId ?? existing?.parentTaskId ?? null,
      sessionKeys: nextSessions.map((item) => item.key),
      latestSessionAt: nextSessions.map((item) => sessionSortValue(item)).sort((a, b) => b - a)[0] ?? null,
      status: summarizeGroupStatus(nextSessions),
      latestSummary: nextSessions
        .map((item) => item.displayName || item.label || item.origin?.label || item.key)
        .filter(Boolean)[0] ?? label,
      sessions: nextSessions,
    });
  }

  const needsChristianSeed = params.needsChristianItems?.filter(
    (item) => !["done", "failed", "cancelled"].includes(normalizeTaskStatus(item.status)),
  );

  const needsChristian: NeedsChristianItem[] = needsChristianSeed ?? tasks
    .filter((task) => {
      const staleMs = Date.now() - new Date(task.updatedAt).getTime();
      const description = `${task.description ?? ""} ${task.content ?? ""}`.toLowerCase();
      return task.status === "blocked"
        || !task.assignee
        || (task.priority === "high" && staleMs > 24 * 60 * 60_000)
        || /(approval|decide|decision|prioritiz|cutover|input needed)/.test(description);
    })
    .slice(0, 6)
    .map((task) => ({
      id: task.id,
      title: task.title,
      reason: task.status === "blocked"
        ? "Blocked and likely waiting on a decision or unblock."
        : !task.assignee
          ? "No clear owner yet."
          : task.priority === "high"
            ? "High-priority work has gone stale."
            : "Current notes imply approval or prioritization is needed.",
      ownerAgentId: task.assignee || null,
      status: task.status,
      priority: task.priority,
      updatedAt: task.updatedAt,
    }));

  const taskState: TaskStateBucket[] = params.taskState ?? [
    {
      key: "current",
      label: "Current",
      description: "Active work in progress.",
      tasks: tasks
        .filter((task) => ["in_progress", "review"].includes(normalizeTaskStatus(task.status)))
        .sort((a, b) => taskSortValue(b) - taskSortValue(a))
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          ownerAgent: task.assignee || null,
          updatedAt: task.updatedAt,
        })),
      total: tasks.filter((task) => ["in_progress", "review"].includes(normalizeTaskStatus(task.status))).length,
    },
    {
      key: "pending",
      label: "Pending",
      description: "Queued work ready for pickup.",
      tasks: tasks
        .filter((task) => ["queued", "new"].includes(normalizeTaskStatus(task.status)))
        .sort((a, b) => taskSortValue(b) - taskSortValue(a))
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          ownerAgent: task.assignee || null,
          updatedAt: task.updatedAt,
        })),
      total: tasks.filter((task) => ["queued", "new"].includes(normalizeTaskStatus(task.status))).length,
    },
    {
      key: "blocked",
      label: "Blocked",
      description: "Work waiting on an unblock.",
      tasks: tasks
        .filter((task) => normalizeTaskStatus(task.status) === "blocked")
        .sort((a, b) => taskSortValue(b) - taskSortValue(a))
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          ownerAgent: task.assignee || null,
          updatedAt: task.updatedAt,
        })),
      total: tasks.filter((task) => normalizeTaskStatus(task.status) === "blocked").length,
    },
    {
      key: "complete",
      label: "Complete",
      description: "Recently finished work.",
      tasks: tasks
        .filter((task) => ["done", "failed", "cancelled"].includes(normalizeTaskStatus(task.status)))
        .sort((a, b) => taskSortValue(b) - taskSortValue(a))
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          ownerAgent: task.assignee || null,
          updatedAt: task.updatedAt,
        })),
      total: tasks.filter((task) => ["done", "failed", "cancelled"].includes(normalizeTaskStatus(task.status))).length,
    },
  ];

  const rollupsSeed = params.rollups?.filter((item) => {
    if (item.kind !== "completed") {
      return true;
    }
    const updatedAt = Date.parse(item.updatedAt);
    return Number.isFinite(updatedAt) && Date.now() - updatedAt < 30 * 60 * 1000;
  });

  const rollups: CommandRollupCard[] = rollupsSeed ?? needsChristian.slice(0, 3).map((item) => ({
    id: `${item.id}:rollup`,
    kind: item.status === "blocked" ? "blocked" : "needs_decision",
    title: `${item.id} · ${item.title}`,
    summary: item.reason,
    taskId: item.id,
    agentId: item.ownerAgentId ?? null,
    priority: item.priority,
    updatedAt: item.updatedAt,
    routeBackTo: item.routeBackTo ?? null,
    suggestedReplies: item.suggestedReplies,
  }));

  return {
    commandSession: commandSessionSummary,
    commandSectionLabel: COMMAND_LABEL,
    activeSessionKey,
    backgroundGroups: [...backgroundGroups.values()].sort((a, b) => (b.latestSessionAt ?? 0) - (a.latestSessionAt ?? 0)),
    ungroupedSessions: ungroupedSessions.sort((a, b) => sessionSortValue(b) - sessionSortValue(a)),
    needsChristian,
    rollups,
    taskState,
  };
}
