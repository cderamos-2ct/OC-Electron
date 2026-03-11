"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Radio, Workflow } from "lucide-react";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import type { AgentDetail, AgentOwnedTask } from "@/lib/types";

export function AgentDetailPageClient({ agentId }: { agentId: string }) {
  const { getAgent, refinePacket } = useOpenClawAgents();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refining, setRefining] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void getAgent(agentId)
      .then((detail) => {
        if (!alive) return;
        setAgent(detail);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load agent");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [agentId, getAgent]);

  if (loading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--text-secondary)" }} />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="p-6">
        <Link
          href="/agents"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to agents
        </Link>
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border)", color: "#fca5a5" }}>
          {error || "Agent not found."}
        </div>
      </div>
    );
  }

  const counts = agent.taskCounts ?? { queued: 0, running: 0, blocked: 0, done: 0, failed: 0, total: 0 };

  const handleRefinePacket = async () => {
    setRefining(true);
    setError(null);
    try {
      const detail = await refinePacket(agentId);
      setAgent(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refine packet");
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="min-w-0 rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <Link
          href="/agents"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to agents
        </Link>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{ background: "var(--background)" }}
            >
              {agent.identity?.emoji || "🤖"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {agent.name || agent.id}
                </h1>
                {agent.default ? (
                  <span className="rounded-full border px-2 py-1 text-xs" style={{ borderColor: "rgba(250, 204, 21, 0.3)", color: "#facc15" }}>
                    default
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {agent.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge icon={<Workflow className="h-3 w-3" />} label={agent.lane || "unassigned"} />
                <Badge icon={<Radio className="h-3 w-3" />} label={agent.status || "planned"} tone={agent.status === "active" ? "green" : "slate"} />
                {agent.runtimeAgentId ? <Badge label={`runtime:${agent.runtimeAgentId}`} /> : null}
                {agent.escalatesTo ? <Badge label={`escalates:${agent.escalatesTo}`} /> : null}
              </div>
            </div>
          </div>

          <div className="grid w-full shrink-0 grid-cols-2 gap-2 md:w-[320px]">
            <Metric label="Running" value={String(counts.running)} />
            <Metric label="Blocked" value={String(counts.blocked)} />
            <Metric label="Queued" value={String(counts.queued)} />
            <Metric label="Done" value={String(counts.done)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => void handleRefinePacket()}
            disabled={refining}
            className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            {refining ? "Refreshing packet..." : "Refine Packet"}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="min-w-0 overflow-hidden rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Responsibilities
          </h2>
          <ListBlock items={agent.responsibilities} empty="No responsibilities listed." />

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Monitored Surfaces
          </h2>
          <TagBlock items={agent.monitorSurfaces} empty="No monitored surfaces configured." />

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Communication Lanes
          </h2>
          <TagBlock items={agent.communicationChannels} empty="No communication lanes configured." />

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Tools
          </h2>
          <TagBlock items={agent.tools} empty="No tools configured." />

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Memory Paths
          </h2>
          <div className="mt-3 space-y-2">
            {(agent.memoryPaths ?? []).map((memoryPath) => (
              <div
                key={memoryPath}
                className="rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {memoryPath}
              </div>
            ))}
            {!agent.memoryPaths?.length ? (
              <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                No memory paths configured.
              </p>
            ) : null}
          </div>

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Identity Files
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <ProfilePathCard label="Soul" path={agent.soulPath} />
            <ProfilePathCard label="Memory" path={agent.memoryPath} />
            <ProfilePathCard label="Heartbeat" path={agent.heartbeatPath} />
            <ProfilePathCard label="Directives" path={agent.directivesPath} />
            <ProfilePathCard label="Inbox" path={agent.inboxPath} />
            <ProfilePathCard label="Outbox" path={agent.outboxPath} />
            <ProfilePathCard label="Artifacts" path={agent.artifactsDir} />
          </div>

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Execution Settings
          </h2>
          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Runtime Health
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <ProfilePathCard label="Observed State" path={agent.runtime?.observedState} />
            <ProfilePathCard label="Desired Status" path={agent.runtime?.desiredStatus} />
            <ProfilePathCard label="Session Key" path={agent.runtime?.sessionKey} />
            <ProfilePathCard label="Session Id" path={agent.runtime?.sessionId} />
            <ProfilePathCard label="Runtime Model" path={agent.runtime?.model} />
            <ProfilePathCard label="Last Seen" path={agent.runtime?.lastSeenAt} />
            <ProfilePathCard label="Current Task" path={agent.runtime?.currentTaskId} />
            <ProfilePathCard label="Last Error" path={agent.runtime?.lastError} />
          </div>

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Execution Settings
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <ProfilePathCard label="Provider" path={agent.modelProvider} />
            <ProfilePathCard label="Default Model" path={agent.defaultModel} />
            <ProfilePathCard label="Fallback Model" path={agent.fallbackModel} />
            <ProfilePathCard label="Auth Profile" path={agent.authProfile} />
            <ProfilePathCard label="Reasoning" path={agent.reasoningLevel} />
          </div>

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Subagent Policy
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <ProfilePathCard label="Subagents" path={agent.canSpawnSubagents ? "enabled" : "disabled"} />
            <ProfilePathCard label="Subagent Model" path={agent.subagentModel} />
            <ProfilePathCard label="Max Depth" path={agent.subagentMaxDepth == null ? null : String(agent.subagentMaxDepth)} />
          </div>
          <TagBlock items={agent.subagentUseCases} empty="No subagent use cases configured." />
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Recent Communications
          </h2>
          <FeedList items={agent.recentCommunications} empty="No recent communications mapped yet." />

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Recent Activity
          </h2>
          <FeedList items={agent.recentActivity} empty="No recent activity mapped yet." />

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Owned Tasks
          </h2>
          <TaskList tasks={agent.ownedTasks} empty="No owned tasks yet." />

          <h2 className="mt-6 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Related Tasks
          </h2>
          <TaskList tasks={agent.relatedTasks} empty="No related tasks yet." />
        </section>
      </div>
    </div>
  );
}

function ProfilePathCard({ label, path }: { label: string; path: string | null | undefined }) {
  return (
    <div className="min-w-0 rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
      <p className="text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-1 break-all text-sm" style={{ color: "var(--text-primary)" }}>
        {path || "Not configured"}
      </p>
    </div>
  );
}

function Badge({
  icon,
  label,
  tone = "slate",
}: {
  icon?: ReactNode;
  label: string;
  tone?: "green" | "slate";
}) {
  const color = tone === "green" ? "#34d399" : "var(--text-secondary)";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1"
      style={{ borderColor: "var(--border)", color }}
    >
      {icon}
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function ListBlock({ items, empty }: { items?: string[]; empty: string }) {
  if (!items?.length) {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        {empty}
      </p>
    );
  }
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function TagBlock({ items, empty }: { items?: string[]; empty: string }) {
  if (!items?.length) {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        {empty}
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border px-2.5 py-1 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function TaskList({ tasks, empty }: { tasks: AgentOwnedTask[]; empty: string }) {
  if (!tasks.length) {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        {empty}
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      {tasks.slice(0, 8).map((task) => (
        <div key={task.id} className="min-w-0 rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {task.title}
              </p>
              <p className="mt-1 break-all text-xs" style={{ color: "var(--text-secondary)" }}>
                {task.id} · {task.source}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                {task.status}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {formatRelativeTime(task.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedList({
  items,
  empty,
}: {
  items: AgentDetail["recentCommunications"] | AgentDetail["recentActivity"];
  empty: string;
}) {
  if (!items.length) {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
        {empty}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium break-words" style={{ color: "var(--text-primary)" }}>
                {item.title}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.15em]" style={{ color: "var(--text-secondary)" }}>
                {item.category} · {item.source}
              </p>
            </div>
            <p className="shrink-0 text-xs" style={{ color: "var(--text-secondary)" }}>
              {formatRelativeTime(item.timestamp)}
            </p>
          </div>
          {item.body ? (
            <p className="mt-2 text-sm break-words" style={{ color: "var(--text-secondary)" }}>
              {item.body}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - Date.parse(iso);
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m ago`;
}
