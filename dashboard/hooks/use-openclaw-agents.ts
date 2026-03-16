"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type {
  AgentDetail,
  AgentManagerAudit,
  AgentManagerRecommendation,
  AgentSummary,
  ServerVisibilitySummary,
} from "@/lib/types";

async function readError(response: Response) {
  try {
    const body = await response.json();
    if (body?.error) {
      return String(body.error);
    }
  } catch {
    // fall through
  }
  return `${response.status} ${response.statusText}`.trim();
}

async function requestJson<T>(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as T;
}

export function useOpenClawAgents() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [defaultId, setDefaultId] = useState<string>("cd");
  const [recommendations, setRecommendations] = useState<AgentManagerRecommendation[]>([]);
  const [managerAudit, setManagerAudit] = useState<AgentManagerAudit | null>(null);
  const [visibility, setVisibility] = useState<ServerVisibilitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestJson<{
        defaultId: string;
        agents: AgentSummary[];
        visibility?: ServerVisibilitySummary | null;
      }>("/api/agents");
      setAgents(result.agents ?? []);
      setDefaultId(result.defaultId || "cd");
      setVisibility(result.visibility ?? null);
      const manager = await requestJson<{ recommendations: AgentManagerRecommendation[]; audit?: AgentManagerAudit | null }>("/api/agents/manager");
      setRecommendations(manager.recommendations ?? []);
      setManagerAudit(manager.audit ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  const getAgent = useCallback(async (id: string) => {
    return requestJson<AgentDetail>(`/api/agents/${id}`);
  }, []);

  const createAgent = useCallback(
    async (agent: Partial<AgentSummary>) => {
      await requestJson<AgentDetail>("/api/agents", {
        method: "POST",
        body: JSON.stringify(agent),
      });
      await refresh();
    },
    [refresh],
  );

  const updateAgent = useCallback(
    async (agent: Partial<AgentSummary> & { id: string }) => {
      await requestJson<AgentDetail>(`/api/agents/${agent.id}`, {
        method: "PATCH",
        body: JSON.stringify(agent),
      });
      await refresh();
    },
    [refresh],
  );

  const deleteAgent = useCallback(
    async (id: string) => {
      await requestJson<{ ok: true }>(`/api/agents/${id}`, {
        method: "DELETE",
      });
      await refresh();
    },
    [refresh],
  );

  const delegateTasks = useCallback(
    async (taskIds: string[], agentId: string) => {
      const result = await requestJson<{ ok: true }>("/api/agents/manager", {
        method: "POST",
        body: JSON.stringify({
          action: "delegate",
          taskIds,
          agentId,
        }),
      });
      await refresh();
      return result;
    },
    [refresh],
  );

  const hireAgentFromTasks = useCallback(
    async (taskIds: string[], draft?: Record<string, unknown>) => {
      const result = await requestJson<AgentDetail>("/api/agents/manager", {
        method: "POST",
        body: JSON.stringify({
          action: "hire",
          taskIds,
          draft,
        }),
      });
      await refresh();
      return result;
    },
    [refresh],
  );

  const refinePacket = useCallback(
    async (agentId: string) => {
      const result = await requestJson<AgentDetail>("/api/agents/manager", {
        method: "POST",
        body: JSON.stringify({
          action: "refine-packet",
          agentId,
        }),
      });
      await refresh();
      return result;
    },
    [refresh],
  );

  return {
    agents,
    defaultId,
    recommendations,
    managerAudit,
    visibility,
    loading,
    error,
    refresh,
    getAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    delegateTasks,
    hireAgentFromTasks,
    refinePacket,
  };
}
