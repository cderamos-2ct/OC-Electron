"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, HeartPulse, Radio, RefreshCw } from "lucide-react";
import { DashboardScreenLayout } from "@/components/DashboardScreenLayout";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import type { AgentDetail, AgentSummary } from "@/lib/types";

export function HeartbeatPageClient() {
  const { agents, getAgent, refresh, loading } = useOpenClawAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [details, setDetails] = useState<Record<string, AgentDetail>>({});

  const visibleAgents = useMemo(() => {
    return agents.filter((agent) => agent.heartbeatPath);
  }, [agents]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ids = selectedAgentId === "all" ? visibleAgents.map((agent) => agent.id) : [selectedAgentId];
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            return [id, await getAgent(id)] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setDetails((current) => {
        const next = { ...current };
        for (const entry of entries) {
          if (!entry) continue;
          next[entry[0]] = entry[1];
        }
        return next;
      });
    }

    if (visibleAgents.length) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [getAgent, selectedAgentId, visibleAgents]);

  const selectedDetails =
    selectedAgentId === "all"
      ? visibleAgents.map((agent) => details[agent.id]).filter(Boolean)
      : details[selectedAgentId]
        ? [details[selectedAgentId]]
        : [];

  return (
    <DashboardScreenLayout
      screenKey="heartbeat"
      renderers={{
        "heartbeat.board": () => (
          <section className="h-full">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  Heartbeat monitor
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Dedicated heartbeat surface for CD and specialist agents. No chat composer here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              <AgentFilterChip
                active={selectedAgentId === "all"}
                label="All agents"
                onClick={() => setSelectedAgentId("all")}
              />
              {visibleAgents.map((agent) => (
                <AgentFilterChip
                  key={agent.id}
                  active={selectedAgentId === agent.id}
                  label={agent.name || agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {selectedDetails.map((agent) => (
                <HeartbeatCard key={agent.id} agent={agent} />
              ))}
              {!selectedDetails.length ? (
                <div className="rounded-2xl border px-5 py-6 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--card)" }}>
                  No heartbeat-enabled agent details loaded yet.
                </div>
              ) : null}
            </div>
          </section>
        ),
      }}
    />
  );
}

function AgentFilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
      style={{
        borderColor: active ? "rgba(255, 122, 26, 0.26)" : "var(--border)",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        background: active ? "rgba(255, 122, 26, 0.08)" : "transparent",
      }}
    >
      {label}
    </button>
  );
}

function HeartbeatCard({ agent }: { agent: AgentDetail }) {
  const counts = agent.taskCounts ?? { queued: 0, running: 0, blocked: 0, done: 0, failed: 0, total: 0 };

  return (
    <div className="rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-xl" style={{ background: "var(--background)" }}>
            {agent.identity?.emoji || "🤖"}
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {agent.name || agent.id}
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {agent.description}
            </p>
          </div>
        </div>
        <div className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          {agent.lane}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <HeartbeatMetric icon={<Activity className="h-4 w-4" />} label="Running" value={String(counts.running)} />
        <HeartbeatMetric icon={<Radio className="h-4 w-4" />} label="Blocked" value={String(counts.blocked)} />
        <HeartbeatMetric icon={<HeartPulse className="h-4 w-4" />} label="Queued" value={String(counts.queued)} />
        <HeartbeatMetric icon={<RefreshCw className="h-4 w-4" />} label="Done" value={String(counts.done)} />
      </div>

      <div className="mt-4 space-y-3">
        <HeartbeatSection title="Heartbeat Policy" content={agent.heartbeatPath || "No heartbeat file configured."} />
        <HeartbeatFeed title="Recent Heartbeat Activity" items={agent.recentActivity} />
        <HeartbeatFeed title="Recent Proactive Messages" items={agent.recentCommunications} />
      </div>
    </div>
  );
}

function HeartbeatMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
        {icon}
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function HeartbeatSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
        {title}
      </h4>
      <div className="mt-2 rounded-xl border px-3 py-3 text-sm break-all" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--text-primary)" }}>
        {content}
      </div>
    </div>
  );
}

function HeartbeatFeed({
  title,
  items,
}: {
  title: string;
  items: AgentDetail["recentActivity"] | AgentDetail["recentCommunications"];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
        {title}
      </h4>
      <div className="mt-2 space-y-2">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
              <p className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>
                {item.title}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.15em]" style={{ color: "var(--text-secondary)" }}>
                {item.category} · {item.source}
              </p>
              {item.body ? (
                <p className="mt-2 text-sm break-words" style={{ color: "var(--text-secondary)" }}>
                  {item.body}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-xl border px-3 py-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--text-secondary)" }}>
            No recent heartbeat items.
          </div>
        )}
      </div>
    </div>
  );
}
