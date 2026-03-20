#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Universal Linear Agent Router — multi-project, multi-model dispatcher
//
// Routes Linear webhooks to the right AI CLI (Claude / Codex / Gemini / …)
// for any project on this machine based on config.json.
//
// Usage:
//   node index.mjs                          # uses config.json
//   PORT=8080 node index.mjs               # override port
//   CONFIG=./my-config.json node index.mjs # custom config file
//
// Expose via: cloudflared tunnel --url http://localhost:9786
//             ngrok http 9786
// ─────────────────────────────────────────────────────────────────────────────

import { createServer } from "http";
import { spawn } from "child_process";
import { createHmac } from "crypto";
import { appendFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load .env (zero-dependency) ─────────────────────────────────────────────

const envPath = join(__dirname, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

// ─── Load config ─────────────────────────────────────────────────────────────

function loadConfig() {
  const configPath = process.env.CONFIG ?? join(__dirname, "config.json");
  const localPath = configPath.replace(/\.json$/, ".local.json");

  let cfg = JSON.parse(readFileSync(configPath, "utf-8"));

  // Merge local overrides (config.local.json) if present — useful for secrets
  if (existsSync(localPath)) {
    const local = JSON.parse(readFileSync(localPath, "utf-8"));
    cfg = deepMerge(cfg, local);
  }

  return cfg;
}

function deepMerge(base, override) {
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof base[k] === "object") {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const config = loadConfig();

const PORT     = parseInt(process.env.PORT ?? config.port ?? "9786", 10);
const MAX_PER_LANE = config.maxPerLane ?? 2;
const AI_LANES    = config.aiLanes ?? {};
const PROJECTS    = config.projects ?? {};
const PROMPTS     = config.prompts ?? {};

const LOG_DIR = join(__dirname, "logs");
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

// ─── Active sessions ──────────────────────────────────────────────────────────

const active = new Map(); // issueId → { lane, pid, startedAt, projectKey }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  appendFileSync(join(LOG_DIR, "router.log"), line + "\n");
}

function verifySignature(body, sig, secret) {
  if (!secret) return true;
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected === sig;
}

function laneCount(lane) {
  let n = 0;
  for (const s of active.values()) if (s.lane === lane) n++;
  return n;
}

/** Extract project key from issue identifier: "VIS-51" → "VIS" */
function projectKey(issueId) {
  const m = issueId.match(/^([A-Z][A-Z0-9]*)-\d+$/);
  return m ? m[1] : null;
}

/** Resolve a named priority value to a human-readable string */
function priorityLabel(priority) {
  if (priority === 1) return "URGENT";
  if (priority === 2) return "HIGH";
  if (priority === 3) return "MEDIUM";
  return "LOW";
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(actionType, vars) {
  const template = PROMPTS[actionType] ?? [];
  return template
    .map((line) =>
      line.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
    )
    .join("\n");
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

function dispatch(lane, actionType, issueId, title, url, priority, project) {
  if (active.has(issueId)) {
    log(`⏭️  ${issueId} already active — skip`);
    return;
  }
  if (laneCount(lane) >= MAX_PER_LANE) {
    log(`⏸️  ${lane} at max concurrency (${MAX_PER_LANE}) — deferring ${issueId}`);
    return;
  }

  const laneCfg = AI_LANES[lane];
  if (!laneCfg?.cmd) {
    log(`❌ No CLI configured for lane "${lane}"`);
    return;
  }

  const vars = {
    id:           issueId,
    id_lower:     issueId.toLowerCase(),
    title,
    url,
    priority:     priorityLabel(priority),
    repo:         project.repo ?? __dirname,
    branchPrefix: project.branchPrefix ?? "crd",
    projectName:  project.name ?? issueId.split("-")[0],
  };

  const prompt = buildPrompt(actionType, vars);

  // Substitute {prompt} placeholder in args list
  const args = (laneCfg.args ?? ["{prompt}"]).map((a) =>
    a === "{prompt}" ? prompt : a
  );

  log(`🚀 [${project.name ?? issueId}] ${lane} → ${actionType} → ${issueId}: ${title}`);

  const child = spawn(laneCfg.cmd, args, {
    cwd: project.repo ?? __dirname,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  active.set(issueId, { lane, pid: child.pid, startedAt: Date.now(), projectKey: projectKey(issueId) });

  const logFile = join(LOG_DIR, `${issueId.toLowerCase()}-${Date.now()}.log`);
  child.stdout?.on("data", (d) => appendFileSync(logFile, d));
  child.stderr?.on("data", (d) => appendFileSync(logFile, d));

  child.on("exit", (code) => {
    const session = active.get(issueId);
    const sec = session ? ((Date.now() - session.startedAt) / 1000).toFixed(0) : "?";
    active.delete(issueId);
    log(
      code === 0
        ? `✅ ${lane}:${issueId} done (${sec}s)`
        : `❌ ${lane}:${issueId} exit=${code} (${sec}s)`
    );
  });

  child.on("error", (err) => {
    active.delete(issueId);
    log(`💥 Spawn failed ${lane}:${issueId}: ${err.message}`);
  });
}

// ─── Route webhook payload ────────────────────────────────────────────────────

function route(payload) {
  const { action, type, data } = payload;
  if (type !== "Issue" || (action !== "create" && action !== "update")) return;

  const labels = (data?.labels ?? []).map((l) => l.name);
  const lane   = labels.find((l) => AI_LANES[l]);
  if (!lane) return; // no AI-lane label

  const state    = data?.state?.name ?? "";
  const issueId  = data?.identifier ?? "";
  const title    = data?.title ?? "";
  const url      = data?.url ?? "";
  const priority = data?.priority ?? 0;

  const key     = projectKey(issueId);
  const project = PROJECTS[key];

  if (!project) {
    log(`⚠️  No project config for key "${key}" (${issueId}) — skipping`);
    return;
  }

  if (state === "Todo") {
    dispatch(lane, "implement", issueId, title, url, priority, project);
  } else if (state === "In Review") {
    dispatch(lane, "review", issueId, title, url, priority, project);
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    const sessions = [];
    for (const [id, s] of active) {
      sessions.push({ id, lane: s.lane, pid: s.pid, projectKey: s.projectKey });
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, active: sessions, projects: Object.keys(PROJECTS), lanes: Object.keys(AI_LANES) }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  // Read body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  // Determine which project's secret to use for signature verification.
  // We try to parse just enough of the body to get the issue identifier,
  // then look up the project's webhookSecret. Falls back to a global secret
  // (LINEAR_WEBHOOK_SECRET env) if the project has none configured.
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  const issueId   = payload?.data?.identifier ?? "";
  const key       = projectKey(issueId);
  const project   = PROJECTS[key];
  const secret    = project?.webhookSecret || process.env.LINEAR_WEBHOOK_SECRET || "";
  const sig       = req.headers["linear-signature"];

  if (!verifySignature(body, sig, secret)) {
    log(`🔒 Invalid signature for ${issueId || "unknown"} — rejected`);
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }

  route(payload);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true }));
});

// ─── Startup banner ───────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const projectList = Object.entries(PROJECTS)
    .map(([k, p]) => `${k} → ${p.repo}`)
    .join(", ") || "(none)";
  const laneList = Object.keys(AI_LANES).join(", ") || "(none)";

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  Universal Linear Agent Router                      ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Webhook:  http://localhost:${String(PORT).padEnd(24)}║`);
  console.log(`║  Health:   http://localhost:${PORT}/health${" ".repeat(16 - String(PORT).length)}║`);
  console.log(`║  Lanes:    ${laneList.slice(0, 42).padEnd(42)}║`);
  console.log(`║  Projects: ${projectList.slice(0, 42).padEnd(42)}║`);
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
  log("Listening for Linear webhooks...");
});
