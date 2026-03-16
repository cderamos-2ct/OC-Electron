import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

const execFileAsync = promisify(execFile);

const DEFAULT_TARGET_SESSION = "agent:main:dashboard-chat";
const OPENCLAW_DATA_DIR = process.env.OPENCLAW_DATA_DIR || "/Volumes/Storage/OpenClaw-Data";
const STATE_FILE = path.join(OPENCLAW_DATA_DIR, "runtime", "loopback-bridge-state.json");
const TARGETS_FILE = path.join(OPENCLAW_DATA_DIR, "runtime", "update-targets.json");
const MAX_DELIVERED_ENTRIES = 500;
const HEARTBEAT_OK = "HEARTBEAT_OK";

type BridgeState = {
  delivered: Record<string, { at: string; targetSessionKey: string; digest: string }>;
};

type TranscriptPart =
  | string
  | {
      type?: string;
      text?: string;
      thinking?: string;
      content?: TranscriptPart[] | string;
    };

type TranscriptMessage = {
  role?: string;
  content?: TranscriptPart[] | string;
};

function normalizeSessionKey(raw?: string): string {
  const value = raw?.trim();
  return value || DEFAULT_TARGET_SESSION;
}

function summarizeError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function extractTextFromPart(part: TranscriptPart): string {
  if (typeof part === "string") {
    return part;
  }

  if (Array.isArray(part.content)) {
    return part.content.map(extractTextFromPart).join("\n").trim();
  }

  if (typeof part.content === "string" && part.content.trim()) {
    return part.content.trim();
  }

  if (typeof part.text === "string" && part.text.trim()) {
    return part.text.trim();
  }

  return "";
}

function extractLastAssistantText(messages: unknown[]): string {
  const normalized = Array.isArray(messages) ? (messages as TranscriptMessage[]) : [];
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const message = normalized[index];
    if (String(message?.role ?? "").toLowerCase() !== "assistant") {
      continue;
    }

    const content = message?.content;
    if (Array.isArray(content)) {
      const text = content
        .map(extractTextFromPart)
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (text) {
        return text;
      }
      continue;
    }

    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }
  }
  return "";
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function loadBridgeState(api: OpenClawPluginApi): Promise<{ statePath: string; state: BridgeState }> {
  const statePath = STATE_FILE;
  const state = await readJsonFile<BridgeState>(statePath, { delivered: {} });
  if (!state.delivered || typeof state.delivered !== "object") {
    state.delivered = {};
  }
  return { statePath, state };
}

async function saveBridgeState(statePath: string, state: BridgeState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function resolvePreferredTargetSession(api: OpenClawPluginApi): Promise<string> {
  const targetsPath = TARGETS_FILE;
  const targets = await readJsonFile<{ preferred?: { sessionKey?: string } }>(targetsPath, {});
  return normalizeSessionKey(targets.preferred?.sessionKey);
}

async function injectAssistantNote(params: {
  api: OpenClawPluginApi;
  sessionKey: string;
  message: string;
  timeoutMs?: number;
}): Promise<void> {
  const cli = process.env.OPENCLAW_LOOPBACK_CLI || "openclaw";
  const args = [
    "gateway",
    "call",
    "chat.inject",
    "--json",
    "--timeout",
    String(params.timeoutMs ?? 15000),
    "--params",
    JSON.stringify({
      sessionKey: params.sessionKey,
      message: params.message,
      label: "__loopback_subagent_completion__",
    }),
  ];

  await execFileAsync(cli, args, {
    cwd: params.api.resolvePath("."),
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
}

function buildFailureText(sessionKey: string, error: string): string {
  return [
    "Autonomous job failed.",
    `Session: ${sessionKey}`,
    `Error: ${error}`,
  ].join("\n");
}

function digestForDelivery(runId: string, text: string): string {
  return createHash("sha256").update(`${runId}\n${text}`).digest("hex");
}

function extractSectionBullets(text: string, heading: string): string[] {
  const pattern = new RegExp(`(?:^|\\n)${heading}\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z\\s]+\\n|$)`, "i");
  const match = text.match(pattern);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || line.startsWith("•"))
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function isNoopBullet(line: string): boolean {
  const normalized = line.toLowerCase();
  return (
    normalized === "none" ||
    normalized.startsWith("none") ||
    normalized.startsWith("no new") ||
    normalized.startsWith("nothing immediate") ||
    normalized.startsWith("no immediate")
  );
}

function summarizeForLoopback(rawText: string): string {
  const text = rawText.trim();
  if (!text || text === HEARTBEAT_OK) {
    return "";
  }

  const moved = extractSectionBullets(text, "MOVED").filter((line) => !isNoopBullet(line));
  const needsChristian = extractSectionBullets(text, "NEEDS CHRISTIAN").filter((line) => !isNoopBullet(line));
  const stalled = extractSectionBullets(text, "STALLED").filter((line) => !isNoopBullet(line));

  if (!moved.length && !needsChristian.length) {
    return "";
  }

  if (moved.length) {
    const lines = ["[action_taken]", ...moved.slice(0, 2).map((line) => `- ${line}`)];
    if (needsChristian.length) {
      lines.push("", "Needs Christian:", ...needsChristian.slice(0, 1).map((line) => `- ${line}`));
    } else if (stalled.length) {
      lines.push("", "Watch:", ...stalled.slice(0, 1).map((line) => `- ${line}`));
    }
    return lines.join("\n").trim();
  }

  return ["[decision_needed]", ...needsChristian.slice(0, 2).map((line) => `- ${line}`)].join("\n").trim();
}

function pruneState(state: BridgeState): void {
  const entries = Object.entries(state.delivered).sort((a, b) =>
    String(a[1].at).localeCompare(String(b[1].at)),
  );
  if (entries.length <= MAX_DELIVERED_ENTRIES) {
    return;
  }
  const keep = entries.slice(entries.length - MAX_DELIVERED_ENTRIES);
  state.delivered = Object.fromEntries(keep);
}

export function registerAutonomyLoopback(api: OpenClawPluginApi) {
  const assistantTextByRun = new Map<string, string>();

  api.runtime.events.onAgentEvent(async (evt) => {
    const sourceSessionKey = evt.sessionKey?.trim();
    if (!sourceSessionKey || !sourceSessionKey.includes(":cron:")) {
      return;
    }

    if (evt.stream === "assistant") {
      const text = typeof evt.data?.text === "string" ? evt.data.text.trim() : "";
      if (text) {
        assistantTextByRun.set(evt.runId, text);
      }
      return;
    }

    if (evt.stream !== "lifecycle") {
      return;
    }

    const phase = typeof evt.data?.phase === "string" ? evt.data.phase : "";
    if (phase !== "end" && phase !== "error") {
      return;
    }

    const { statePath, state } = await loadBridgeState(api);
    const latestAssistant = assistantTextByRun.get(evt.runId)?.trim() || "";
    const finalText =
      phase === "error"
        ? buildFailureText(
            sourceSessionKey,
            typeof evt.data?.error === "string" ? evt.data.error.trim() || "unknown error" : "unknown error",
          )
        : latestAssistant;

    assistantTextByRun.delete(evt.runId);

    const summaryText = summarizeForLoopback(finalText);

    if (!summaryText) {
      return;
    }

    const targetSessionKey = await resolvePreferredTargetSession(api);
    const digest = digestForDelivery(evt.runId, summaryText);
    const delivered = state.delivered[evt.runId];
    if (delivered?.digest === digest && delivered.targetSessionKey === targetSessionKey) {
      return;
    }

    try {
      await injectAssistantNote({
        api,
        sessionKey: targetSessionKey,
        message: summaryText,
      });
      state.delivered[evt.runId] = {
        at: new Date().toISOString(),
        targetSessionKey,
        digest,
      };
      pruneState(state);
      await saveBridgeState(statePath, state);
      api.logger.info?.(
        `autonomy-loopback: injected cron result from ${sourceSessionKey} into ${targetSessionKey}`,
      );
    } catch (err) {
      api.logger.warn?.(
        `autonomy-loopback: inject failed for ${sourceSessionKey}: ${summarizeError(err)}`,
      );
    }
  });
}
