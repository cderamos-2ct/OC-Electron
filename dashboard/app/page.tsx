"use client";

import { useEffect, useState } from "react";
import { DashboardScreenLayout } from "@/components/DashboardScreenLayout";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import {
  Activity,
  Bot,
  Brain,
  Clock,
  Cpu,
  Radio,
  Server,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import type { AgentManagerAudit, HealthStatus, ChannelMeta, ChannelDetail, ModelChoice } from "@/lib/types";

export default function OpenClawOverviewPage() {
  const { isConnected, state, hello, snapshot, rpc, subscribe } = useOpenClaw();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [channelMeta, setChannelMeta] = useState<ChannelMeta[]>([]);
  const [channelDetails, setChannelDetails] = useState<Record<string, ChannelDetail>>({});
  const [agentCount, setAgentCount] = useState(0);
  const [modelCount, setModelCount] = useState(0);
  const [managerAudit, setManagerAudit] = useState<AgentManagerAudit | null>(null);

  useEffect(() => {
    if (!isConnected) return;

    Promise.allSettled([
      rpc("health").then((r: any) => setHealth(r)),
      rpc("channels.status").then((r: any) => {
        if (r?.channelMeta) setChannelMeta(r.channelMeta);
        if (r?.channels) setChannelDetails(r.channels);
      }),
      rpc("models.list").then((r: any) => {
        const models = r?.models ?? r;
        setModelCount(Array.isArray(models) ? models.length : 0);
      }),
      rpc("agents.list").then((r: any) => setAgentCount(r?.agents?.length ?? 0)),
      fetch("/api/agents/manager", { cache: "no-store" })
        .then((response) => response.json())
        .then((data) => setManagerAudit(data?.audit ?? null))
        .catch(() => undefined),
    ]);
  }, [isConnected, rpc]);

  useEffect(() => {
    if (!isConnected) return;
    return subscribe("health", (payload) => {
      if (payload && typeof payload === "object") {
        setHealth(payload as HealthStatus);
      }
    });
  }, [isConnected, subscribe]);

  const uptime = snapshot?.uptimeMs ? formatUptime(snapshot.uptimeMs) : "—";
  const serverVersion = hello?.server?.version ?? "—";
  const connectedClients = snapshot?.presence?.length ?? 0;

  return (
    <DashboardScreenLayout
      screenKey="overview"
      renderers={{
        "overview.status": () => (
          <section
            className="rounded-2xl border p-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Runtime health
                </h2>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Gateway status, uptime, and connection posture.
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  This shell talks to the mounted control path behind the public dashboard host.
                </p>
              </div>
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                  isConnected
                    ? "bg-green-500/10 text-green-500"
                    : state === "connecting" || state === "authenticating"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-red-500/10 text-red-500"
                }`}
              >
                {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {state === "connected"
                  ? "Connected"
                  : state === "connecting"
                    ? "Connecting…"
                    : state === "authenticating"
                      ? "Authenticating…"
                      : state === "error"
                        ? "Connection Error"
                        : "Disconnected"}
              </div>
            </div>
            {!isConnected ? (
              <div className="mb-4 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(251, 191, 36, 0.28)", background: "rgba(251, 191, 36, 0.08)", color: "var(--text-secondary)" }}>
                The shell is loading, but the live gateway link is not fully up yet. If this persists, jump into Chat or Ops to verify mounted-control behavior.
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatusCard
                icon={<Activity className="w-5 h-5" />}
                label="Health"
                value={health?.ok ? "Healthy" : health === null ? "—" : "Unhealthy"}
                color={health?.ok ? "#22c55e" : "#ef4444"}
              />
              <StatusCard
                icon={<Clock className="w-5 h-5" />}
                label="Uptime"
                value={uptime}
              />
              <StatusCard
                icon={<Server className="w-5 h-5" />}
                label="Version"
                value={serverVersion}
              />
              <StatusCard
                icon={<Wifi className="w-5 h-5" />}
                label="Connected Clients"
                value={String(connectedClients)}
              />
            </div>
          </section>
        ),
        "overview.resources": () => (
          <section
            className="rounded-2xl border p-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="mb-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-amber-300" />
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Chief of Staff summary
                </h2>
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Quick read on whether the operator system is actually flowing or just looking busy.
              </p>
              {managerAudit ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <SummaryPill label="Healthy" value={String(managerAudit.rosterSummary.healthy)} tone="green" />
                    <SummaryPill label="Missing" value={String(managerAudit.rosterSummary.missing)} tone={managerAudit.rosterSummary.missing ? "orange" : "slate"} />
                    <SummaryPill label="Orphaned" value={String(managerAudit.rosterSummary.orphanedSessions)} tone={managerAudit.rosterSummary.orphanedSessions ? "orange" : "slate"} />
                    <SummaryPill label="On CD" value={String(managerAudit.taskSummary.onCd)} tone={managerAudit.taskSummary.onCd > 3 ? "orange" : "slate"} />
                  </div>
                  {managerAudit.actions[0] ? (
                    <div className="mt-4 rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)" }}>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {managerAudit.actions[0].title}
                      </p>
                      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                        {managerAudit.actions[0].detail}
                      </p>
                      <a href="/agents" className="mt-3 inline-flex rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                        Open Chief of Staff view
                      </a>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed px-4 py-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  Chief of Staff telemetry is loading.
                </div>
              )}
            </div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Operational surfaces
            </h2>
            <p className="mb-4 text-sm" style={{ color: "var(--text-secondary)" }}>
              Jump into the inventory screens that matter most.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ResourceCard icon={<Bot className="w-5 h-5" />} label="Agents" count={agentCount} href="agents" />
              <ResourceCard icon={<Cpu className="w-5 h-5" />} label="Models" count={modelCount} href="models" />
              <ResourceCard icon={<Radio className="w-5 h-5" />} label="Channels" count={channelMeta.length} href="channels" />
              <ResourceCard icon={<Zap className="w-5 h-5" />} label="Skills" count={0} href="skills" />
            </div>
          </section>
        ),
        "overview.clients": () => (
          <section
            className="rounded-2xl border p-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Connected clients
            </h2>
            {snapshot?.presence && snapshot.presence.length > 0 ? (
              <div className="space-y-2">
                {snapshot.presence.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: "var(--background)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                        {p.host || p.platform || "Unknown"}
                      </span>
                      {p.mode ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{ background: "var(--border)", color: "var(--text-secondary)" }}
                        >
                          {p.mode}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {p.version ?? ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex h-full min-h-[12rem] items-center justify-center rounded-2xl border border-dashed px-4 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                No active client presence reported yet.
              </div>
            )}
          </section>
        ),
        "overview.channels": () => (
          <section
            className="rounded-2xl border p-4"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h2 className="mb-3 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              Channel status
            </h2>
            {channelMeta.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {channelMeta.map((ch) => {
                  const detail = channelDetails[ch.id];
                  const isLinked = detail?.linked ?? false;
                  const selfNum = detail?.self?.e164;

                  return (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between rounded-lg px-4 py-3"
                      style={{ background: "var(--background)" }}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${isLinked ? "bg-green-500" : "bg-gray-400"}`} />
                        <div>
                          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {ch.label}
                          </span>
                          {selfNum ? (
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                              {selfNum}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          isLinked
                            ? "bg-green-500/10 text-green-500"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {isLinked ? "Linked" : "Not linked"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="flex h-full min-h-[12rem] items-center justify-center rounded-2xl border border-dashed px-4 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                Channel telemetry will appear here when the gateway reports it.
              </div>
            )}
          </section>
        ),
      }}
    />
  );
}

function StatusCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex items-center gap-4"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="p-2 rounded-lg" style={{ background: "var(--background)" }}>
        <span style={{ color: color ?? "var(--text-secondary)" }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
      </div>
    </div>
  );
}

function SummaryPill({ label, value, tone = "slate" }: { label: string; value: string; tone?: "green" | "orange" | "slate" }) {
  return (
    <div className="rounded-xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-secondary)" }}>{label}</p>
      <p className="mt-1 text-lg font-semibold" style={{ color: tone === "green" ? "#34d399" : tone === "orange" ? "#fb923c" : "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function ResourceCard({
  icon,
  label,
  count,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border p-4 flex items-center gap-4 hover:border-blue-500/50 transition-colors"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="p-2 rounded-lg" style={{ background: "var(--background)", color: "var(--text-secondary)" }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{count}</p>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</p>
      </div>
    </a>
  );
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
