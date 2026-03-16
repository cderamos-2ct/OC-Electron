import fs from "node:fs";
import path from "node:path";
import type { SessionSummary } from "@/lib/types";

const DEFAULT_AGENT_SESSIONS_ROOT = path.join(
  path.sep,
  "Users",
  "cderamos",
  ".openclaw",
  "agents",
);

const AGENT_SESSIONS_ROOT =
  process.env.OPENCLAW_AGENT_SESSIONS_ROOT?.trim() || DEFAULT_AGENT_SESSIONS_ROOT;

type RawSessionEntry = {
  updatedAt?: number;
  label?: string;
  model?: string;
  lastChannel?: string;
  chatType?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  origin?: {
    label?: string;
    provider?: string;
    surface?: string;
    chatType?: string;
  };
  deliveryContext?: {
    channel?: string;
  };
};

function safeReadJson(filePath: string): Record<string, RawSessionEntry> {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, RawSessionEntry>;
  } catch {
    return {};
  }
}

function sessionStoreFiles() {
  if (!fs.existsSync(AGENT_SESSIONS_ROOT)) {
    return [];
  }

  return fs
    .readdirSync(AGENT_SESSIONS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(AGENT_SESSIONS_ROOT, entry.name, "sessions", "sessions.json"))
    .filter((filePath) => fs.existsSync(filePath));
}

function deriveAgentIdFromKey(sessionKey: string, fallbackAgentId: string) {
  const match = sessionKey.match(/^agent:([^:]+):/i);
  return match?.[1] || fallbackAgentId;
}

function deriveDisplayName(sessionKey: string, entry: RawSessionEntry) {
  if (entry.label?.trim()) {
    return entry.label.trim();
  }

  if (sessionKey.includes(":cron:")) {
    return "Cron worker";
  }

  if (sessionKey.includes(":subagent:")) {
    return "Subagent worker";
  }

  if (sessionKey.endsWith(":main")) {
    return "Main";
  }

  return sessionKey;
}

export function listDurableSessionSummaries(): SessionSummary[] {
  const sessions: SessionSummary[] = [];

  for (const filePath of sessionStoreFiles()) {
    const fallbackAgentId = path.basename(path.dirname(path.dirname(filePath)));
    const entries = safeReadJson(filePath);

    for (const [key, entry] of Object.entries(entries)) {
      const totalTokens =
        typeof entry.totalTokens === "number"
          ? entry.totalTokens
          : typeof entry.inputTokens === "number" || typeof entry.outputTokens === "number"
            ? (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0)
            : undefined;

      sessions.push({
        key,
        kind: key.includes(":cron:") ? "cron" : key.includes(":subagent:") ? "subagent" : "session",
        displayName: deriveDisplayName(key, entry),
        channel: entry.lastChannel || entry.deliveryContext?.channel || entry.origin?.surface,
        chatType: entry.chatType || entry.origin?.chatType,
        agentId: deriveAgentIdFromKey(key, fallbackAgentId),
        label: entry.label,
        model: entry.model,
        updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : undefined,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        totalTokens,
        origin: entry.origin,
      });
    }
  }

  return sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
