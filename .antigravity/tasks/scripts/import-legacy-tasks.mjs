#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = "/Volumes/Storage/OpenClaw/.antigravity";
const tasksDir = path.join(rootDir, "tasks");
const itemsDir = path.join(tasksDir, "items");
const legacyBoardPath = path.join(rootDir, "TASKS.md");
const runtimeBoardPath = "/Users/cderamos/.openclaw/workspace/TASKS.md";
const legacyJsonPath = path.join(tasksDir, "tasks.json");
const syncScriptPath = path.join(tasksDir, "scripts", "sync-task-board.mjs");

function quote(value) {
  return JSON.stringify(String(value));
}

function renderTaskFile(task) {
  const listSection = (items) => {
    if (!items || items.length === 0) return "";
    return `\n${items.map((item) => `- ${quote(item)}`).join("\n")}`;
  };

  return `---\n` +
    `id: ${quote(task.id)}\n` +
    `title: ${quote(task.title)}\n` +
    `status: ${quote(task.status)}\n` +
    `priority: ${quote(task.priority)}\n` +
    `owner_agent: ${quote(task.owner_agent)}\n` +
    `agent_type: ${quote(task.agent_type)}\n` +
    `created_at: ${quote(task.created_at)}\n` +
    `updated_at: ${quote(task.updated_at)}\n` +
    `source: ${quote(task.source)}\n` +
    `depends_on:${listSection(task.depends_on)}\n` +
    `blocked_by:${listSection(task.blocked_by)}\n` +
    `tags:${listSection(task.tags)}\n` +
    `artifacts:${listSection(task.artifacts)}\n` +
    `---\n\n` +
    `## Summary\n\n${task.summary}\n\n` +
    `## Current State\n\n- State: ${task.current_state}\n- Next action: ${task.next_action}\n\n` +
    `## Acceptance\n\n- [ ] Define acceptance for ${task.id}\n\n` +
    `## Activity Log\n\n- ${task.updated_at} ${task.owner_agent}: Imported from ${task.source}.\n\n` +
    `## Notes\n\n${task.notes}\n`;
}

function slugId(prefix, title, counter) {
  const cleanPrefix = prefix.toUpperCase();
  return `${cleanPrefix}-${String(counter).padStart(3, "0")}`;
}

function existingTasksByTitle() {
  const map = new Map();
  for (const fileName of fs.readdirSync(itemsDir).filter((name) => name.endsWith(".md"))) {
    const content = fs.readFileSync(path.join(itemsDir, fileName), "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) continue;
    const titleLine = match[1]
      .split("\n")
      .find((line) => line.startsWith("title:"));
    if (!titleLine) continue;
    const title = JSON.parse(titleLine.slice("title:".length).trim());
    const idLine = match[1]
      .split("\n")
      .find((line) => line.startsWith("id:"));
    const id = idLine ? JSON.parse(idLine.slice("id:".length).trim()) : fileName.replace(/\.md$/, "");
    map.set(title, id);
  }
  return map;
}

function nextCounterForPrefix(prefix) {
  const fileNames = fs.readdirSync(itemsDir).filter((name) => name.startsWith(`${prefix}-`));
  if (fileNames.length === 0) return 1;
  return (
    Math.max(
      ...fileNames.map((name) => Number.parseInt(name.replace(`${prefix}-`, "").replace(/\.md$/, ""), 10) || 0),
    ) + 1
  );
}

function writeTaskIfMissing(task) {
  const filePath = path.join(itemsDir, `${task.id}.md`);
  if (fs.existsSync(filePath)) {
    return;
  }
  fs.writeFileSync(filePath, renderTaskFile(task));
}

function importLegacyJson(existingByTitle) {
  if (!fs.existsSync(legacyJsonPath)) {
    return;
  }
  const parsed = JSON.parse(fs.readFileSync(legacyJsonPath, "utf8"));
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  for (const task of tasks) {
    const title = task.title || task.summary || task.id;
    if (existingByTitle.has(title)) continue;
    const next = {
      id: task.id,
      title,
      status:
        task.status === "completed"
          ? "done"
          : task.status === "in_progress"
            ? "in_progress"
            : task.status || "queued",
      priority: "medium",
      owner_agent: task.ownerRole || "unassigned",
      agent_type: task.ownerRole || "orchestrator",
      created_at: task.createdAt || new Date().toISOString(),
      updated_at: task.updatedAt || task.createdAt || new Date().toISOString(),
      source: "legacy-tasks-json",
      depends_on: Array.isArray(task.blockedBy) ? task.blockedBy : [],
      blocked_by: Array.isArray(task.blockedBy) ? task.blockedBy : [],
      tags: ["legacy-import", "json-ledger"],
      artifacts: [],
      summary: task.summary || title,
      current_state: task.result || task.summary || "Imported from legacy JSON ledger.",
      next_action: "Review and refine this task file if it is still relevant.",
      notes: (task.notes || []).join("\n"),
    };
    writeTaskIfMissing(next);
    existingByTitle.set(title, task.id);
  }
}

function parseTaskBoard(boardPath, sourceLabel) {
  if (!fs.existsSync(boardPath)) {
    return [];
  }
  const lines = fs.readFileSync(boardPath, "utf8").split("\n");
  const imported = [];
  let section = "";

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    const taskMatch = line.match(/^- \[([ x])\] (.+)$/);
    if (!taskMatch) continue;
    const checked = taskMatch[1].toLowerCase() === "x";
    const title = taskMatch[2].trim();
    imported.push({ section, title, checked, sourceLabel });
  }

  return imported;
}

function statusForSection(section, checked) {
  if (checked) return "done";
  switch (section) {
    case "Running":
      return "in_progress";
    case "Queued":
      return "queued";
    case "Blocked":
      return "blocked";
    case "Done (condensed)":
      return "done";
    default:
      return "queued";
  }
}

function prefixForSection(section) {
  switch (section) {
    case "Running":
      return "RUN";
    case "Queued":
      return "QUE";
    case "Blocked":
      return "BLK";
    case "Done (condensed)":
      return "DON";
    default:
      return "TSK";
  }
}

function importBoardTasks(existingByTitle, boardPath, sourceLabel) {
  const imported = parseTaskBoard(boardPath, sourceLabel);
  const counters = new Map();

  for (const item of imported) {
    if (existingByTitle.has(item.title)) {
      continue;
    }

    const prefix = prefixForSection(item.section);
    if (!counters.has(prefix)) {
      counters.set(prefix, nextCounterForPrefix(prefix));
    }
    const id = slugId(prefix, item.title, counters.get(prefix));
    counters.set(prefix, counters.get(prefix) + 1);

    const status = statusForSection(item.section, item.checked);
    const next = {
      id,
      title: item.title,
      status,
      priority: item.section === "Blocked" ? "high" : "medium",
      owner_agent: "cd",
      agent_type: "orchestrator",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      source: `${sourceLabel}:${item.section}`,
      depends_on: [],
      blocked_by: status === "blocked" ? ["unknown"] : [],
      tags: ["legacy-import", "task-board"],
      artifacts: [],
      summary: item.title,
      current_state: `Imported from legacy TASKS.md section "${item.section}".`,
      next_action: "Confirm whether this task is still relevant and assign it to an agent if active.",
      notes: "Legacy task board import.",
    };
    writeTaskIfMissing(next);
    existingByTitle.set(item.title, id);
  }
}

const byTitle = existingTasksByTitle();
importLegacyJson(byTitle);
importBoardTasks(byTitle, runtimeBoardPath, "runtime-board");

const result = spawnSync("node", [syncScriptPath], { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Legacy task import complete.");
