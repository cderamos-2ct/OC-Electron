"use client";

import { useEffect, useState } from "react";
import { DashboardScreenLayout } from "@/components/DashboardScreenLayout";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import {
  Timer,
  RefreshCw,
  Loader2,
  Plus,
  Play,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { CronJob, CronRunResult } from "@/lib/types";

export default function OpenClawCronPage() {
  const { rpc, isConnected, subscribe } = useOpenClaw();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const refresh = async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const result = await rpc("cron.list");
      setJobs(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cron jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) refresh();
  }, [isConnected]);

  // Subscribe to cron events
  useEffect(() => {
    if (!isConnected) return;
    return subscribe("cron", () => refresh());
  }, [isConnected, subscribe]);

  const handleRun = async (id: string) => {
    setRunningJob(id);
    try {
      await rpc("cron.run", { id });
      await refresh();
    } catch (err) {
      console.error("Cron run failed:", err);
    } finally {
      setRunningJob(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cron job?")) return;
    try {
      await rpc("cron.remove", { id });
      await refresh();
    } catch (err) {
      console.error("Cron delete failed:", err);
    }
  };

  const handleToggle = async (job: CronJob) => {
    try {
      await rpc("cron.update", { id: job.id, enabled: !job.enabled });
      await refresh();
    } catch (err) {
      console.error("Cron toggle failed:", err);
    }
  };

  return (
    <DashboardScreenLayout
      screenKey="cron"
      renderers={{
        "cron.jobs": () => (
          <section
            className="min-w-0 rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  Cron jobs
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Scheduled tasks and recurring commands
                </p>
              </div>
              <button
                onClick={refresh}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {error ? (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-500">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            ) : null}

            {loading && jobs.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--text-secondary)" }} />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-20">
                <Timer className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-secondary)" }} />
                <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                  No cron jobs
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Add cron jobs via the Aegilume CLI
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="group flex min-w-0 flex-col gap-3 rounded-xl border px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
                    style={{ background: "var(--card)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <button
                        onClick={() => handleToggle(job)}
                        className={`p-1.5 rounded-md transition-colors ${job.enabled ? "text-green-500" : ""}`}
                        style={!job.enabled ? { color: "var(--text-secondary)" } : undefined}
                        title={job.enabled ? "Disable" : "Enable"}
                      >
                        {job.enabled ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {job.name}
                        </h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3">
                          <span
                            className="text-xs font-mono px-1.5 py-0.5 rounded"
                            style={{ background: "var(--background)", color: "var(--text-secondary)" }}
                          >
                            {job.expression}
                          </span>
                          <span className="break-all text-xs" style={{ color: "var(--text-secondary)" }}>
                            {job.command}
                          </span>
                        </div>
                        {job.nextRun ? (
                          <p className="flex items-center gap-1 text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                            <Clock className="w-3 h-3" />
                            Next: {new Date(job.nextRun).toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
                      <button
                        onClick={() => handleRun(job.id)}
                        disabled={runningJob === job.id}
                        className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                        title="Run now"
                      >
                        {runningJob === job.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ),
      }}
    />
  );
}
