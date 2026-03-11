#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = "/Volumes/Storage/OpenClaw/.antigravity";
const itemsDir = path.join(rootDir, "tasks", "items");

function inferOwner(task) {
  const haystack = [
    task.title,
    task.source,
    ...(task.tags ?? []),
  ].join(" ").toLowerCase();

  if (/(email|gmail|teams|imessage|message|telegram|reply|contact|communication)/.test(haystack)) return "comms";
  if (/(calendar|meeting|schedule|reminder|brief)/.test(haystack)) return "calendar";
  if (/(notes|memo|document|docs|meeting-note|fireflies|digest)/.test(haystack)) return "notes";
  if (/(research|learning|notebooklm|cto|source|pomodoro)/.test(haystack)) return "research";
  if (/(dashboard|runtime|gateway|cloudflare|tunnel|device auth|service|launchctl|ops)/.test(haystack)) return "ops";
  if (/(build|typescript|ui|api|implementation|code|fix)/.test(haystack)) return "build";
  if (/(verify|verification|review|quality|regression|test)/.test(haystack)) return "verifier";
  return "cd";
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error("Missing frontmatter");
  const data = {};
  let activeArrayKey = null;
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("- ") && activeArrayKey) {
      data[activeArrayKey].push(line.slice(2).replace(/^"|"$/g, ""));
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
    data[key] = rawValue.replace(/^"|"$/g, "");
  }
  return { data, body: content.slice(match[0].length) };
}

function listBlock(name, values) {
  if (!values?.length) return `${name}:\n`;
  return `${name}:\n${values.map((value) => `- ${JSON.stringify(value)}`).join("\n")}\n`;
}

function renderTask(task, body) {
  return (
    `---\n` +
    `id: ${JSON.stringify(task.id)}\n` +
    `title: ${JSON.stringify(task.title)}\n` +
    `status: ${JSON.stringify(task.status)}\n` +
    `priority: ${JSON.stringify(task.priority)}\n` +
    `owner_agent: ${JSON.stringify(task.owner_agent)}\n` +
    `agent_type: ${JSON.stringify(task.agent_type)}\n` +
    `created_at: ${JSON.stringify(task.created_at)}\n` +
    `updated_at: ${JSON.stringify(task.updated_at)}\n` +
    `source: ${JSON.stringify(task.source)}\n` +
    listBlock("depends_on", task.depends_on) +
    listBlock("blocked_by", task.blocked_by) +
    listBlock("tags", task.tags) +
    listBlock("artifacts", task.artifacts) +
    `---\n` +
    body
  );
}

const files = fs.readdirSync(itemsDir).filter((name) => name.endsWith(".md")).sort();
let changed = 0;

for (const fileName of files) {
  const filePath = path.join(itemsDir, fileName);
  const content = fs.readFileSync(filePath, "utf8");
  const { data, body } = parseFrontmatter(content);
  if (String(data.owner_agent || "") !== "cd") continue;
  const nextOwner = inferOwner({
    title: String(data.title || fileName),
    source: String(data.source || ""),
    tags: Array.isArray(data.tags) ? data.tags : [],
  });
  if (nextOwner === "cd") continue;
  data.owner_agent = nextOwner;
  if (String(data.agent_type || "orchestrator") === "orchestrator") {
    data.agent_type = nextOwner;
  }
  fs.writeFileSync(filePath, renderTask(data, body));
  changed += 1;
}

console.log(`Routed ${changed} task files.`);
