"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import { useAgentOps } from "@/hooks/use-agent-ops";
import { buildAgentRosterCards } from "@/lib/command-chat-view";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import type { AgentRosterCard, AgentSummary } from "@/lib/types";

const RUNTIME_COLOR: Record<string, string> = {
  healthy: "#34d399",
  busy: "#3b82f6",
  missing: "#fb923c",
  orphaned: "#fb923c",
  drifted: "#fb923c",
  blocked: "#fb923c",
};

export function AgentsPageClient() {
  const router = useRouter();
  const { agents, defaultId, managerAudit, visibility, loading, error, refresh } = useOpenClawAgents();
  const { tasks } = useAgentOps();
  const [auditOpen, setAuditOpen] = useState(false);

  const agentIndex = useMemo(() => new Map(agents.map((a) => [a.id, a] as const)), [agents]);
  const rosterCards = useMemo<AgentRosterCard[]>(
    () => visibility?.rosterCards ?? buildAgentRosterCards({ agents, tasks, sessions: visibility?.sessions ?? [] }),
    [agents, tasks, visibility],
  );

  const roster = managerAudit?.rosterSummary;
  const taskSummary = managerAudit?.taskSummary;
  const healthyCount = roster?.healthy ?? 0;
  const missingCount = roster?.missing ?? 0;
  const busyCount = roster?.busy ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
      {/* ── Summary strip ── */}
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border px-4 py-2.5"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <Metric label="Total" value={agents.length} />
        <Metric label="Healthy" value={healthyCount} tone="green" />
        <Metric label="Missing" value={missingCount} tone={missingCount ? "orange" : "slate"} />
        <Metric label="Busy" value={busyCount} tone={busyCount ? "blue" : "slate"} />
        {taskSummary && (
          <>
            <span className="hidden h-4 border-l sm:block" style={{ borderColor: "var(--border)" }} />
            <Metric label="Active tasks" value={taskSummary.active} />
            <Metric label="Unowned" value={taskSummary.unowned} tone={taskSummary.unowned ? "orange" : "slate"} />
          </>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="ml-auto rounded-full p-1.5 transition-colors hover:bg-white/5"
          style={{ color: "var(--text-secondary)" }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mt-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(248,113,113,0.24)", background: "rgba(248,113,113,0.08)", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* ── Agent roster ── */}
      <div className="mt-3 flex-1 overflow-y-auto rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}>
        <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Roster</span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{agents.length}</span>
        </div>

        {loading && agents.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        ) : agents.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>No agents configured.</div>
        ) : (
          <div className="flex flex-col">
            {rosterCards.map((card) => {
              const agent = agentIndex.get(card.id);
              if (!agent) return null;
              return (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  card={card}
                  isDefault={agent.id === defaultId}
                  onClick={() => router.push(`/agents/${agent.id}`)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Collapsible audit ── */}
      {managerAudit && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAuditOpen(!auditOpen)}
            className="flex w-full items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors hover:bg-white/[0.04]"
            style={{ color: "var(--text-secondary)" }}
          >
            {auditOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Audit details
            {managerAudit.warnings.length > 0 && (
              <span className="rounded-full px-1.5 text-[10px] font-semibold" style={{ background: "rgba(251,191,36,0.15)", color: "#fb923c" }}>
                {managerAudit.warnings.length}
              </span>
            )}
          </button>

          {auditOpen && (
            <div className="mt-1 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              {managerAudit.warnings.map((w) => (
                <div key={w} className="mb-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.06)", color: "var(--text-secondary)" }}>
                  {w}
                </div>
              ))}

              {managerAudit.runtimeTriage.length > 0 && (
                <>
                  <h4 className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Runtime triage</h4>
                  {managerAudit.runtimeTriage.slice(0, 5).map((item) => (
                    <div key={item.agentId} className="mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: RUNTIME_COLOR[item.runtimeState] ?? "var(--text-muted)" }} />
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{item.agentName}</span>
                      <span style={{ color: "var(--text-muted)" }}>{item.runtimeState}</span>
                      {item.currentTaskId && <span style={{ color: "var(--text-secondary)" }}>· {item.currentTaskId}</span>}
                      {item.taskCount ? <span style={{ color: "var(--text-muted)" }}>· {item.taskCount} tasks</span> : null}
                    </div>
                  ))}
                </>
              )}

              {managerAudit.delegationTraces.length > 0 && (
                <>
                  <h4 className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Recent delegations</h4>
                  {managerAudit.delegationTraces.slice(0, 5).map((t) => (
                    <div key={`${t.taskId}:${t.timestamp}`} className="mb-1 flex items-baseline gap-2 px-3 py-1 text-xs">
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{t.taskId}</span>
                      <span style={{ color: "var(--text-muted)" }}>{t.actor} → {t.ownerAgentId}</span>
                      <span className="ml-auto" style={{ color: "var(--text-muted)" }}>{new Date(t.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Agent row ── */

function AgentRow({ agent, card, isDefault, onClick }: { agent: AgentSummary; card: AgentRosterCard; isDefault: boolean; onClick: () => void }) {
  const name = agent.identity?.name || agent.name || agent.id;
  const counts = agent.taskCounts ?? { queued: 0, running: 0, blocked: 0, done: 0, failed: 0, total: 0 };
  const runtimeState = agent.runtime?.observedState || "unknown";
  const stateColor = RUNTIME_COLOR[runtimeState] ?? "var(--text-muted)";
  const currentTask = card.currentTasks[0];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Status dot */}
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: stateColor }} />

      {/* Name + current task */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{name}</span>
          {isDefault && <span className="text-[10px]" style={{ color: "#eab308" }}>default</span>}
          <span className="text-[10px]" style={{ color: stateColor }}>{runtimeState}</span>
        </div>
        {currentTask && (
          <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {currentTask.id} · {currentTask.title}
          </div>
        )}
      </div>

      {/* Task counts */}
      <div className="flex shrink-0 items-center gap-3 text-[10px]">
        {counts.running > 0 && <span style={{ color: "#34d399" }}>{counts.running} running</span>}
        {counts.blocked > 0 && <span style={{ color: "#fb923c" }}>{counts.blocked} blocked</span>}
        <span style={{ color: "var(--text-muted)" }}>{counts.total} total</span>
      </div>
    </button>
  );
}

/* ── Metric chip ── */

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "green" | "orange" | "blue" | "slate" }) {
  const color = tone === "green" ? "#34d399" : tone === "orange" ? "#fb923c" : tone === "blue" ? "#3b82f6" : "var(--text-primary)";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
