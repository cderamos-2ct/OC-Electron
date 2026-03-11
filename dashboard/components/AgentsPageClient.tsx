"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DashboardScreenLayout } from "@/components/DashboardScreenLayout";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import {
  Bot,
  Brain,
  Plus,
  Trash2,
  ArrowRight,
  RefreshCw,
  Loader2,
  Star,
  AlertCircle,
  Radio,
  Workflow,
  Siren,
  ExternalLink,
  History,
  Sparkles,
} from "lucide-react";
import type { AgentManagerAuditAction, AgentManagerDelegationTrace, AgentRuntimeTriageItem, AgentSummary } from "@/lib/types";

export function AgentsPageClient() {
  const { agents, defaultId, recommendations, managerAudit, loading, error, refresh, deleteAgent, delegateTasks, hireAgentFromTasks } =
    useOpenClawAgents();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actingRecommendation, setActingRecommendation] = useState<string | null>(null);
  const [refiningAgentId, setRefiningAgentId] = useState<string | null>(null);

  const agentIndex = useMemo(() => new Map(agents.map((agent) => [agent.id, agent] as const)), [agents]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this agent?")) return;
    setDeleting(id);
    try {
      await deleteAgent(id);
    } finally {
      setDeleting(null);
    }
  };

  const handleRecommendation = async (index: number) => {
    const recommendation = recommendations[index];
    if (!recommendation) return;
    setActingRecommendation(`${recommendation.kind}:${index}`);
    try {
      if (recommendation.kind === "delegate" && recommendation.proposedAgentId) {
        await delegateTasks(recommendation.taskIds, recommendation.proposedAgentId);
      } else if (recommendation.kind === "hire") {
        await hireAgentFromTasks(recommendation.taskIds, recommendation.draftAgent ?? undefined);
      }
    } finally {
      setActingRecommendation(null);
    }
  };

  const handleRefine = async (agentId: string) => {
    setRefiningAgentId(agentId);
    try {
      const response = await fetch("/api/agents/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refine-packet", agentId }),
      });
      if (!response.ok) throw new Error("Failed to refresh agent packet");
      await refresh();
    } finally {
      setRefiningAgentId(null);
    }
  };

  return (
    <DashboardScreenLayout
      screenKey="agents"
      renderers={{
        "agents.grid": () => (
          <section className="min-w-0">
            <div className="mb-5 rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <div className="mb-4 flex items-center gap-2">
                <Brain className="h-4 w-4 text-amber-300" />
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Chief of Staff audit
                  </h2>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    A single operator read on runtime coverage, delegation pressure, and task ownership drift.
                  </p>
                </div>
              </div>

              {managerAudit ? (
                <>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                    <AuditMetric label="Agents" value={String(managerAudit.rosterSummary.totalAgents)} />
                    <AuditMetric label="Healthy" value={String(managerAudit.rosterSummary.healthy)} tone="green" />
                    <AuditMetric label="Missing" value={String(managerAudit.rosterSummary.missing)} tone={managerAudit.rosterSummary.missing ? "orange" : "slate"} />
                    <AuditMetric label="Orphaned" value={String(managerAudit.rosterSummary.orphanedSessions)} tone={managerAudit.rosterSummary.orphanedSessions ? "orange" : "slate"} />
                    <AuditMetric label="Active tasks" value={String(managerAudit.taskSummary.active)} />
                    <AuditMetric label="Delegated" value={String(managerAudit.taskSummary.delegated)} tone="green" />
                    <AuditMetric label="On CD" value={String(managerAudit.taskSummary.onCd)} tone={managerAudit.taskSummary.onCd > 3 ? "orange" : "slate"} />
                    <AuditMetric label="Unowned" value={String(managerAudit.taskSummary.unowned)} tone={managerAudit.taskSummary.unowned ? "orange" : "slate"} />
                  </div>

                  {managerAudit.actions.length ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                      {managerAudit.actions.map((action) => (
                        <ActionCard key={action.id} action={action} />
                      ))}
                    </div>
                  ) : null}

                  {managerAudit.warnings.length ? (
                    <div className="mt-4 space-y-2">
                      {managerAudit.warnings.map((warning) => (
                        <div
                          key={warning}
                          className="rounded-xl border px-3 py-2 text-sm"
                          style={{ borderColor: "rgba(251, 191, 36, 0.28)", background: "rgba(251, 191, 36, 0.08)", color: "var(--text-secondary)" }}
                        >
                          {warning}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="min-w-0 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                      <div className="flex items-center gap-2">
                        <Siren className="h-4 w-4 text-amber-300" />
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          Runtime triage
                        </h3>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        Agents that are not healthy right now, sorted by how much live work they appear to be carrying.
                      </p>
                      <div className="mt-3 space-y-2">
                        {managerAudit.runtimeTriage.length ? (
                          managerAudit.runtimeTriage.slice(0, 6).map((item) => {
                            const liveAgent = agentIndex.get(item.agentId);
                            return (
                              <RuntimeTriageRow
                                key={item.agentId}
                                item={item}
                                agent={liveAgent}
                                refining={refiningAgentId === item.agentId}
                                onRefine={() => void handleRefine(item.agentId)}
                              />
                            );
                          })
                        ) : (
                          <EmptyMiniState text="No unstable agent runtime states right now." />
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-sky-300" />
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          Recent delegation trace
                        </h3>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        Pulled from canonical task activity logs so you can see what changed without opening the ledger first.
                      </p>
                      <div className="mt-3 space-y-2">
                        {managerAudit.delegationTraces.length ? (
                          managerAudit.delegationTraces.map((trace) => <DelegationTraceRow key={`${trace.taskId}:${trace.timestamp}`} trace={trace} />)
                        ) : (
                          <EmptyMiniState text="No recent delegation events recorded yet." />
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-300" />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Delegation + hiring recommendations
                  </h3>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  Recommendations are derived from canonical task ownership plus the joined runtime roster.
                </p>
                {recommendations.length ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {recommendations.map((recommendation, index) => (
                      <div key={`${recommendation.kind}:${index}`} className="min-w-0 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {recommendation.title}
                        </p>
                        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                          {recommendation.rationale}
                        </p>
                        <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                          Tasks: {recommendation.taskIds.join(", ")}
                          {recommendation.currentOwnerAgentId ? ` · current owner: ${recommendation.currentOwnerAgentId}` : ""}
                          {recommendation.proposedAgentId ? ` · proposed: ${recommendation.proposedAgentId}` : ""}
                        </p>
                        {recommendation.evidence?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {recommendation.evidence.map((item) => (
                              <span
                                key={item}
                                className="rounded-full border px-2 py-1 text-[11px]"
                                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <button
                          onClick={() => void handleRecommendation(index)}
                          disabled={actingRecommendation === `${recommendation.kind}:${index}`}
                          className="mt-3 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50"
                          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                        >
                          {actingRecommendation === `${recommendation.kind}:${index}`
                            ? "Applying..."
                            : recommendation.kind === "hire"
                              ? "Hire Agent"
                              : "Delegate"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    No delegation or hiring recommendations right now.
                  </p>
                )}
              </div>
            </div>

            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  Agent inventory
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Monitor joined roster health, task ownership, and execution settings.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <a
                  href="/agents/new"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Agent
                </a>
              </div>
            </div>

            {error ? (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            ) : null}

            {loading && agents.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--text-secondary)" }} />
              </div>
            ) : agents.length === 0 ? (
              <div className="text-center py-20">
                <Bot className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-secondary)" }} />
                <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                  No agents yet
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Create your first agent to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isDefault={agent.id === defaultId}
                    onDelete={() => handleDelete(agent.id)}
                    deleting={deleting === agent.id}
                  />
                ))}
              </div>
            )}
          </section>
        ),
      }}
    />
  );
}

function AgentCard({
  agent,
  isDefault,
  onDelete,
  deleting,
}: {
  agent: AgentSummary;
  isDefault: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const name = agent.identity?.name || agent.name || agent.id;
  const emoji = agent.identity?.emoji;
  const status = agent.status || "planned";
  const counts = agent.taskCounts ?? { queued: 0, running: 0, blocked: 0, done: 0, failed: 0, total: 0 };
  const lane = agent.lane || "unassigned";
  const runtimeState = agent.runtime?.observedState || "unknown";
  const runtimeTone = runtimeState === "healthy" ? "green" : runtimeState === "missing" || runtimeState === "orphaned" || runtimeState === "drifted" ? "orange" : "slate";

  return (
    <div
      className="group min-w-0 rounded-xl border p-4 transition-colors hover:border-blue-500/30"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ background: "var(--background)" }}
          >
            {emoji || "🤖"}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                {name}
              </h3>
              {isDefault && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
            </div>
            <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
              {agent.id}
            </p>
          </div>
        </div>
      </div>

      {agent.description ? (
        <p className="text-xs mt-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
          {agent.description}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <StatPill icon={<Workflow className="w-3 h-3" />} label={lane} />
        <StatPill icon={<Radio className="w-3 h-3" />} label={status} tone={status === "active" ? "green" : status === "paused" ? "orange" : "slate"} />
        <StatPill label={`runtime:${runtimeState}`} tone={runtimeTone} />
        <StatPill label={`${counts.total} tasks`} />
        <StatPill label={`${counts.running} running`} />
        <StatPill label={`${counts.blocked} blocked`} tone={counts.blocked ? "orange" : "slate"} />
      </div>

      {runtimeState !== "healthy" ? (
        <div className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(251, 191, 36, 0.2)", background: "rgba(251, 191, 36, 0.08)", color: "var(--text-secondary)" }}>
          {counts.total > 0
            ? `${name} is ${runtimeState} while carrying ${counts.total} task${counts.total === 1 ? "" : "s"}. This is an operator check-in candidate.`
            : `${name} is ${runtimeState}. If this lane should be live, inspect its runtime mapping.`}
        </div>
      ) : null}

      {agent.monitorSurfaces?.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {agent.monitorSurfaces.slice(0, 3).map((surface) => (
            <span
              key={surface}
              className="rounded-full border px-2 py-1 text-[11px]"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {surface}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-1 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={`/agents/${agent.id}`}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs hover:bg-white/5 transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowRight className="w-3 h-3" />
          Open
        </a>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Delete
        </button>
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: AgentManagerAuditAction }) {
  const color = action.tone === "red" ? "#f87171" : action.tone === "orange" ? "#fb923c" : action.tone === "blue" ? "#60a5fa" : action.tone === "green" ? "#34d399" : "var(--text-primary)";
  return (
    <div className="min-w-0 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
      <p className="text-sm font-semibold" style={{ color }}>
        {action.title}
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        {action.detail}
      </p>
      {action.ctaHref ? (
        <a
          href={action.ctaHref}
          className="mt-3 inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          {action.ctaLabel || "Open"}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

function RuntimeTriageRow({ item, agent, refining, onRefine }: { item: AgentRuntimeTriageItem; agent?: AgentSummary; refining: boolean; onRefine: () => void }) {
  const tone = item.runtimeState === "missing" || item.runtimeState === "orphaned" || item.runtimeState === "drifted" ? "#fb923c" : "var(--text-primary)";
  return (
    <div className="min-w-0 rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {item.agentName}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {item.agentId}
            {item.currentTaskId ? ` · current task ${item.currentTaskId}` : ""}
            {item.taskCount ? ` · ${item.taskCount} task${item.taskCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <span className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: "var(--border)", color: tone }}>
          {item.runtimeState}
        </span>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        Desired: {item.desiredStatus || "unknown"}
        {item.lastSeenAt ? ` · last seen ${new Date(item.lastSeenAt).toLocaleString()}` : " · no live heartbeat seen"}
      </p>
      {item.lastError ? (
        <p className="mt-2 text-xs" style={{ color: "#fca5a5" }}>
          Last error: {item.lastError}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`/agents/${item.agentId}`} className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          Open agent
        </a>
        <button onClick={onRefine} disabled={refining} className="rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
          {refining ? "Refreshing..." : "Refresh packet"}
        </button>
        {agent?.taskCounts?.total ? <a href="/ops" className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Open tasks</a> : null}
      </div>
    </div>
  );
}

function DelegationTraceRow({ trace }: { trace: AgentManagerDelegationTrace }) {
  return (
    <div className="min-w-0 rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {trace.taskId}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {trace.taskTitle}
          </p>
        </div>
        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {new Date(trace.timestamp).toLocaleString()}
        </span>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        {trace.actor} → {trace.ownerAgentId || "unknown owner"}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
        {trace.note}
      </p>
    </div>
  );
}

function EmptyMiniState({ text }: { text: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-dashed px-3 py-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
      {text}
    </div>
  );
}

function AuditMetric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "green" | "orange" | "slate" }) {
  return (
    <div className="min-w-0 rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
      <p className="text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold" style={{ color: tone === "green" ? "#34d399" : tone === "orange" ? "#fb923c" : "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

function StatPill({
  icon,
  label,
  tone = "slate",
}: {
  icon?: ReactNode;
  label: string;
  tone?: "green" | "orange" | "slate";
}) {
  const color = tone === "green" ? "#34d399" : tone === "orange" ? "#fb923c" : "var(--text-secondary)";

  return (
    <div className="flex min-w-0 items-start gap-1.5 rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--border)", color }}>
      {icon}
      <span className="min-w-0 break-words">{label}</span>
    </div>
  );
}
