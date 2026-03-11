import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { CreateOpsTaskInput, OpsAgentSummary, OpsTask, OpsTaskNote, UpdateOpsTaskInput } from "@/lib/ops-types";
import { inferAgentOwner } from "@/lib/antigravity-agents";

const DEFAULT_ROOT_DIR = path.join(
  path.sep,
  "Volumes",
  "Storage",
  "OpenClaw",
  ".antigravity",
);
const ROOT_DIR = process.env.OPENCLAW_ANTIGRAVITY_ROOT?.trim() || DEFAULT_ROOT_DIR;
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
    if (line.startsWith("- ") && activeArrayKey) {
      const current = Array.isArray(data[activeArrayKey]) ? data[activeArrayKey] as unknown[] : [];
      current.push(parseScalar(line.slice(2)));
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
  const tasks = listOpsTasks();
  const activeSessions = tasks.filter((task) => ["in-progress", "blocked"].includes(task.status)).length;
  const latest = tasks
    .map((task) => Date.parse(task.updatedAt))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  return {
    totalSessions: tasks.length,
    activeSessions,
    mainAgent: {
      status: activeSessions > 0 ? "active" : "idle",
      ageMinutes: latest ? Math.max(0, Math.floor((Date.now() - latest) / 60000)) : 0,
      model: "task-file-ledger",
      totalTokens: tasks.length,
      channel: "ops",
    },
    subagents: { total: 0, active: 0, sessions: [] },
    hooks: { total: 0, active: 0, sessions: [] },
    crons: { total: 0, active: 0, sessions: [] },
    groups: { total: 0, active: 0 },
    timestamp: Date.now(),
  };
}
