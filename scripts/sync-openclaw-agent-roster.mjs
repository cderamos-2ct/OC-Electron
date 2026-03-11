#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const storageRoot = "/Volumes/Storage/OpenClaw";
const agentsDir = path.join(storageRoot, ".antigravity", "agents");
const registryPath = path.join(agentsDir, "registry.json");
const runtimeAgentsPath = "/Users/cderamos/.openclaw/runtime-workspace/AGENTS.md";
const workspaceAgentsPath = "/Users/cderamos/.openclaw/workspace/AGENTS.md";

const START_MARKER = "<!-- OPENCLAW:COWORKERS:START -->";
const END_MARKER = "<!-- OPENCLAW:COWORKERS:END -->";

function readAgentFiles() {
  return fs
    .readdirSync(agentsDir)
    .filter((name) => name.endsWith(".json") && name !== "registry.json")
    .map((name) => JSON.parse(fs.readFileSync(path.join(agentsDir, name), "utf8")))
    .sort((a, b) => {
      if (a.default && !b.default) return -1;
      if (!a.default && b.default) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
}

function normalizeAgent(agent) {
  const runtimeAgentId = agent.runtimeAgentId || (agent.id === "cd" ? "main" : agent.id);
  const jobDuties = Array.isArray(agent.jobDuties) && agent.jobDuties.length > 0 ? agent.jobDuties : agent.responsibilities || [];
  const roleFile = path.join(agentsDir, `${agent.id}.md`);
  const kind = agent.kind || "persistent";
  const persistent = agent.persistent ?? kind === "persistent";
  const spawnMode = agent.spawnMode || "isolated-session";
  const startupPolicy = agent.startupPolicy || (persistent ? "start-on-demand-and-reconcile" : "manual");
  const sessionLabel = agent.sessionLabel || `agent:${runtimeAgentId}:main`;
  return {
    ...agent,
    runtimeAgentId,
    jobDuties,
    kind,
    persistent,
    spawnMode,
    startupPolicy,
    sessionLabel,
    roleFile,
    handoffRules:
      agent.handoffRules ||
      [
        `Own ${agent.lane || agent.id} lane work first.`,
        `Escalate cross-lane or blocked work to ${agent.escalatesTo || "cd"}.`,
      ],
  };
}

function writeRegistry(agents) {
  fs.writeFileSync(registryPath, JSON.stringify(agents, null, 2) + "\n", "utf8");
}

function syncRoleFiles(agents) {
  for (const agent of agents) {
    const content = [
      `# ${agent.name}`,
      "",
      `- id: \`${agent.id}\``,
      `- lane: \`${agent.lane || "unknown"}\``,
      `- runtimeAgentId: \`${agent.runtimeAgentId}\``,
      `- sessionLabel: \`${agent.sessionLabel}\``,
      `- kind: \`${agent.kind}\``,
      `- startupPolicy: \`${agent.startupPolicy}\``,
      `- spawnMode: \`${agent.spawnMode}\``,
      `- status: \`${agent.status || "planned"}\``,
      `- defaultModel: \`${agent.defaultModel || "unset"}\``,
      `- fallbackModel: \`${agent.fallbackModel || "unset"}\``,
      "",
      "## Mission",
      "",
      agent.description || `Own the ${agent.id} lane.`,
      "",
      "## Job Duties",
      "",
      ...(agent.jobDuties.length > 0 ? agent.jobDuties.map((duty) => `- ${duty}`) : ["- Work inside the assigned lane."]),
      "",
      "## Handoff Rules",
      "",
      ...agent.handoffRules.map((rule) => `- ${rule}`),
      "",
      "## Escalation",
      "",
      `- Escalate to \`${agent.escalatesTo || "cd"}\` when the task leaves the lane or needs a cross-agent decision.`,
      "",
    ].join("\n");
    fs.writeFileSync(agent.roleFile, `${content}\n`, "utf8");
  }
}

function rosterBlock(agents) {
  const lines = [
    START_MARKER,
    "## Coworker Registry",
    "",
    "These coworkers are durable staff. Do not claim you have no coworkers when this list is present.",
    "If a task clearly belongs to one of these lanes, delegate or start that lane instead of doing all the work inline.",
    "Agents can exist even when they do not currently have an active session. Dormant lanes are still valid coworkers.",
    "",
    "Canonical lane routing:",
    "- `comms`: email, inbox triage, attachments, reply drafting, Teams, iMessage",
    "- `calendar`: meetings, scheduling, reminders, prep, conflict handling",
    "- `notes`: summaries, note digestion, document extraction, durable writeups",
    "- `ops`: runtime health, services, logs, auth, tunnels, infrastructure",
    "- `research`: source gathering, learning, research packets, synthesis",
    "- `build`: coding, UI, tooling, automation, implementation work",
    "- `verifier`: review, QA, regression checks, completion validation",
    "",
    "Roster:",
  ];

  for (const agent of agents) {
    const duties = Array.isArray(agent.jobDuties) ? agent.jobDuties.slice(0, 4).join("; ") : "";
    const model = agent.defaultModel || "unset";
    const lane = agent.lane || "unknown";
    const status = agent.status || "unknown";
    lines.push(
      `- \`${agent.id}\` (${agent.name}) lane=${lane} status=${status} session=${agent.sessionLabel} model=${model}${duties ? ` duties=${duties}` : ""}`,
    );
  }

  lines.push(END_MARKER);
  return lines.join("\n");
}

function replaceOrAppendBlock(filePath, block) {
  const raw = fs.readFileSync(filePath, "utf8");
  const start = raw.indexOf(START_MARKER);
  const end = raw.indexOf(END_MARKER);
  if (start !== -1 && end !== -1 && end > start) {
    const before = raw.slice(0, start).trimEnd();
    const after = raw.slice(end + END_MARKER.length).trimStart();
    const next = `${before}\n\n${block}\n\n${after}`.trimEnd() + "\n";
    fs.writeFileSync(filePath, next, "utf8");
    return;
  }
  const next = `${raw.trimEnd()}\n\n${block}\n`;
  fs.writeFileSync(filePath, next, "utf8");
}

function main() {
  const agents = readAgentFiles().map(normalizeAgent);
  writeRegistry(agents);
  syncRoleFiles(agents);
  const block = rosterBlock(agents);
  replaceOrAppendBlock(runtimeAgentsPath, block);
  replaceOrAppendBlock(workspaceAgentsPath, block);
  process.stdout.write(`Synced coworker roster for ${agents.length} agents.\n`);
}

main();
