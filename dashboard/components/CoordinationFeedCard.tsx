"use client";

import type { InterAgentCommunication, InterAgentCommunicationSummary } from "@/lib/types";

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${Math.round(diffHours / 24)}d ago`;
}

function badgeStyles(audience: InterAgentCommunication["audience"]) {
  if (audience === "needs_christian") {
    return {
      borderColor: "rgba(251, 191, 36, 0.22)",
      background: "rgba(245, 158, 11, 0.12)",
      color: "#fbbf24",
    };
  }

  return {
    borderColor: "rgba(148, 163, 184, 0.22)",
    background: "rgba(148, 163, 184, 0.1)",
    color: "#cbd5e1",
  };
}

export function CoordinationFeedCard({
  title = "Agent Coordination",
  subtitle,
  communications,
  summary,
  maxItems = 4,
  compact = false,
  surface = "card",
  className = "",
  emptyText = "No durable coordination notes yet.",
}: {
  title?: string;
  subtitle?: string;
  communications: InterAgentCommunication[];
  summary?: InterAgentCommunicationSummary | null;
  maxItems?: number;
  compact?: boolean;
  surface?: "card" | "plain";
  className?: string;
  emptyText?: string;
}) {
  const visibleItems = communications.slice(0, maxItems);

  return (
    <section
      className={`${surface === "card" ? "rounded-2xl border p-4" : ""} ${className}`.trim()}
      style={
        surface === "card"
          ? { background: "var(--background)", borderColor: "var(--border)" }
          : undefined
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
            {subtitle
              ?? (summary
                ? `${summary.needsChristian} escalated to Needs Christian · ${summary.internalOnly} internal-only`
                : "Structured handoffs, overlap calls, dependency pings, and friction notes.")}
          </p>
        </div>
        {summary?.byType?.length ? (
          <div className="flex flex-wrap justify-end gap-2">
            {summary.byType.slice(0, compact ? 2 : 3).map((item) => (
              <span
                key={item.type}
                className="rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {item.label} {item.total}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`mt-4 ${compact ? "space-y-3" : "space-y-4"}`}>
        {visibleItems.map((item) => {
          const recipients = item.recipientDisplayNames.length
            ? item.recipientDisplayNames.join(", ")
            : "No direct recipient";
          return (
            <article
              key={item.id}
              className="rounded-xl border px-3 py-3"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em]"
                  style={{ borderColor: "rgba(96, 165, 250, 0.22)", color: "#93c5fd" }}
                >
                  {item.typeLabel}
                </span>
                <span
                  className="rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em]"
                  style={badgeStyles(item.audience)}
                  title={item.policyNote}
                >
                  {item.audienceLabel}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {formatRelativeTime(item.updatedAt)}
                </span>
              </div>

              <div className="mt-3 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                {item.senderDisplayName} → {recipients}
              </div>

              <div className="mt-2 text-sm leading-6" style={{ color: "var(--text-primary)" }}>
                {item.summary}
              </div>

              {item.actionRequested ? (
                <div className="mt-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                  Action requested: {item.actionRequested}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {item.taskRefs.map((task) => (
                  <span
                    key={`${item.id}:${task.id}`}
                    className="rounded-full border px-2.5 py-1 text-[11px]"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    title={task.title ?? undefined}
                  >
                    {task.id}
                  </span>
                ))}
                <span
                  className="rounded-full border px-2.5 py-1 text-[11px]"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {item.status.replace("_", " ")}
                </span>
              </div>

              <div className="mt-3 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                {item.audience === "needs_christian" && item.escalationReason
                  ? item.escalationReason
                  : item.contextNote || item.policyNote}
              </div>
            </article>
          );
        })}

        {!visibleItems.length ? (
          <div
            className="rounded-xl border border-dashed px-4 py-6 text-center text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            {emptyText}
          </div>
        ) : null}
      </div>
    </section>
  );
}
