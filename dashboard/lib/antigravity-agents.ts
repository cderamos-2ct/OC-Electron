import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { AgentDetail, AgentFeedItem, AgentHireDraft, AgentManagerAudit, AgentManagerDelegationTrace, AgentManagerRecommendation, AgentOwnedTask, AgentRuntimeTriageItem, AgentSummary } from "@/lib/types";

const ROOT_DIR = "/Volumes/Storage/OpenClaw/.antigravity";
const AGENTS_DIR = path.join(ROOT_DIR, "agents");
const AGENT_PROFILES_DIR = path.join(AGENTS_DIR, "profiles");
const TASK_INDEX_PATH = path.join(ROOT_DIR, "tasks", "index.json");
const TASK_ITEMS_DIR = path.join(ROOT_DIR, "tasks", "items");
const DATA_DIR = "/Volumes/Storage/OpenClaw/data";
const JOURNAL_DB_PATH = path.join(DATA_DIR, "journal.db");
const RUNTIME_DB_PATH = path.join(DATA_DIR, "antigravity.db");
const AGENT_RUNTIME_DIR = path.join(ROOT_DIR, "runtime");
const AGENT_ROSTER_PATH = path.join(AGENT_RUNTIME_DIR, "roster.json");

type JoinedRosterPayload = {
  summary?: {
    totalAgents?: number;
    healthy?: number;
    busy?: number;
    idle?: number;
    missing?: number;
    unknown?: number;
    orphanedSessions?: number;
  };
  agents?: Array<Record<string, unknown>>;
};

type AgentRecord = {
  id: string;
  name: string;
  emoji?: string;
  lane?: string;
  status?: "active" | "planned" | "paused";
  runtimeAgentId?: string | null;
  default?: boolean;
  description?: string;
  responsibilities?: string[];
  monitorSurfaces?: string[];
  communicationChannels?: string[];
  tools?: string[];
  memoryPaths?: string[];
  modelProvider?: string | null;
  defaultModel?: string | null;
  fallbackModel?: string | null;
  reasoningLevel?: string | null;
  authProfile?: string | null;
  canSpawnSubagents?: boolean;
  subagentModel?: string | null;
  subagentMaxDepth?: number | null;
  subagentUseCases?: string[];
  taskTags?: string[];
  escalatesTo?: string | null;
};

type AgentSignalConfig = {
  messageSources: string[];
  notificationTitles: string[];
  conversationSources: string[];
  activitySources: string[];
  activityKeywords: string[];
};

type TaskIndexEntry = {
  id: string;
  title: string;
  status: string;
  priority: string;
  owner_agent: string;
  updated_at: string;
  source: string;
  tags?: string[];
  path?: string;
};

export function inferAgentOwner(params: { title: string; tags?: string[]; source?: string }) {
  const title = params.title.toLowerCase();
  const tags = (params.tags ?? []).map((tag) => tag.toLowerCase());
  const source = (params.source ?? "").toLowerCase();
  const haystack = `${title} ${tags.join(" ")} ${source}`;

  if (/(fireflies|meeting-note|meeting notes|notes workflow|memo|notebook)/.test(haystack)) {
    return "notes";
  }
  if (/(email|gmail|teams|imessage|message|telegram|reply|contact|communication)/.test(haystack)) {
    return "comms";
  }
  if (/(calendar|meeting|schedule|reminder|brief)/.test(haystack)) {
    return "calendar";
  }
  if (/(notes|memo|document|docs|meeting-note|fireflies|digest)/.test(haystack)) {
    return "notes";
  }
  if (/(research|learning|notebooklm|cto|source|pomodoro)/.test(haystack)) {
    return "research";
  }
  if (/(dashboard|runtime|gateway|cloudflare|tunnel|device auth|service|launchctl|ops)/.test(haystack)) {
    return "ops";
  }
  if (/(build|typescript|ui|api|implementation|code|fix)/.test(haystack)) {
    return "build";
  }
  if (/(verify|verification|review|quality|regression|test)/.test(haystack)) {
    return "verifier";
  }
  return "cd";
}

function readJoinedRoster(): JoinedRosterPayload | null {
  if (!fs.existsSync(AGENT_ROSTER_PATH)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(AGENT_ROSTER_PATH, "utf8")) as JoinedRosterPayload;
}

function readRosterAgent(agentId: string) {
  const roster = readJoinedRoster();
  return Array.isArray(roster?.agents)
    ? roster!.agents.find((agent) => String((agent as Record<string, unknown>).id || "") === agentId) ?? null
    : null;
}

function summarizeJoinedRosterAgent(agent: Record<string, any>): AgentSummary {
  const runtime = (agent.runtime ?? {}) as AgentSummary["runtime"];
  const activeTasks = Array.isArray(agent.activeTasks) ? agent.activeTasks : [];
  const taskCounts = activeTasks.reduce(
    (acc, task) => {
      const status = String(task?.status || "").toLowerCase();
      if (status === "queued") acc.queued += 1;
      else if (status === "in_progress" || status === "running") acc.running += 1;
      else if (status === "blocked") acc.blocked += 1;
      else if (status === "done") acc.done += 1;
      else if (status === "failed") acc.failed += 1;
      acc.total += 1;
      return acc;
    },
    { queued: 0, running: 0, blocked: 0, done: 0, failed: 0, total: 0 },
  );

  return {
    id: String(agent.id || "unknown"),
    name: typeof agent.name === "string" ? agent.name : undefined,
    identity: {
      name: typeof agent.name === "string" ? agent.name : undefined,
      emoji: typeof agent.emoji === "string" ? agent.emoji : undefined,
    },
    lane: typeof agent.lane === "string" ? agent.lane : undefined,
    status: agent.status === "active" || agent.status === "paused" || agent.status === "planned" ? agent.status : "planned",
    runtimeAgentId: typeof agent.runtimeAgentId === "string" ? agent.runtimeAgentId : null,
    description: typeof agent.description === "string" ? agent.description : undefined,
    default: Boolean(agent.default),
    escalatesTo: typeof agent.escalatesTo === "string" ? agent.escalatesTo : null,
    responsibilities: Array.isArray(agent.responsibilities) ? agent.responsibilities : [],
    monitorSurfaces: Array.isArray(agent.monitorSurfaces) ? agent.monitorSurfaces : [],
    communicationChannels: Array.isArray(agent.communicationChannels) ? agent.communicationChannels : [],
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    memoryPaths: Array.isArray(agent.memoryPaths) ? agent.memoryPaths : [],
    directivesPath: typeof agent.roleFile === "string" ? agent.roleFile : null,
    modelProvider: typeof agent.modelProvider === "string" ? agent.modelProvider : null,
    defaultModel: typeof agent.defaultModel === "string" ? agent.defaultModel : null,
    fallbackModel: typeof agent.fallbackModel === "string" ? agent.fallbackModel : null,
    reasoningLevel: typeof agent.reasoningLevel === "string" ? agent.reasoningLevel : null,
    authProfile: typeof agent.authProfile === "string" ? agent.authProfile : null,
    canSpawnSubagents: Boolean(agent.canSpawnSubagents),
    subagentModel: typeof agent.subagentModel === "string" ? agent.subagentModel : null,
    subagentMaxDepth: typeof agent.subagentMaxDepth === "number" ? agent.subagentMaxDepth : null,
    subagentUseCases: Array.isArray(agent.subagentUseCases) ? agent.subagentUseCases : [],
    taskTags: Array.isArray(agent.taskTags) ? agent.taskTags : [],
    taskCounts,
    runtime: runtime ?? {},
    lastTaskUpdate: activeTasks[0]?.updated_at ?? null,
    recentTaskTitles: activeTasks.slice(0, 3).map((task: any) => String(task.title || "")).filter(Boolean),
  };
}

function listAgentFiles() {
  if (!fs.existsSync(AGENTS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(AGENTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(AGENTS_DIR, name))
    .sort();
}

function readAgentRecord(filePath: string): AgentRecord {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as AgentRecord;
}

function readTaskIndex(): TaskIndexEntry[] {
  if (!fs.existsSync(TASK_INDEX_PATH)) {
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(TASK_INDEX_PATH, "utf8")) as { tasks?: TaskIndexEntry[] };
  return Array.isArray(payload.tasks) ? payload.tasks : [];
}

function getSyncScriptPath() {
  return path.join(ROOT_DIR, "tasks", "scripts", ["sync-task-board", "mjs"].join("."));
}

function syncTaskViews() {
  const result = spawnSync(process.execPath, [getSyncScriptPath()], {
    cwd: ROOT_DIR,
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `Task sync failed with status ${result.status ?? "unknown"}`);
  }
}

function updateTaskOwner(taskId: string, agentId: string, note: string) {
  const filePath = path.join(TASK_ITEMS_DIR, `${taskId}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown task: ${taskId}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const now = new Date().toISOString();
  const updatedFrontmatter = raw
    .replace(/^owner_agent:\s*".*"$/m, `owner_agent: "${agentId}"`)
    .replace(/^agent_type:\s*".*"$/m, `agent_type: "${agentId === "cd" ? "orchestrator" : agentId}"`)
    .replace(/^updated_at:\s*".*"$/m, `updated_at: "${now}"`);
  const next = updatedFrontmatter.includes("## Activity Log")
    ? updatedFrontmatter.replace(/## Activity Log\s*\n\n/, `## Activity Log\n\n- ${now} cd: ${note}\n`)
    : `${updatedFrontmatter}\n\n## Activity Log\n\n- ${now} cd: ${note}\n`;
  fs.writeFileSync(filePath, next);
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildHireDraftFromTasks(tasks: TaskIndexEntry[]): AgentHireDraft {
  const titles = tasks.map((task) => task.title).join(" ");
  const tokenCounts = new Map<string, number>();
  for (const token of titles.toLowerCase().split(/[^a-z0-9]+/)) {
    if (token.length < 5) continue;
    if (["would", "could", "should", "their", "there", "which", "through", "across"].includes(token)) continue;
    tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
  }
  const laneToken = [...tokenCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "specialist";
  const lane = normalizeId(laneToken);
  const name = titleCase(lane);
  const responsibilities = tasks.slice(0, 3).map((task) => task.title);
  return {
    name,
    lane,
    description: `Own the ${lane} lane based on recurring work currently handled by CD.`,
    monitorSurfaces: [],
    communicationChannels: [],
    responsibilities,
    taskTags: [lane],
    modelProvider: "anthropic",
    defaultModel: "anthropic/claude-sonnet-4.6",
    fallbackModel: "openai/gpt-5-mini",
    authProfile: "default",
    reasoningLevel: "medium",
    canSpawnSubagents: true,
    subagentModel: "openai/gpt-5-mini",
    subagentMaxDepth: 1,
    subagentUseCases: ["parallel lane processing"],
  };
}

function activeTasks() {
  return readTaskIndex().filter((task) => !["done", "failed", "cancelled"].includes(task.status));
}

function readRecentDelegationTraces(limit = 6): AgentManagerDelegationTrace[] {
  const traces: AgentManagerDelegationTrace[] = [];
  const tasks = readTaskIndex();

  for (const task of tasks) {
    if (!task.path || !fs.existsSync(task.path)) continue;
    const raw = fs.readFileSync(task.path, "utf8");
    const match = raw.match(/## Activity Log\s*\n([\s\S]*?)(?:\n## |$)/);
    if (!match) continue;
    const lines = match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line.startsWith("- "));
    for (const line of lines) {
      const event = line.slice(2);
      const eventMatch = event.match(/^(\S+)\s+([^:]+):\s+(.*)$/);
      if (!eventMatch) continue;
      const [, timestamp, actor, note] = eventMatch;
      if (!/delegat/i.test(note)) continue;
      traces.push({
        taskId: task.id,
        taskTitle: task.title,
        timestamp,
        actor: actor.trim(),
        note: note.trim(),
        ownerAgentId: task.owner_agent || null,
      });
    }
  }

  return traces.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, limit);
}

function buildRuntimeTriage(items: AgentSummary[]): AgentRuntimeTriageItem[] {
  return items
    .filter((agent) => {
      const state = agent.runtime?.observedState || "unknown";
      return state !== "healthy";
    })
    .map((agent) => ({
      agentId: agent.id,
      agentName: agent.identity?.name || agent.name || agent.id,
      runtimeState: agent.runtime?.observedState || "unknown",
      desiredStatus: agent.runtime?.desiredStatus ?? null,
      currentTaskId: agent.runtime?.currentTaskId ?? null,
      taskCount: agent.runtime?.taskCount ?? agent.taskCounts?.total ?? 0,
      lastSeenAt: agent.runtime?.lastSeenAt ?? null,
      lastError: agent.runtime?.lastError ?? null,
    }))
    .sort((a, b) => b.taskCount - a.taskCount || a.agentName.localeCompare(b.agentName));
}

function signalConfigFor(record: AgentRecord): AgentSignalConfig {
  switch (record.id) {
    case "cd":
      return {
        messageSources: ["gmail", "calendar", "imessage"],
        notificationTitles: [],
        conversationSources: ["heartbeat", "pre_meeting_brief", "eod_summary"],
        activitySources: ["heartbeat", "dashboard", "chat"],
        activityKeywords: [],
      };
    case "comms":
      return {
        messageSources: ["gmail", "imessage"],
        notificationTitles: ["draft reply", "review & acknowledge", "reply"],
        conversationSources: [],
        activitySources: [],
        activityKeywords: ["email", "reply", "teams", "message", "communication"],
      };
    case "calendar":
      return {
        messageSources: ["calendar"],
        notificationTitles: ["schedule", "meeting"],
        conversationSources: ["pre_meeting_brief"],
        activitySources: [],
        activityKeywords: ["calendar", "meeting", "reminder", "schedule"],
      };
    case "notes":
      return {
        messageSources: [],
        notificationTitles: [],
        conversationSources: ["pre_meeting_brief", "eod_summary"],
        activitySources: [],
        activityKeywords: ["notes", "doc", "memo", "meeting"],
      };
    case "ops":
      return {
        messageSources: [],
        notificationTitles: ["alert"],
        conversationSources: ["heartbeat"],
        activitySources: ["heartbeat", "dashboard"],
        activityKeywords: ["dashboard", "runtime", "cloudflare", "launch", "gateway", "ops"],
      };
    case "research":
      return {
        messageSources: [],
        notificationTitles: [],
        conversationSources: [],
        activitySources: [],
        activityKeywords: ["research", "learning", "notebooklm", "cto", "brief", "source"],
      };
    case "build":
      return {
        messageSources: [],
        notificationTitles: [],
        conversationSources: [],
        activitySources: ["chat"],
        activityKeywords: ["build", "code", "dashboard", "ui", "fix", "runtime"],
      };
    case "verifier":
      return {
        messageSources: [],
        notificationTitles: [],
        conversationSources: [],
        activitySources: ["chat"],
        activityKeywords: ["verify", "validation", "review", "regression", "test"],
      };
    default:
      return {
        messageSources: [],
        notificationTitles: [],
        conversationSources: [],
        activitySources: [],
        activityKeywords: record.taskTags ?? [],
      };
  }
}

function profilePathsFor(agentId: string) {
  const profileDir = path.join(AGENT_PROFILES_DIR, agentId);
  const soulPath = path.join(profileDir, "SOUL.md");
  const memoryPath = path.join(profileDir, "MEMORY.md");
  const heartbeatPath = path.join(profileDir, "HEARTBEAT.md");
  const directivesPath = path.join(profileDir, "DIRECTIVES.md");
  const inboxPath = path.join(profileDir, "INBOX.jsonl");
  const outboxPath = path.join(profileDir, "OUTBOX.jsonl");
  const artifactsDir = path.join(profileDir, "artifacts");
  return {
    soulPath: fs.existsSync(soulPath) ? soulPath : null,
    memoryPath: fs.existsSync(memoryPath) ? memoryPath : null,
    heartbeatPath: fs.existsSync(heartbeatPath) ? heartbeatPath : null,
    directivesPath: fs.existsSync(directivesPath) ? directivesPath : null,
    inboxPath: fs.existsSync(inboxPath) ? inboxPath : null,
    outboxPath: fs.existsSync(outboxPath) ? outboxPath : null,
    artifactsDir: fs.existsSync(artifactsDir) ? artifactsDir : null,
  };
}

function ensureAgentProfileScaffold(record: AgentRecord) {
  const profileDir = path.join(AGENT_PROFILES_DIR, record.id);
  fs.mkdirSync(profileDir, { recursive: true });

  const soulPath = path.join(profileDir, "SOUL.md");
  const memoryPath = path.join(profileDir, "MEMORY.md");
  const heartbeatPath = path.join(profileDir, "HEARTBEAT.md");
  const directivesPath = path.join(profileDir, "DIRECTIVES.md");
  const inboxPath = path.join(profileDir, "INBOX.jsonl");
  const outboxPath = path.join(profileDir, "OUTBOX.jsonl");
  const artifactsDir = path.join(profileDir, "artifacts");

  if (!fs.existsSync(soulPath)) {
    fs.writeFileSync(
      soulPath,
      `# ${record.name} Soul\n\nYou are ${record.name}, the ${record.lane || "specialist"} agent.\n\n${record.description || "Operate within your lane and hand work back clearly."}\n`,
    );
  }

  if (!fs.existsSync(memoryPath)) {
    fs.writeFileSync(
      memoryPath,
      `# ${record.name} Memory\n\nDurable memory for ${record.name}.\n\n- Preserve lane-specific facts, operating patterns, and recurring issues.\n`,
    );
  }

  if (!fs.existsSync(heartbeatPath)) {
    fs.writeFileSync(
      heartbeatPath,
      `# ${record.name} Heartbeat\n\n- Review ${record.lane || "lane"} work.\n- Surface blockers early.\n- Promote durable memory and create tasks when needed.\n`,
    );
  }

  if (!fs.existsSync(directivesPath)) {
    const responsibilities = (record.responsibilities ?? []).map((item) => `- ${item}`).join("\n") || "- Work inside your lane.";
    const surfaces = (record.monitorSurfaces ?? []).map((item) => `- ${item}`).join("\n") || "- No surfaces configured yet.";
    fs.writeFileSync(
      directivesPath,
      `# ${record.name} Directives\n\n## Responsibilities\n${responsibilities}\n\n## Surfaces To Watch\n${surfaces}\n\n## Escalation\n- Escalate to ${record.escalatesTo || "cd"} when work leaves your lane or needs a cross-agent decision.\n\n## Task Rule\n- Claim or create tasks in the canonical ledger instead of leaving work implied in chat.\n`,
    );
  }

  if (!fs.existsSync(inboxPath)) {
    fs.writeFileSync(inboxPath, "");
  }
  if (!fs.existsSync(outboxPath)) {
    fs.writeFileSync(outboxPath, "");
  }
  fs.mkdirSync(artifactsDir, { recursive: true });
}

function appendMailboxEntry(agentId: string, fileName: "INBOX.jsonl" | "OUTBOX.jsonl", entry: Record<string, unknown>) {
  const profileDir = path.join(AGENT_PROFILES_DIR, agentId);
  fs.mkdirSync(profileDir, { recursive: true });
  const filePath = path.join(profileDir, fileName);
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
}

function sendAgentMessage(params: {
  fromAgentId: string;
  toAgentId: string;
  subject: string;
  body: string;
  taskIds?: string[];
  artifactPaths?: string[];
  kind?: string;
}) {
  const timestamp = new Date().toISOString();
  const entry = {
    id: `msg-${timestamp}`,
    at: timestamp,
    from: params.fromAgentId,
    to: params.toAgentId,
    kind: params.kind || "handoff",
    subject: params.subject,
    body: params.body,
    taskIds: params.taskIds ?? [],
    artifactPaths: params.artifactPaths ?? [],
  };
  appendMailboxEntry(params.toAgentId, "INBOX.jsonl", entry);
  appendMailboxEntry(params.fromAgentId, "OUTBOX.jsonl", entry);
}

function loadAgentFeeds(record: AgentRecord) {
  const config = signalConfigFor(record);
  const script = `
import json, sqlite3, sys

config = json.loads(sys.argv[1])
journal_db = sys.argv[2]
runtime_db = sys.argv[3]

feeds = {"recentCommunications": [], "recentActivity": []}

def add(target, category, source, title, body, timestamp):
    feeds[target].append({
        "id": f"{target}:{category}:{len(feeds[target])}",
        "category": category,
        "source": source or "unknown",
        "title": title or source or "event",
        "body": body or "",
        "timestamp": timestamp or "",
    })

try:
    conn = sqlite3.connect(runtime_db)
    cur = conn.cursor()

    if config["messageSources"]:
        placeholders = ",".join(["?"] * len(config["messageSources"]))
        rows = cur.execute(
            f"SELECT source, sender, subject, substr(content,1,240), timestamp FROM messages WHERE source IN ({placeholders}) ORDER BY id DESC LIMIT 12",
            config["messageSources"],
        ).fetchall()
        for source, sender, subject, content, timestamp in rows:
            add("recentCommunications", "message", source, subject or sender or source, content, timestamp)

    rows = cur.execute("SELECT metadata, substr(content,1,240), timestamp FROM conversations ORDER BY id DESC LIMIT 20").fetchall()
    for metadata, content, timestamp in rows:
        meta = {}
        try:
            meta = json.loads(metadata) if metadata else {}
        except Exception:
            meta = {}
        source = meta.get("source", "")
        if source in config["conversationSources"]:
            add("recentCommunications", "conversation", source, source.replace("_", " "), content, timestamp)

    rows = cur.execute("SELECT title, body, type, created_at FROM notifications ORDER BY id DESC LIMIT 20").fetchall()
    for title, body, ntype, created_at in rows:
        haystack = f"{title or ''} {body or ''}".lower()
        if any(term and term in haystack for term in config["notificationTitles"]):
            add("recentCommunications", "notification", ntype or "notification", title, body, created_at)

    conn.close()
except Exception:
    pass

try:
    conn = sqlite3.connect(journal_db)
    cur = conn.cursor()
    rows = cur.execute("SELECT timestamp, source, summary, details FROM activity_log ORDER BY id DESC LIMIT 30").fetchall()
    for timestamp, source, summary, details in rows:
        text = f"{summary or ''} {details or ''}".lower()
        if (
            source in config["activitySources"] or
            any(term and term in text for term in config["activityKeywords"])
        ):
            add("recentActivity", "activity", source, summary or source, (details or "")[:240], timestamp)
    conn.close()
except Exception:
    pass

feeds["recentCommunications"] = feeds["recentCommunications"][:8]
feeds["recentActivity"] = feeds["recentActivity"][:8]
print(json.dumps(feeds))
`;

  const result = spawnSync("python3", ["-c", script, JSON.stringify(config), JOURNAL_DB_PATH, RUNTIME_DB_PATH], {
    env: process.env,
    encoding: "utf8",
  });

  if (result.status !== 0 || !result.stdout.trim()) {
    return {
      recentCommunications: [] as AgentFeedItem[],
      recentActivity: [] as AgentFeedItem[],
    };
  }

  const payload = JSON.parse(result.stdout) as {
    recentCommunications?: AgentFeedItem[];
    recentActivity?: AgentFeedItem[];
  };

  return {
    recentCommunications: payload.recentCommunications ?? [],
    recentActivity: payload.recentActivity ?? [],
  };
}

function toTask(task: TaskIndexEntry): AgentOwnedTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    ownerAgent: task.owner_agent,
    updatedAt: task.updated_at,
    source: task.source,
  };
}

function statusCounts(tasks: TaskIndexEntry[]) {
  const counts = {
    queued: 0,
    running: 0,
    blocked: 0,
    done: 0,
    failed: 0,
    total: tasks.length,
  };

  for (const task of tasks) {
    if (task.status === "queued") counts.queued += 1;
    else if (task.status === "blocked") counts.blocked += 1;
    else if (task.status === "done") counts.done += 1;
    else if (task.status === "failed" || task.status === "cancelled") counts.failed += 1;
    else counts.running += 1;
  }

  return counts;
}

function mergeTaskLists(primary: AgentOwnedTask[], secondary: AgentOwnedTask[]) {
  const merged = new Map<string, AgentOwnedTask>();
  for (const task of [...primary, ...secondary]) {
    if (!task.id) continue;
    const current = merged.get(task.id);
    if (!current || Date.parse(task.updatedAt || "") > Date.parse(current.updatedAt || "")) {
      merged.set(task.id, task);
    }
  }
  return [...merged.values()].sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""));
}

function mergedAgentSummary(params: { record?: AgentRecord | null; rosterAgent?: Record<string, any> | null; tasks: TaskIndexEntry[] }): AgentSummary {
  const { record, rosterAgent, tasks } = params;
  const base = record ? summarizeAgent(record, tasks) : rosterAgent ? summarizeJoinedRosterAgent(rosterAgent) : null;
  if (!base) {
    throw new Error("Agent summary requires a record or roster agent");
  }
  if (!rosterAgent) {
    return base;
  }

  const rosterSummary = summarizeJoinedRosterAgent(rosterAgent);
  const activeTasks = Array.isArray(rosterAgent.activeTasks) ? rosterAgent.activeTasks : [];
  const rosterTitles = activeTasks.map((task: any) => String(task?.title || "")).filter(Boolean);

  return {
    ...base,
    ...rosterSummary,
    name: base.name || rosterSummary.name,
    identity: {
      ...base.identity,
      ...rosterSummary.identity,
    },
    description: base.description || rosterSummary.description,
    lane: base.lane || rosterSummary.lane,
    status: base.status || rosterSummary.status,
    escalatesTo: base.escalatesTo ?? rosterSummary.escalatesTo ?? null,
    responsibilities: base.responsibilities?.length ? base.responsibilities : rosterSummary.responsibilities,
    monitorSurfaces: base.monitorSurfaces?.length ? base.monitorSurfaces : rosterSummary.monitorSurfaces,
    communicationChannels: base.communicationChannels?.length ? base.communicationChannels : rosterSummary.communicationChannels,
    tools: base.tools?.length ? base.tools : rosterSummary.tools,
    memoryPaths: base.memoryPaths?.length ? base.memoryPaths : rosterSummary.memoryPaths,
    directivesPath: base.directivesPath ?? rosterSummary.directivesPath ?? null,
    modelProvider: base.modelProvider ?? rosterSummary.modelProvider ?? null,
    defaultModel: base.defaultModel ?? rosterSummary.defaultModel ?? null,
    fallbackModel: base.fallbackModel ?? rosterSummary.fallbackModel ?? null,
    reasoningLevel: base.reasoningLevel ?? rosterSummary.reasoningLevel ?? null,
    authProfile: base.authProfile ?? rosterSummary.authProfile ?? null,
    canSpawnSubagents: base.canSpawnSubagents ?? rosterSummary.canSpawnSubagents ?? false,
    subagentModel: base.subagentModel ?? rosterSummary.subagentModel ?? null,
    subagentMaxDepth: base.subagentMaxDepth ?? rosterSummary.subagentMaxDepth ?? null,
    subagentUseCases: base.subagentUseCases?.length ? base.subagentUseCases : rosterSummary.subagentUseCases,
    taskTags: base.taskTags?.length ? base.taskTags : rosterSummary.taskTags,
    taskCounts: (base.taskCounts?.total ?? 0) >= (rosterSummary.taskCounts?.total ?? 0) ? base.taskCounts : rosterSummary.taskCounts,
    runtimeAgentId: rosterSummary.runtime?.runtimeAgentId ?? rosterSummary.runtimeAgentId ?? base.runtimeAgentId ?? null,
    runtime: rosterSummary.runtime ?? base.runtime,
    lastTaskUpdate: base.lastTaskUpdate ?? rosterSummary.lastTaskUpdate ?? null,
    recentTaskTitles: base.recentTaskTitles?.length ? base.recentTaskTitles : rosterTitles,
  };
}

function summarizeAgent(record: AgentRecord, tasks: TaskIndexEntry[]): AgentSummary {
  const ownedTasks = tasks.filter((task) => task.owner_agent === record.id);
  const relatedTasks = tasks.filter((task) =>
    (record.taskTags ?? []).some((tag) => (task.tags ?? []).includes(tag)),
  );
  const visibleTasks = ownedTasks.length ? ownedTasks : relatedTasks;
  const latest = [...visibleTasks]
    .map((task) => Date.parse(task.updated_at))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  const profiles = profilePathsFor(record.id);

  return {
    id: record.id,
    name: record.name,
    lane: record.lane,
    status: record.status,
    runtimeAgentId: record.runtimeAgentId ?? null,
    description: record.description,
    default: record.default ?? false,
    escalatesTo: record.escalatesTo ?? null,
    responsibilities: record.responsibilities ?? [],
    monitorSurfaces: record.monitorSurfaces ?? [],
    communicationChannels: record.communicationChannels ?? [],
    tools: record.tools ?? [],
    memoryPaths: record.memoryPaths ?? [],
    soulPath: profiles.soulPath,
    memoryPath: profiles.memoryPath,
    heartbeatPath: profiles.heartbeatPath,
    directivesPath: profiles.directivesPath,
    inboxPath: profiles.inboxPath,
    outboxPath: profiles.outboxPath,
    artifactsDir: profiles.artifactsDir,
    modelProvider: record.modelProvider ?? null,
    defaultModel: record.defaultModel ?? null,
    fallbackModel: record.fallbackModel ?? null,
    reasoningLevel: record.reasoningLevel ?? null,
    authProfile: record.authProfile ?? null,
    canSpawnSubagents: record.canSpawnSubagents ?? false,
    subagentModel: record.subagentModel ?? null,
    subagentMaxDepth: record.subagentMaxDepth ?? null,
    subagentUseCases: record.subagentUseCases ?? [],
    taskTags: record.taskTags ?? [],
    identity: {
      name: record.name,
      emoji: record.emoji,
      theme: record.description,
    },
    taskCounts: statusCounts(visibleTasks),
    lastTaskUpdate: latest ? new Date(latest).toISOString() : null,
    recentTaskTitles: visibleTasks.slice(0, 3).map((task) => task.title),
  };
}

function detailForAgent(record: AgentRecord, tasks: TaskIndexEntry[]): AgentDetail {
  const ownedTasks = tasks
    .filter((task) => task.owner_agent === record.id)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .map(toTask);
  const relatedTasks = tasks
    .filter((task) =>
      task.owner_agent !== record.id &&
      (record.taskTags ?? []).some((tag) => (task.tags ?? []).includes(tag)),
    )
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .map(toTask);

  const feeds = loadAgentFeeds(record);

  return {
    ...summarizeAgent(record, tasks),
    ownedTasks,
    relatedTasks,
    recentCommunications: feeds.recentCommunications,
    recentActivity: feeds.recentActivity,
  };
}

function normalizeId(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listCanonicalAgents() {
  const tasks = readTaskIndex();
  const roster = readJoinedRoster();
  const rosterAgents = Array.isArray(roster?.agents) ? roster!.agents : [];
  const recordMap = new Map(listAgentFiles().map((filePath) => {
    const record = readAgentRecord(filePath);
    return [record.id, record] as const;
  }));

  const ids = new Set<string>([
    ...rosterAgents.map((agent) => String((agent as Record<string, unknown>).id || "")).filter(Boolean),
    ...recordMap.keys(),
  ]);

  return [...ids]
    .map((id) => mergedAgentSummary({
      record: recordMap.get(id) ?? null,
      rosterAgent: (rosterAgents.find((agent) => String((agent as Record<string, unknown>).id || "") === id) as Record<string, any> | undefined) ?? null,
      tasks,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function getCanonicalAgent(agentId: string) {
  const tasks = readTaskIndex();
  const filePath = path.join(AGENTS_DIR, `${agentId}.json`);
  const record = fs.existsSync(filePath) ? readAgentRecord(filePath) : null;
  const rosterAgent = readRosterAgent(agentId) as Record<string, any> | null;

  if (!record && !rosterAgent) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const summary = mergedAgentSummary({ record, rosterAgent, tasks });
  const detail = record
    ? detailForAgent(record, tasks)
    : {
        ...summary,
        ownedTasks: [],
        relatedTasks: [],
        recentCommunications: [],
        recentActivity: [],
      };

  const rosterOwnedTasks: AgentOwnedTask[] = Array.isArray(rosterAgent?.activeTasks)
    ? rosterAgent!.activeTasks.map((task: any) => ({
        id: String(task.id || ""),
        title: String(task.title || ""),
        status: String(task.status || "unknown"),
        priority: String(task.priority || "medium"),
        ownerAgent: agentId,
        updatedAt: String(task.updated_at || ""),
        source: String(task.path || "roster"),
      }))
    : [];

  return {
    ...detail,
    ...summary,
    ownedTasks: mergeTaskLists(detail.ownedTasks ?? [], rosterOwnedTasks),
    relatedTasks: detail.relatedTasks ?? [],
    recentCommunications: detail.recentCommunications ?? [],
    recentActivity: detail.recentActivity ?? [],
  };
}

export function createCanonicalAgent(input: Partial<AgentRecord>) {
  const identity = (input as { identity?: { emoji?: string; theme?: string } }).identity;
  const id = normalizeId(input.id || input.name || "");
  if (!id) {
    throw new Error("Agent name is required");
  }
  const filePath = path.join(AGENTS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Agent already exists: ${id}`);
  }
  const record: AgentRecord = {
    id,
    name: String(input.name || id),
    emoji: input.emoji || identity?.emoji || "🤖",
    lane: input.lane || "custom",
    status: input.status || "planned",
    runtimeAgentId: input.runtimeAgentId ?? null,
    default: false,
    description: input.description || identity?.theme || "",
    responsibilities: input.responsibilities ?? [],
    monitorSurfaces: input.monitorSurfaces ?? [],
    communicationChannels: input.communicationChannels ?? [],
    tools: input.tools ?? [],
    memoryPaths: input.memoryPaths ?? [],
    modelProvider: input.modelProvider ?? null,
    defaultModel: input.defaultModel ?? null,
    fallbackModel: input.fallbackModel ?? null,
    reasoningLevel: input.reasoningLevel ?? null,
    authProfile: input.authProfile ?? null,
    canSpawnSubagents: input.canSpawnSubagents ?? false,
    subagentModel: input.subagentModel ?? null,
    subagentMaxDepth: input.subagentMaxDepth ?? null,
    subagentUseCases: input.subagentUseCases ?? [],
    taskTags: input.taskTags ?? [],
    escalatesTo: input.escalatesTo ?? "cd",
  };
  fs.mkdirSync(AGENTS_DIR, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`);
  ensureAgentProfileScaffold(record);
  return getCanonicalAgent(id);
}

export function updateCanonicalAgent(agentId: string, patch: Partial<AgentRecord>) {
  const identity = (patch as { identity?: { emoji?: string; theme?: string } }).identity;
  const filePath = path.join(AGENTS_DIR, `${agentId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown agent: ${agentId}`);
  }
  const current = readAgentRecord(filePath);
  const next: AgentRecord = {
    ...current,
    ...patch,
    id: current.id,
    emoji: patch.emoji || identity?.emoji || current.emoji,
    description: patch.description || identity?.theme || current.description,
  };
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`);
  return getCanonicalAgent(agentId);
}

export function deleteCanonicalAgent(agentId: string) {
  const filePath = path.join(AGENTS_DIR, `${agentId}.json`);
  const profileDir = path.join(AGENT_PROFILES_DIR, agentId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown agent: ${agentId}`);
  }
  fs.unlinkSync(filePath);
  fs.rmSync(profileDir, { recursive: true, force: true });
  return { ok: true };
}

export function getAgentManagerRecommendations(): AgentManagerRecommendation[] {
  const tasks = activeTasks();
  const knownAgentIds = new Set(listCanonicalAgents().map((agent) => agent.id));
  const delegateRecs: AgentManagerRecommendation[] = tasks
    .map((task) => {
      const proposedAgentId = inferAgentOwner({
        title: task.title,
        tags: task.tags ?? [],
        source: task.source,
      });
      return { task, proposedAgentId };
    })
    .filter(({ task, proposedAgentId }) => proposedAgentId !== task.owner_agent && knownAgentIds.has(proposedAgentId))
    .slice(0, 8)
    .map(({ task, proposedAgentId }) => ({
      kind: "delegate" as const,
      title: `Delegate ${task.id} to ${proposedAgentId}`,
      rationale: `Task title, tags, or source align more closely with the ${proposedAgentId} lane than ${task.owner_agent}.`,
      taskIds: [task.id],
      proposedAgentId,
      currentOwnerAgentId: task.owner_agent,
      evidence: [task.title, ...(task.tags ?? []), task.source].filter(Boolean).slice(0, 4),
    }));

  const cdTasks = tasks.filter((task) => task.owner_agent === "cd");
  const hireRecs: AgentManagerRecommendation[] = [];
  if (cdTasks.length >= 2) {
    const draft = buildHireDraftFromTasks(cdTasks.slice(0, 5));
    if (!knownAgentIds.has(draft.lane)) {
      hireRecs.push({
        kind: "hire",
        title: `Hire ${draft.name}`,
        rationale: "CD still owns recurring active work that does not cleanly belong to an existing specialist lane.",
        taskIds: cdTasks.slice(0, 5).map((task) => task.id),
        proposedAgentId: draft.lane,
        currentOwnerAgentId: "cd",
        evidence: cdTasks.slice(0, 3).map((task) => task.title),
        draftAgent: draft,
      });
    }
  }

  return [...delegateRecs, ...hireRecs];
}

export function getAgentManagerAudit(): AgentManagerAudit {
  const roster = readJoinedRoster();
  const agents = listCanonicalAgents();
  const tasks = activeTasks();
  const knownAgentIds = new Set(agents.map((agent) => agent.id));
  const delegated = tasks.filter((task) => task.owner_agent !== "cd" && task.owner_agent !== "unassigned").length;
  const onCd = tasks.filter((task) => task.owner_agent === "cd").length;
  const unownedTasks = tasks.filter((task) => !task.owner_agent || task.owner_agent === "unassigned" || !knownAgentIds.has(task.owner_agent));
  const unowned = unownedTasks.length;
  const warnings: string[] = [];
  const summary = {
    totalAgents: roster?.summary?.totalAgents ?? knownAgentIds.size,
    healthy: roster?.summary?.healthy ?? 0,
    busy: roster?.summary?.busy ?? 0,
    idle: roster?.summary?.idle ?? 0,
    missing: roster?.summary?.missing ?? 0,
    unknown: roster?.summary?.unknown ?? 0,
    orphanedSessions: roster?.summary?.orphanedSessions ?? 0,
  };
  const runtimeTriage = buildRuntimeTriage(agents);
  const delegationTraces = readRecentDelegationTraces();
  const actions: AgentManagerAudit["actions"] = [];

  if (summary.missing > 0) {
    warnings.push(`${summary.missing} roster agents are configured but not currently attached to a live runtime session.`);
    actions.push({
      id: 'missing-runtime',
      title: 'Missing runtime coverage',
      detail: `${summary.missing} configured agents are absent from the live runtime snapshot. Prioritize the ones already holding work.`,
      tone: 'orange',
      ctaLabel: 'Review agent roster',
      ctaHref: '/agents',
    });
  }
  if (summary.orphanedSessions > 0) {
    warnings.push(`${summary.orphanedSessions} orphaned sessions were detected in the joined roster snapshot.`);
    actions.push({
      id: 'orphaned-sessions',
      title: 'Orphaned runtime sessions detected',
      detail: `${summary.orphanedSessions} runtime sessions are no longer mapped cleanly to named agents. Clean this up before trusting the roster picture.`,
      tone: 'red',
      ctaLabel: 'Inspect live sessions',
      ctaHref: '/heartbeat',
    });
  }
  if (onCd > 3) {
    warnings.push(`CD still owns ${onCd} active tasks; delegation pressure is building.`);
    actions.push({
      id: 'cd-overload',
      title: 'CD is still holding too much execution',
      detail: `${onCd} active tasks still sit on CD. Use the recommendations below to push execution back into specialist lanes.`,
      tone: 'blue',
      ctaLabel: 'Review recommendations',
      ctaHref: '/agents',
    });
  }
  if (unowned > 0) {
    warnings.push(`${unowned} active tasks have no valid owner in the current roster.`);
    actions.push({
      id: 'unowned-tasks',
      title: 'Tasks have no valid owner',
      detail: `${unowned} active tasks are effectively drifting. Reassign them before they disappear into the ledger.`,
      tone: 'orange',
      ctaLabel: 'Open ops board',
      ctaHref: '/ops',
    });
  }
  if (!actions.length) {
    actions.push({
      id: 'healthy-flow',
      title: 'Chief of Staff flow looks stable',
      detail: 'Runtime coverage, delegation, and task ownership are currently aligned closely enough to operate without intervention.',
      tone: 'green',
      ctaLabel: 'Open agents',
      ctaHref: '/agents',
    });
  }

  return {
    generatedAt: (roster as any)?.generatedAt ?? null,
    rosterSummary: summary,
    taskSummary: {
      active: tasks.length,
      delegated,
      onCd,
      unowned,
    },
    actions,
    runtimeTriage,
    delegationTraces,
    warnings,
  };
}

export function delegateCanonicalTask(taskId: string, agentId: string) {
  const agent = getCanonicalAgent(agentId);
  updateTaskOwner(taskId, agentId, `Delegated task to ${agentId}.`);
  syncTaskViews();
  return {
    ok: true,
    agent,
    taskId,
  };
}

export function delegateCanonicalTasks(taskIds: string[], agentId: string) {
  for (const taskId of taskIds) {
    updateTaskOwner(taskId, agentId, `Delegated task to ${agentId}.`);
  }
  syncTaskViews();
  return {
    ok: true,
    taskIds,
    agentId,
  };
}

export function refineAgentPacket(agentId: string) {
  const filePath = path.join(AGENTS_DIR, `${agentId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown agent: ${agentId}`);
  }
  const record = readAgentRecord(filePath);
  const tasks = readTaskIndex().filter((task) => task.owner_agent === agentId);
  const profileDir = path.join(AGENT_PROFILES_DIR, agentId);
  fs.mkdirSync(profileDir, { recursive: true });

  const topTasks = tasks.slice(0, 5).map((task) => `- ${task.title}`).join("\n") || "- No active owned tasks yet.";
  fs.writeFileSync(
    path.join(profileDir, "SOUL.md"),
    `# ${record.name} Soul\n\nYou are ${record.name}, the ${record.lane || "specialist"} agent.\n\n${record.description || "Operate within your lane and hand work back clearly."}\n\n## Current Focus\n${topTasks}\n`,
  );
  fs.writeFileSync(
    path.join(profileDir, "MEMORY.md"),
    `# ${record.name} Memory\n\nDurable memory for ${record.name}.\n\n- Preserve lane-specific facts, operating patterns, and recurring issues.\n- Current owned work snapshot:\n${topTasks}\n`,
  );
  fs.writeFileSync(
    path.join(profileDir, "HEARTBEAT.md"),
    `# ${record.name} Heartbeat\n\n- Review ${record.lane || "lane"} work.\n- Surface blockers early.\n- Promote durable memory and create tasks when needed.\n- Current owned work snapshot:\n${topTasks}\n`,
  );
  fs.writeFileSync(
    path.join(profileDir, "DIRECTIVES.md"),
    `# ${record.name} Directives\n\n## Responsibilities\n${(record.responsibilities ?? []).map((item) => `- ${item}`).join("\n") || "- Work inside your lane."}\n\n## Execution Settings\n- provider: ${record.modelProvider || "unset"}\n- default model: ${record.defaultModel || "unset"}\n- fallback model: ${record.fallbackModel || "unset"}\n- auth profile: ${record.authProfile || "unset"}\n- can spawn subagents: ${record.canSpawnSubagents ? "yes" : "no"}\n\n## Current Owned Work\n${topTasks}\n`,
  );

  return getCanonicalAgent(agentId);
}

export function hireAgentFromTaskCluster(input: {
  taskIds: string[];
  draft?: Partial<AgentHireDraft>;
}) {
  const tasks = readTaskIndex().filter((task) => input.taskIds.includes(task.id));
  if (!tasks.length) {
    throw new Error("No tasks selected for hire flow");
  }
  const baseDraft = buildHireDraftFromTasks(tasks);
  const draft = { ...baseDraft, ...(input.draft ?? {}) };
  const agent = createCanonicalAgent(draft);
  if (tasks.length) {
    delegateCanonicalTasks(tasks.map((task) => task.id), agent.id);
    refineAgentPacket(agent.id);
  }
  return getCanonicalAgent(agent.id);
}
