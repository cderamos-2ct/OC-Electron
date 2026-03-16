"use client";

import { ExternalLink, Radio, Workflow } from "lucide-react";
import type { AgentRosterCard } from "@/lib/types";

function formatTime(value?: string | null) {
  if (!value) return "No recent update";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return value;
  const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMinutes < 1) return "Updated just now";
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

function toneForRuntime(runtimeState?: string | null) {
  if (runtimeState === "healthy") return "#34d399";
  if (runtimeState === "busy") return "#93c5fd";
  if (runtimeState === "missing" || runtimeState === "orphaned" || runtimeState === "drifted" || runtimeState === "blocked") return "#fb923c";
  return "var(--text-secondary)";
}

export function AgentRosterCardView({
  card,
  onOpenAgent,
  onOpenSession,
  className,
}: {
  card: AgentRosterCard;
  onOpenAgent?: (agentId: string) => void;
  onOpenSession?: (sessionKey: string) => void;
  className?: string;
}) {
  const primarySession = card.linkedSessions[0];
  const currentTask = card.currentTasks[0];
  const recentCompleted = card.recentCompleted[0];

  return (
    <div className={className ?? "rounded-2xl border px-3 py-3"} style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-5" style={{ color: "var(--text-primary)" }}>
            {card.emoji || "🤖"} {card.displayName}
          </div>
          <div className="mt-1 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
            {[card.lane, card.persona].filter(Boolean).join(" · ") || "Unassigned lane"}
          </div>
        </div>
        <div className="text-[11px] text-right" style={{ color: toneForRuntime(card.runtimeState) }}>
          <div>{card.runtimeState || card.status || "unknown"}</div>
          <div style={{ color: card.blockedCount ? "#fb923c" : "var(--text-secondary)" }}>
            {card.blockedCount ? `${card.blockedCount} blocked` : `${card.pendingCount} pending`}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        <div className="rounded-lg border px-2 py-1" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5"><Workflow className="h-3 w-3" />{card.currentTasks.length} current</div>
        </div>
        <div className="rounded-lg border px-2 py-1" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5"><Radio className="h-3 w-3" />{card.linkedSessions.length} session{card.linkedSessions.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="mt-2 line-clamp-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
        {currentTask ? (
          <>Now: <span style={{ color: "var(--text-primary)" }}>{currentTask.id}</span> · {currentTask.title}</>
        ) : recentCompleted ? (
          <>Recent: <span style={{ color: "var(--text-primary)" }}>{recentCompleted.id}</span> · {recentCompleted.title}</>
        ) : (
          "No current task attached."
        )}
      </div>

      {card.signatureTone ? (
        <div className="mt-1 line-clamp-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {card.signatureTone}
        </div>
      ) : null}

      <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {formatTime(card.lastMeaningfulUpdate)}
      </div>

      {(onOpenAgent || (primarySession && onOpenSession)) ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {onOpenAgent ? (
            <button type="button" onClick={() => onOpenAgent(card.id)} className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <span className="inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />Open agent</span>
            </button>
          ) : null}
          {primarySession && onOpenSession ? (
            <button type="button" onClick={() => onOpenSession(primarySession.key)} className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              Open session
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
