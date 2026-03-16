import fs from "node:fs";
import path from "node:path";
import type {
  InterAgentCommunicationAudience,
  InterAgentCommunicationStatus,
  InterAgentCommunicationType,
  InterAgentCommunicationUrgency,
} from "@/lib/types";

const ROOT_DIR = (process.env.OPENCLAW_DATA_DIR || "/Volumes/Storage/OpenClaw-Data").trim();
const COMMUNICATIONS_PATH = path.join(ROOT_DIR, "details", "communications", "command-chat-events.json");

export const INTER_AGENT_COMMUNICATION_RULES: Record<
  InterAgentCommunicationType,
  {
    label: string;
    defaultAudience: InterAgentCommunicationAudience;
    policyNote: string;
  }
> = {
  handoff: {
    label: "Handoff",
    defaultAudience: "internal_only",
    policyNote: "Internal by default. Escalate only when ownership or scope changes affect Christian's priorities.",
  },
  overlap_notice: {
    label: "Overlap Notice",
    defaultAudience: "internal_only",
    policyNote: "Internal by default. Escalate only when duplicated effort or conflicting scope needs Christian to pick a lane.",
  },
  second_opinion: {
    label: "Second Opinion",
    defaultAudience: "internal_only",
    policyNote: "Internal by default. Escalate only when the recommendation changes a Christian-facing decision.",
  },
  dependency_ping: {
    label: "Dependency Ping",
    defaultAudience: "internal_only",
    policyNote: "Internal by default. Escalate only when the dependency blocks progress or needs a Christian unblock.",
  },
  friction_note: {
    label: "Friction Note",
    defaultAudience: "internal_only",
    policyNote: "Internal-only unless the operating friction requires Christian to change direction, timing, or source of truth.",
  },
};

type DurableInterAgentCommunicationPayload = {
  version?: number;
  entries?: unknown[];
};

export type DurableInterAgentCommunicationEntry = {
  id: string;
  type: InterAgentCommunicationType;
  senderAgentId: string;
  recipientAgentIds: string[];
  taskIds: string[];
  summary: string;
  actionRequested?: string | null;
  contextNote?: string | null;
  urgency: InterAgentCommunicationUrgency;
  status: InterAgentCommunicationStatus;
  audience: InterAgentCommunicationAudience;
  escalationReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

function isCommunicationType(value: string): value is InterAgentCommunicationType {
  return value in INTER_AGENT_COMMUNICATION_RULES;
}

function isCommunicationAudience(value: string): value is InterAgentCommunicationAudience {
  return value === "internal_only" || value === "needs_christian";
}

function normalizeUrgency(value: unknown): InterAgentCommunicationUrgency {
  const normalized = String(value ?? "").trim();
  if (normalized === "low" || normalized === "high" || normalized === "needs_now") {
    return normalized;
  }
  return "normal";
}

function normalizeStatus(value: unknown): InterAgentCommunicationStatus {
  const normalized = String(value ?? "").trim();
  if (normalized === "acknowledged" || normalized === "resolved") {
    return normalized;
  }
  return "open";
}

function normalizeTimestamp(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || new Date(0).toISOString();
}

function sortByUpdatedAtDesc(
  left: { updatedAt: string; createdAt: string },
  right: { updatedAt: string; createdAt: string },
) {
  return (
    Date.parse(right.updatedAt || right.createdAt || "") - Date.parse(left.updatedAt || left.createdAt || "")
  );
}

export function getInterAgentCommunicationRule(type: InterAgentCommunicationType) {
  return INTER_AGENT_COMMUNICATION_RULES[type];
}

export function listDurableInterAgentCommunications(): DurableInterAgentCommunicationEntry[] {
  if (!fs.existsSync(COMMUNICATIONS_PATH)) {
    return [];
  }

  const payload = JSON.parse(
    fs.readFileSync(COMMUNICATIONS_PATH, "utf8"),
  ) as DurableInterAgentCommunicationPayload;
  const entries = Array.isArray(payload.entries) ? payload.entries : [];

  const normalizedEntries: Array<DurableInterAgentCommunicationEntry | null> = entries.map((entry, index) => {
      const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
      if (!record) {
        return null;
      }

      const type = String(record.type ?? "").trim();
      if (!isCommunicationType(type)) {
        return null;
      }

      const rule = getInterAgentCommunicationRule(type);
      const summary = String(record.summary ?? "").trim();
      const senderAgentId = String(record.senderAgentId ?? "").trim();
      if (!summary || !senderAgentId) {
        return null;
      }

      const audienceRaw = String(record.audience ?? "").trim();
      const audience = isCommunicationAudience(audienceRaw) ? audienceRaw : rule.defaultAudience;
      const createdAt = normalizeTimestamp(record.createdAt);
      const updatedAt = normalizeTimestamp(record.updatedAt || record.createdAt);

      const normalizedEntry: DurableInterAgentCommunicationEntry = {
        id: String(record.id ?? `${type}-${index + 1}`).trim() || `${type}-${index + 1}`,
        type,
        senderAgentId,
        recipientAgentIds: Array.isArray(record.recipientAgentIds)
          ? record.recipientAgentIds.map((value) => String(value).trim()).filter(Boolean)
          : [],
        taskIds: Array.isArray(record.taskIds)
          ? record.taskIds.map((value) => String(value).trim()).filter(Boolean)
          : [],
        summary,
        actionRequested: String(record.actionRequested ?? "").trim() || null,
        contextNote: String(record.contextNote ?? "").trim() || null,
        urgency: normalizeUrgency(record.urgency),
        status: normalizeStatus(record.status),
        audience,
        escalationReason: String(record.escalationReason ?? "").trim() || null,
        createdAt,
        updatedAt,
      };

      return normalizedEntry;
    });

  return normalizedEntries
    .filter((entry): entry is DurableInterAgentCommunicationEntry => entry !== null)
    .sort(sortByUpdatedAtDesc);
}
