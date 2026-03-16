import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { CreateOpsTaskInput, OpsAgentSummary, OpsTask, OpsTaskNote, UpdateOpsTaskInput } from "@/lib/ops-types";
import type {
  AgentTaskSummary,
  CommandRollupCard,
  InterAgentCommunication,
  InterAgentCommunicationSummary,
  NeedsChristianItem,
  ReplyRouteTarget,
  SuggestedReplyOption,
  TaskStateBucket,
} from "@/lib/types";
import { buildAgentRosterCards } from "@/lib/command-chat-view";
import { inferAgentOwner, listCanonicalAgents } from "@/lib/antigravity-agents";
import { listDurableSessionSummaries } from "@/lib/durable-sessions";
import { getInterAgentCommunicationRule, listDurableInterAgentCommunications } from "@/lib/inter-agent-communications";

const ROOT_DIR = (process.env.OPENCLAW_DATA_DIR || "/Volumes/Storage/OpenClaw-Data").trim();
const TASKS_DIR = path.join(ROOT_DIR, "tasks");
const ITEMS_DIR = path.join(TASKS_DIR, "items");

function getSyncScriptPath() {
  return path.join(TASKS_DIR, "scripts", ["sync-task-board", "mjs"].join("."));
}

type CanonicalStatus =
  | "queued"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "failed"
  | "cancelled";

type TaskDocument = {
  id: string;
  title: string;
  status: CanonicalStatus;
  priority: "high" | "medium" | "low";
  owner_agent: string;
  agent_type: string;
  created_at: string;
  updated_at: string;
  source: string;
  depends_on: string[];
  blocked_by: string[];
  tags: string[];
  artifacts: string[];
  summary: string;
  currentState: string;
  acceptance: string;
  activityLog: string[];
  notes: string;
  path: string;
};

function parseScalar(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value === "[]" || value === "{}") return [];
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error("Missing frontmatter");
  }

  const data: Record<string, unknown> = {};
  let activeArrayKey: string | null = null;

  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const trimmed = line.trimStart();
    if (trimmed.startsWith("- ") && activeArrayKey) {
      const current = Array.isArray(data[activeArrayKey]) ? data[activeArrayKey] as unknown[] : [];
      current.push(parseScalar(trimmed.slice(2)));
      data[activeArrayKey] = current;
      continue;
    }

    activeArrayKey = null;
    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyMatch) continue;
    const [, key, rawValue] = keyMatch;
    if (!rawValue.trim()) {
      data[key] = [];
      activeArrayKey = key;
      continue;
    }
    data[key] = parseScalar(rawValue);
  }

  return {
    data,
    body: content.slice(match[0].length).trim(),
  };
}

function parseSections(body: string) {
  const sections: Record<string, string> = {};
  const matches = [...body.matchAll(/^##\s+(.+)$/gm)];
  if (matches.length === 0) {
    return sections;
  }

  for (let i = 0; i < matches.length; i += 1) {
    const title = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    sections[title] = body.slice(start, end).trim();
  }

  return sections;
}

function listTaskFiles() {
  return fs
    .readdirSync(ITEMS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(ITEMS_DIR, name))
    .sort();
}

function readTaskDocument(filePath: string): TaskDocument {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, body } = parseFrontmatter(raw);
  const sections = parseSections(body);

  return {
    id: String(data.id || path.basename(filePath, ".md")),
    title: String(data.title || path.basename(filePath, ".md")),
    status: String(data.status || "queued") as CanonicalStatus,
    priority: (String(data.priority || "medium") as "high" | "medium" | "low"),
    owner_agent: String(data.owner_agent || "unassigned"),
    agent_type: String(data.agent_type || "orchestrator"),
    created_at: String(data.created_at || ""),
    updated_at: String(data.updated_at || ""),
    source: String(data.source || "manual"),
    depends_on: Array.isArray(data.depends_on) ? data.depends_on.map(String) : [],
    blocked_by: Array.isArray(data.blocked_by) ? data.blocked_by.map(String) : [],
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    artifacts: Array.isArray(data.artifacts) ? data.artifacts.map(String) : [],
    summary: sections["Summary"] || "",
    currentState: sections["Current State"] || "",
    acceptance: sections["Acceptance"] || "",
    activityLog: (sections["Activity Log"] || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    notes: sections["Notes"] || "",
    path: filePath,
  };
}

function quote(value: string) {
  return JSON.stringify(value);
}

function listBlock(name: string, values: string[]) {
  if (!values.length) return `${name}:\n`;
  return `${name}:\n${values.map((value) => `- ${quote(value)}`).join("\n")}\n`;
}

function renderTaskDocument(task: TaskDocument) {
  return (
    `---\n` +
    `id: ${quote(task.id)}\n` +
    `title: ${quote(task.title)}\n` +
    `status: ${quote(task.status)}\n` +
    `priority: ${quote(task.priority)}\n` +
    `owner_agent: ${quote(task.owner_agent)}\n` +
    `agent_type: ${quote(task.agent_type)}\n` +
    `created_at: ${quote(task.created_at)}\n` +
    `updated_at: ${quote(task.updated_at)}\n` +
    `source: ${quote(task.source)}\n` +
    listBlock("depends_on", task.depends_on) +
    listBlock("blocked_by", task.blocked_by) +
    listBlock("tags", task.tags) +
    listBlock("artifacts", task.artifacts) +
    `---\n\n` +
    `## Summary\n\n${task.summary.trim() || task.title}\n\n` +
    `## Current State\n\n${task.currentState.trim() || "- State: queued\n- Next action: review and refine this task."}\n\n` +
    `## Acceptance\n\n${task.acceptance.trim() || `- [ ] Define acceptance for ${task.id}`}\n\n` +
    `## Activity Log\n\n${task.activityLog.join("\n") || `- ${task.updated_at} ${task.owner_agent}: Task file created.`}\n\n` +
    `## Notes\n\n${task.notes.trim() || "None."}\n`
  );
}

function canonicalToOpsStatus(status: CanonicalStatus): OpsTask["status"] {
  if (status === "done") return "done";
  if (status === "failed" || status === "cancelled") return "failed";
  if (status === "blocked") return "blocked";
  if (status === "review" || status === "in_progress") return "in-progress";
  return "new";
}

function opsToCanonicalStatus(status: string): CanonicalStatus {
  if (status === "done") return "done";
  if (status === "failed") return "failed";
  if (status === "blocked") return "blocked";
  if (status === "in-progress") return "in_progress";
  return "queued";
}

function deriveNextStep(currentState: string) {
  const line = currentState
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => /^-\s*(next action|next step):/i.test(entry));
  return line ? line.replace(/^-\s*(next action|next step):\s*/i, "") : null;
}

function deriveNeedsChristian(task: TaskDocument) {
  const current = `${task.currentState} ${task.notes}`.toLowerCase();
  const staleMs = Date.now() - new Date(task.updated_at).getTime();
  const isTerminal = task.status === "done" || task.status === "failed" || task.status === "cancelled";
  if (isTerminal) {
    return false;
  }

  const explicitChristianNeed = /(needs christian|christian explicitly|waiting on christian|requires christian|approval required|decision required|needs approval|needs decision|waiting on a decision)/.test(current);
  return task.status === "blocked"
    || !task.owner_agent
    || ((task.status === "in_progress" || task.status === "review") && task.priority === "high" && staleMs > 24 * 60 * 60_000)
    || explicitChristianNeed;
}

function buildReplyRoute(task: TaskDocument, kind: ReplyRouteTarget["kind"]): ReplyRouteTarget {
  return {
    kind,
    taskId: task.id,
    agentId: task.owner_agent || null,
    sessionKey: task.owner_agent ? `agent:${task.owner_agent}:main` : null,
  };
}

function buildSuggestedReplies(task: TaskDocument): SuggestedReplyOption[] {
  if (task.status === "blocked") {
    // When blocked_by contains a specific confirmation/decision question from CD,
    // generate task-specific Yes/No buttons instead of generic "Unblock Path".
    const blocker = task.blocked_by?.[0] ?? "";
    const confirmPattern = /(?:confirm|verify|determine|decide)\s+whether\b/i;
    const yesNoPattern = /\b(?:yes|no|expected|approve|accept)\b/i;
    if (blocker && (confirmPattern.test(blocker) || yesNoPattern.test(blocker))) {
      // Extract the core question for natural phrasing
      const core = blocker.replace(/^Christian\s+to\s+(?:confirm|verify|determine|decide)\s+whether\s+/i, "").replace(/\s*$/, "");
      return [
        { label: "Yes", text: `[Decision on ${task.id}] Yes — ${core}. Proceed accordingly and close or advance this task.` },
        { label: "No", text: `[Decision on ${task.id}] No — this was NOT the case (${core}). Investigate and escalate as needed.` },
        { label: "Hold", text: `Keep ${task.id} blocked for now and preserve visibility until the dependency clears.` },
      ];
    }
    return [
      { label: "Unblock Path", text: `Outline the exact unblock path for ${task.id} and tell me the smallest decision or handoff needed.` },
      { label: "Hold", text: `Keep ${task.id} blocked for now and preserve visibility until the dependency clears.` },
    ];
  }

  if (!task.owner_agent || task.owner_agent === "unassigned") {
    return [
      { label: "Suggest Owner", text: `Recommend the correct owner for ${task.id} and why.` },
      { label: "Queue", text: `Leave ${task.id} queued and tell me what would make it actionable.` },
    ];
  }

  if (task.priority === "high") {
    return [
      { label: "Resume", text: `Resume ${task.id} now and summarize the first concrete step.` },
      { label: "Deprioritize", text: `If ${task.id} is no longer current, say what supersedes it and what should replace it.` },
    ];
  }

  return [
    { label: "Clarify", text: `Clarify what you need from Christian on ${task.id} in one sentence.` },
  ];
}

function deriveNeedsChristianUrgency(task: TaskDocument) {
  const staleMs = Date.now() - new Date(task.updated_at).getTime();
  if (task.status === "blocked") {
    return "needs_now" as const;
  }
  if (!task.owner_agent || task.owner_agent === "unassigned" || (task.priority === "high" && staleMs > 24 * 60 * 60_000)) {
    return "attention_soon" as const;
  }
  return "fyi" as const;
}

function buildTaskStateBuckets(taskDocs: TaskDocument[]): TaskStateBucket[] {
  const ordered: Array<{ key: TaskStateBucket["key"]; label: string; description: string; statuses: CanonicalStatus[] }> = [
    {
      key: "current",
      label: "Current",
      description: "Active work already underway.",
      statuses: ["in_progress", "review"],
    },
    {
      key: "pending",
      label: "Pending",
      description: "Queued work ready for the next pickup.",
      statuses: ["queued"],
    },
    {
      key: "blocked",
      label: "Blocked",
      description: "Work waiting on a blocker or decision.",
      statuses: ["blocked"],
    },
    {
      key: "complete",
      label: "Complete",
      description: "Recently finished or terminal work.",
      statuses: ["done", "failed", "cancelled"],
    },
  ];

  return ordered.map((bucket) => {
    const tasks = taskDocs
      .filter((task) => bucket.statuses.includes(task.status))
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
      .map((task) => toAgentTaskSummary(task));

    return {
      key: bucket.key,
      label: bucket.label,
      description: bucket.description,
      tasks,
      total: tasks.length,
    };
  });
}

function mapCommunicationPriority(urgency: InterAgentCommunication["urgency"]) {
  if (urgency === "needs_now" || urgency === "high") {
    return "high";
  }
  if (urgency === "low") {
    return "low";
  }
  return "medium";
}

function buildInterAgentCommunications(taskDocs: TaskDocument[]): {
  communications: InterAgentCommunication[];
  summary: InterAgentCommunicationSummary;
} {
  const agents = listCanonicalAgents();
  const agentMap = new Map(agents.map((agent) => [agent.id, agent]));
  const taskMap = new Map(taskDocs.map((task) => [task.id, task]));
  const communications = listDurableInterAgentCommunications().map<InterAgentCommunication>((entry) => {
    const rule = getInterAgentCommunicationRule(entry.type);
    const sender = agentMap.get(entry.senderAgentId);
    const recipientAgents = entry.recipientAgentIds.map((agentId) => agentMap.get(agentId)).filter(Boolean);
    const taskRefs = entry.taskIds.map((taskId) => ({
      id: taskId,
      title: taskMap.get(taskId)?.title ?? null,
    }));
    const primaryTaskId = taskRefs[0]?.id ?? null;
    const escalated = entry.audience === "needs_christian";

    return {
      id: entry.id,
      type: entry.type,
      typeLabel: rule.label,
      senderAgentId: entry.senderAgentId,
      senderDisplayName: sender?.displayName || sender?.identity?.displayName || entry.senderAgentId,
      recipientAgentIds: entry.recipientAgentIds,
      recipientDisplayNames: recipientAgents.length
        ? recipientAgents.map((agent) => agent?.displayName || agent?.identity?.displayName || agent?.id || "unknown")
        : entry.recipientAgentIds,
      primaryTaskId,
      taskRefs,
      summary: entry.summary,
      actionRequested: entry.actionRequested ?? null,
      contextNote: entry.contextNote ?? null,
      urgency: entry.urgency,
      status: entry.status,
      audience: entry.audience,
      defaultAudience: rule.defaultAudience,
      audienceLabel: escalated ? "Needs Christian" : "Internal only",
      policyNote: rule.policyNote,
      escalationReason: entry.escalationReason ?? null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      routeBackTo: primaryTaskId
        ? {
            kind: escalated ? "needs_christian" : "task",
            taskId: primaryTaskId,
            agentId: entry.senderAgentId || null,
            sessionKey: entry.senderAgentId ? `agent:${entry.senderAgentId}:main` : null,
          }
        : null,
    };
  });

  const summary: InterAgentCommunicationSummary = {
    total: communications.length,
    internalOnly: communications.filter((entry) => entry.audience === "internal_only").length,
    needsChristian: communications.filter((entry) => entry.audience === "needs_christian").length,
    open: communications.filter((entry) => entry.status !== "resolved").length,
    byType: Object.entries(
      communications.reduce<Record<string, { label: string; total: number; internalOnly: number; needsChristian: number }>>(
        (acc, entry) => {
          const current = acc[entry.type] ?? {
            label: entry.typeLabel,
            total: 0,
            internalOnly: 0,
            needsChristian: 0,
          };
          current.total += 1;
          if (entry.audience === "needs_christian") {
            current.needsChristian += 1;
          } else {
            current.internalOnly += 1;
          }
          acc[entry.type] = current;
          return acc;
        },
        {},
      ),
    )
      .map(([type, value]) => ({
        type: type as InterAgentCommunication["type"],
        label: value.label,
        total: value.total,
        internalOnly: value.internalOnly,
        needsChristian: value.needsChristian,
      }))
      .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label)),
  };

  return { communications, summary };
}

function buildCommandRollups(
  taskDocs: TaskDocument[],
  needsChristianItems: NeedsChristianItem[],
  communications: InterAgentCommunication[],
): CommandRollupCard[] {
  const now = Date.now();
  const current = taskDocs
    .filter((task) => task.status === "in_progress" || task.status === "review")
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null;
  const recentComplete = taskDocs
    .filter((task) => task.status === "done" && now - Date.parse(task.updated_at) < 30 * 60 * 1000)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0] ?? null;

  const rollups = communications
    .filter((item) => item.audience === "needs_christian" && item.status !== "resolved")
    .slice(0, 2)
    .map<CommandRollupCard>((item) => ({
      id: `${item.id}:coordination`,
      kind: item.type === "dependency_ping" || item.type === "friction_note" ? "risk_flag" : "needs_decision",
      title: `${item.typeLabel} · ${item.primaryTaskId ?? item.senderDisplayName}`,
      summary: item.summary,
      taskId: item.primaryTaskId ?? null,
      agentId: item.senderAgentId,
      priority: mapCommunicationPriority(item.urgency),
      updatedAt: item.updatedAt,
      routeBackTo: item.routeBackTo ?? null,
      suggestedReplies: item.actionRequested
        ? [
            {
              label: "Reply in Command",
              text: item.actionRequested,
            },
          ]
        : undefined,
    }))
    .concat(needsChristianItems.slice(0, 3).map<CommandRollupCard>((item) => ({
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
  })));

  if (current) {
    rollups.push({
      id: `${current.id}:current`,
      kind: "fyi",
      title: `${current.id} moved`,
      summary: deriveNextStep(current.currentState) ?? "Active work is underway and ready for the next visible step.",
      taskId: current.id,
      agentId: current.owner_agent || null,
      priority: current.priority,
      updatedAt: current.updated_at,
      routeBackTo: buildReplyRoute(current, "rollup"),
      suggestedReplies: [
        { label: "Next Step", text: `Summarize the next concrete step on ${current.id} and whether you need anything from Christian.` },
      ],
    });
  }

  if (recentComplete) {
    rollups.push({
      id: `${recentComplete.id}:complete`,
      kind: "completed",
      title: `${recentComplete.id} completed`,
      summary: recentComplete.activityLog[recentComplete.activityLog.length - 1] ?? "Work reached a terminal state.",
      taskId: recentComplete.id,
      agentId: recentComplete.owner_agent || null,
      priority: recentComplete.priority,
      updatedAt: recentComplete.updated_at,
      routeBackTo: buildReplyRoute(recentComplete, "rollup"),
      suggestedReplies: [
        { label: "Follow-on", text: `What is the next follow-on after ${recentComplete.id}, if any?` },
      ],
    });
  }

  return rollups
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 4);
}

function toAgentTaskSummary(task: TaskDocument): AgentTaskSummary {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    ownerAgent: task.owner_agent || null,
    updatedAt: task.updated_at,
    latestActivity: task.activityLog[task.activityLog.length - 1] ?? null,
    nextStep: deriveNextStep(task.currentState),
    blockedBy: task.blocked_by,
    artifacts: task.artifacts,
    needsChristian: deriveNeedsChristian(task),
  };
}

function toOpsTask(task: TaskDocument): OpsTask {
  const notes: OpsTaskNote[] = task.activityLog.map((entry) => {
    const match = entry.match(/^-\s+(\S+)\s+([^:]+):\s+(.*)$/);
    if (!match) {
      return {
        timestamp: task.updated_at,
        text: entry.replace(/^- /, ""),
      };
    }
    return {
      timestamp: match[1],
      text: `${match[2]}: ${match[3]}`,
    };
  });

  return {
    id: task.id,
    title: task.title,
    description: task.summary || task.title,
    content: task.notes,
    status: canonicalToOpsStatus(task.status),
    priority: task.priority,
    assignee: task.owner_agent,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    dueDate: null,
    notes,
    source: task.source,
  };
}

function syncViews() {
  const result = spawnSync(process.execPath, [getSyncScriptPath()], {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Task board sync failed with status ${result.status ?? "unknown"}`);
  }
}

function nextTaskId() {
  const ids = listTaskFiles()
    .map((filePath) => path.basename(filePath, ".md"))
    .filter((id) => /^OPS-\d+$/.test(id))
    .map((id) => Number.parseInt(id.replace("OPS-", ""), 10));
  const next = ids.length ? Math.max(...ids) + 1 : 1;
  return `OPS-${String(next).padStart(3, "0")}`;
}

export function listOpsTasks() {
  return listTaskFiles().map((filePath) => toOpsTask(readTaskDocument(filePath)));
}

export function listCommandTaskSummaries() {
  return listTaskFiles().map((filePath) => toAgentTaskSummary(readTaskDocument(filePath)));
}

function buildNeedsChristianItems(taskDocs: TaskDocument[]): NeedsChristianItem[] {
  return taskDocs
    .filter((task) => deriveNeedsChristian(task))
    .sort((a, b) => {
      const urgencyRank = (task: TaskDocument) => {
        if (task.status === "blocked") return 3;
        if (!task.owner_agent || task.owner_agent === "unassigned") return 2;
        return 1;
      };

      const priorityRank = (task: TaskDocument) =>
        task.priority === "high" ? 3 : task.priority === "medium" ? 2 : 1;

      return (
        urgencyRank(b) - urgencyRank(a) ||
        priorityRank(b) - priorityRank(a) ||
        Date.parse(b.updated_at) - Date.parse(a.updated_at)
      );
    })
    .slice(0, 6)
    .map((task) => {
      const staleMs = Date.now() - new Date(task.updated_at).getTime();
      return {
        id: task.id,
        title: task.title,
        reason: task.status === "blocked"
          ? (task.blocked_by?.[0] || "Blocked and likely waiting on a decision or unblock.")
          : !task.owner_agent || task.owner_agent === "unassigned"
            ? "No clear owner yet."
            : task.priority === "high" && staleMs > 24 * 60 * 60_000
              ? "High-priority work has gone stale."
              : "Current notes imply approval or prioritization is needed.",
        urgency: deriveNeedsChristianUrgency(task),
        nextStep: deriveNextStep(task.currentState),
        blockedBy: task.blocked_by,
        artifacts: task.artifacts,
        ownerAgentId: task.owner_agent || null,
        status: canonicalToOpsStatus(task.status),
        priority: task.priority,
        updatedAt: task.updated_at,
        routeBackTo: buildReplyRoute(task, "needs_christian"),
        suggestedReplies: buildSuggestedReplies(task),
      };
    });
}

export function createOpsTask(input: CreateOpsTaskInput) {
  const now = new Date().toISOString();
  const taskId = nextTaskId();
  const suggestedOwner = inferAgentOwner({
    title: input.title.trim(),
    tags: ["ops-ui"],
    source: "ops-ui",
  });
  const task: TaskDocument = {
    id: taskId,
    title: input.title.trim(),
    status: "queued",
    priority: input.priority ?? "medium",
    owner_agent: input.assignee?.trim() || suggestedOwner,
    agent_type: suggestedOwner === "cd" ? "orchestrator" : suggestedOwner,
    created_at: now,
    updated_at: now,
    source: "ops-ui",
    depends_on: [],
    blocked_by: [],
    tags: ["ops-ui", "multi-agent"],
    artifacts: [],
    summary: input.description?.trim() || input.title.trim(),
    currentState: "- State: queued\n- Next action: claim and start execution.",
    acceptance: `- [ ] Complete ${input.title.trim()}`,
    activityLog: [`- ${now} cd: Task created from Ops UI.`],
    notes: "Created from the dashboard Ops UI.",
    path: path.join(ITEMS_DIR, `${taskId}.md`),
  };
  task.path = path.join(ITEMS_DIR, `${task.id}.md`);
  fs.writeFileSync(task.path, renderTaskDocument(task));
  syncViews();
  return toOpsTask(task);
}

function updateSection(current: string, nextDescription?: string) {
  if (!nextDescription?.trim()) return current;
  return nextDescription.trim();
}

export function updateOpsTask(taskId: string, patch: UpdateOpsTaskInput) {
  const filePath = path.join(ITEMS_DIR, `${taskId}.md`);
  const task = readTaskDocument(filePath);
  const now = new Date().toISOString();

  task.title = patch.title?.trim() || task.title;
  task.summary = updateSection(task.summary, patch.description);
  task.notes = patch.content?.trim() || task.notes;
  task.priority = patch.priority || task.priority;
  task.owner_agent = patch.assignee?.trim() || task.owner_agent;
  task.source = patch.source?.trim() || task.source;
  task.status = patch.status ? opsToCanonicalStatus(patch.status) : task.status;
  task.updated_at = now;
  task.activityLog.push(`- ${now} cd: Task updated from Ops UI.`);

  fs.writeFileSync(filePath, renderTaskDocument(task));
  syncViews();
  return toOpsTask(task);
}

export function addOpsTaskNote(taskId: string, text: string) {
  const filePath = path.join(ITEMS_DIR, `${taskId}.md`);
  const task = readTaskDocument(filePath);
  const now = new Date().toISOString();
  task.updated_at = now;
  task.activityLog.push(`- ${now} cd: ${text.trim()}`);
  fs.writeFileSync(filePath, renderTaskDocument(task));
  syncViews();
  return {
    text: text.trim(),
    timestamp: now,
  };
}

export function spawnOpsTask(taskId: string) {
  return updateOpsTask(taskId, {
    status: "in-progress",
    source: "ops-ui:spawn",
  });
}

export function spawnOpsTaskBatch(taskIds: string[]) {
  let spawned = 0;
  for (const taskId of taskIds) {
    spawnOpsTask(taskId);
    spawned += 1;
  }
  return { spawned };
}

export function getOpsSummary(): OpsAgentSummary {
  const taskDocs = listTaskFiles().map((filePath) => readTaskDocument(filePath));
  const tasks = taskDocs.map((task) => toOpsTask(task));
  const agents = listCanonicalAgents();
  const sessions = listDurableSessionSummaries();
  const latestTask = tasks
    .map((task) => Date.parse(task.updatedAt))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  const latestSession = sessions
    .map((session) => (typeof session.updatedAt === "number" ? session.updatedAt : 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a)[0];
  const latest = Math.max(latestTask ?? 0, latestSession ?? 0);
  const rosterCards = buildAgentRosterCards({ agents, tasks, sessions });
  const needsChristianItems = buildNeedsChristianItems(taskDocs);
  const taskState = buildTaskStateBuckets(taskDocs);
  const { communications } = buildInterAgentCommunications(taskDocs);
  const rollups = buildCommandRollups(taskDocs, needsChristianItems, communications);
  const blockedCount = taskDocs.filter((task) => task.status === "blocked").length;
  const unassignedCount = taskDocs.filter((task) => !task.owner_agent || task.owner_agent === "unassigned").length;
  const highPriorityStaleCount = taskDocs.filter((task) => task.priority === "high" && Date.now() - new Date(task.updated_at).getTime() > 24 * 60 * 60_000).length;
  const subagentSessions = sessions.filter((session) => session.kind === "subagent");
  const cronSessions = sessions.filter((session) => session.kind === "cron");
  const hookSessions = sessions.filter((session) => session.kind === "hook");
  const activeSessionCutoff = Date.now() - 15 * 60_000;
  const isActiveSession = (updatedAt?: number) => typeof updatedAt === "number" && updatedAt >= activeSessionCutoff;
  const groupedSessionCount = subagentSessions.length + cronSessions.length + hookSessions.length;
  const activeGroupedSessionCount = [...subagentSessions, ...cronSessions, ...hookSessions].filter((session) => isActiveSession(session.updatedAt)).length;

  return {
    totalSessions: sessions.length,
    activeSessions: sessions.filter((session) => isActiveSession(session.updatedAt)).length,
    mainAgent: {
      status: sessions.some((session) => session.key.endsWith(":main") && isActiveSession(session.updatedAt)) ? "active" : "idle",
      ageMinutes: latest ? Math.max(0, Math.floor((Date.now() - latest) / 60000)) : 0,
      model: "server-visibility",
      totalTokens: sessions.reduce((sum, session) => sum + (session.totalTokens ?? 0), 0),
      channel: "ops",
    },
    subagents: {
      total: subagentSessions.length,
      active: subagentSessions.filter((session) => isActiveSession(session.updatedAt)).length,
      sessions: subagentSessions.map((session) => ({
        key: session.key,
        category: "subagent",
        updatedAt: session.updatedAt ?? 0,
        ageMs: session.updatedAt ? Math.max(0, Date.now() - session.updatedAt) : 0,
        ageMinutes: session.updatedAt ? Math.max(0, Math.floor((Date.now() - session.updatedAt) / 60000)) : 0,
        isActive: isActiveSession(session.updatedAt),
        model: session.model,
        totalTokens: session.totalTokens,
        contextTokens: session.inputTokens,
        channel: session.channel,
        displayName: session.displayName,
        label: session.label,
        sessionId: session.key,
      })),
    },
    hooks: {
      total: hookSessions.length,
      active: hookSessions.filter((session) => isActiveSession(session.updatedAt)).length,
      sessions: hookSessions.map((session) => ({
        key: session.key,
        category: "hook",
        updatedAt: session.updatedAt ?? 0,
        ageMs: session.updatedAt ? Math.max(0, Date.now() - session.updatedAt) : 0,
        ageMinutes: session.updatedAt ? Math.max(0, Math.floor((Date.now() - session.updatedAt) / 60000)) : 0,
        isActive: isActiveSession(session.updatedAt),
        model: session.model,
        totalTokens: session.totalTokens,
        contextTokens: session.inputTokens,
        channel: session.channel,
        displayName: session.displayName,
        label: session.label,
        sessionId: session.key,
      })),
    },
    crons: {
      total: cronSessions.length,
      active: cronSessions.filter((session) => isActiveSession(session.updatedAt)).length,
      sessions: cronSessions.map((session) => ({
        key: session.key,
        category: "cron",
        updatedAt: session.updatedAt ?? 0,
        ageMs: session.updatedAt ? Math.max(0, Date.now() - session.updatedAt) : 0,
        ageMinutes: session.updatedAt ? Math.max(0, Math.floor((Date.now() - session.updatedAt) / 60000)) : 0,
        isActive: isActiveSession(session.updatedAt),
        model: session.model,
        totalTokens: session.totalTokens,
        contextTokens: session.inputTokens,
        channel: session.channel,
        displayName: session.displayName,
        label: session.label,
        sessionId: session.key,
      })),
    },
    groups: { total: groupedSessionCount, active: activeGroupedSessionCount },
    rosterCards,
    taskState,
    rollups,
    needsChristian: {
      total: needsChristianItems.length,
      blocked: blockedCount,
      unassigned: unassignedCount,
      highPriorityStale: highPriorityStaleCount,
      items: needsChristianItems,
    },
    timestamp: Date.now(),
  };
}

export function getServerVisibilitySummary() {
  const taskDocs = listTaskFiles().map((filePath) => readTaskDocument(filePath));
  const opsTasks = taskDocs.map((task) => toOpsTask(task));
  const commandTasks = taskDocs.map((task) => toAgentTaskSummary(task));
  const agents = listCanonicalAgents();
  const sessions = listDurableSessionSummaries();
  const rosterCards = buildAgentRosterCards({ agents, tasks: opsTasks, sessions });
  const needsChristian = buildNeedsChristianItems(taskDocs);
  const taskState = buildTaskStateBuckets(taskDocs);
  const { communications, summary: communicationSummary } = buildInterAgentCommunications(taskDocs);
  const rollups = buildCommandRollups(taskDocs, needsChristian, communications);

  return {
    generatedAt: new Date().toISOString(),
    agents,
    sessions,
    rosterCards,
    tasks: commandTasks,
    needsChristian,
    rollups,
    taskState,
    communications,
    communicationSummary,
    summary: {
      agentCount: agents.length,
      sessionCount: sessions.length,
      proactiveCount: needsChristian.length + communicationSummary.needsChristian,
    },
  };
}
