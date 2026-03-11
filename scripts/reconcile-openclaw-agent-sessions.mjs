#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const storageRoot = "/Volumes/Storage/OpenClaw";
const antigravityDir = path.join(storageRoot, ".antigravity");
const agentsDir = path.join(antigravityDir, "agents");
const runtimeDir = path.join(antigravityDir, "runtime");
const tasksIndexPath = path.join(antigravityDir, "tasks", "index.json");
const runtimeSessionsPath = path.join(runtimeDir, "sessions.json");
const rosterPath = path.join(runtimeDir, "roster.json");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function readRegistryAgents() {
  return fs
    .readdirSync(agentsDir)
    .filter((name) => name.endsWith(".json") && name !== "registry.json")
    .map((name) => readJson(path.join(agentsDir, name), {}))
    .filter((agent) => agent && agent.id)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function loadSessionsSnapshot() {
  const raw = execFileSync("openclaw", ["sessions", "--all-agents", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(raw);
}

function loadActiveTasks() {
  const payload = readJson(tasksIndexPath, { tasks: [] });
  const activeStatuses = new Set(["queued", "in_progress", "review", "blocked"]);
  const byOwner = new Map();
  for (const task of payload.tasks || []) {
    if (!task?.owner_agent || !activeStatuses.has(task.status)) continue;
    const entry = byOwner.get(task.owner_agent) || [];
    entry.push({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      updated_at: task.updated_at,
      path: task.path,
    });
    byOwner.set(task.owner_agent, entry);
  }
  for (const entry of byOwner.values()) {
    entry.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  }
  return byOwner;
}

function candidateSessionKeys(agent) {
  const runtimeAgentId = agent.runtimeAgentId || (agent.id === "cd" ? "main" : agent.id);
  const keys = new Set();
  if (agent.sessionLabel) keys.add(agent.sessionLabel);
  keys.add(`agent:${runtimeAgentId}:main`);
  keys.add(`agent:${runtimeAgentId}:dashboard-chat`);
  return [...keys].filter(Boolean);
}

function findBestSession(agent, sessions) {
  const runtimeAgentId = agent.runtimeAgentId || (agent.id === "cd" ? "main" : agent.id);
  const candidates = candidateSessionKeys(agent);
  for (const key of candidates) {
    const exact = sessions.find((session) => session.key === key);
    if (exact) return exact;
  }
  const sameAgent = sessions
    .filter((session) => session.agentId === runtimeAgentId)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  return sameAgent[0] || null;
}

function computeObservedState(agent, session, tasks) {
  if (!session) {
    if (["running", "available"].includes(agent.desiredStatus)) return "missing";
    return "unknown";
  }
  if (tasks.length > 0) return "busy";
  if (["running", "available"].includes(agent.desiredStatus)) return "healthy";
  return "idle";
}

function buildRuntimeRecord(agent, session, tasks) {
  const runtimeAgentId = agent.runtimeAgentId || (agent.id === "cd" ? "main" : agent.id);
  return {
    sessionLabel: agent.sessionLabel || null,
    runtimeAgentId,
    desiredStatus: agent.desiredStatus || agent.status || "unknown",
    observedState: computeObservedState(agent, session, tasks),
    sessionKey: session?.key || null,
    sessionId: session?.sessionId || null,
    model: session?.model || null,
    modelProvider: session?.modelProvider || null,
    lastSeenAt: session?.updatedAt ? new Date(session.updatedAt).toISOString() : null,
    ageMs: session?.ageMs ?? null,
    currentTaskId: tasks[0]?.id || null,
    taskCount: tasks.length,
    lastError: null,
    matchedBy: session ? (candidateSessionKeys(agent).includes(session.key) ? "session-key" : "agent-id") : null,
  };
}

function main() {
  ensureDir(runtimeDir);
  const agents = readRegistryAgents();
  const sessionSnapshot = loadSessionsSnapshot();
  const sessions = Array.isArray(sessionSnapshot.sessions) ? sessionSnapshot.sessions : [];
  const tasksByOwner = loadActiveTasks();

  const runtimeAgents = {};
  const rosterAgents = [];
  const matchedSessionKeys = new Set();

  for (const agent of agents) {
    const tasks = tasksByOwner.get(agent.id) || [];
    const session = findBestSession(agent, sessions);
    if (session?.key) matchedSessionKeys.add(session.key);
    const runtime = buildRuntimeRecord(agent, session, tasks);
    runtimeAgents[agent.id] = runtime;
    rosterAgents.push({
      ...agent,
      runtime,
      activeTasks: tasks,
      health: runtime.observedState,
    });
  }

  const orphanedSessions = sessions
    .filter((session) => !matchedSessionKeys.has(session.key))
    .map((session) => ({
      key: session.key,
      sessionId: session.sessionId || null,
      agentId: session.agentId || null,
      model: session.model || null,
      updatedAt: session.updatedAt ? new Date(session.updatedAt).toISOString() : null,
      kind: session.kind || null,
      observedState: "orphaned",
    }));

  const runtimePayload = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: "openclaw sessions --all-agents --json",
    sessionStoreCount: sessionSnapshot.count || sessions.length,
    agents: runtimeAgents,
    orphanedSessions,
  };

  const rosterPayload = {
    version: 1,
    generatedAt: runtimePayload.generatedAt,
    source: runtimePayload.source,
    summary: {
      totalAgents: rosterAgents.length,
      healthy: rosterAgents.filter((agent) => agent.health === "healthy").length,
      busy: rosterAgents.filter((agent) => agent.health === "busy").length,
      idle: rosterAgents.filter((agent) => agent.health === "idle").length,
      missing: rosterAgents.filter((agent) => agent.health === "missing").length,
      unknown: rosterAgents.filter((agent) => agent.health === "unknown").length,
      orphanedSessions: orphanedSessions.length,
    },
    agents: rosterAgents,
    orphanedSessions,
  };

  fs.writeFileSync(runtimeSessionsPath, `${JSON.stringify(runtimePayload, null, 2)}\n`, "utf8");
  fs.writeFileSync(rosterPath, `${JSON.stringify(rosterPayload, null, 2)}\n`, "utf8");
  process.stdout.write(`Reconciled ${rosterAgents.length} agents against ${sessions.length} sessions.\n`);
}

main();
