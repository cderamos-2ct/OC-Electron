"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type {
  CreateOpsTaskInput,
  OpsAgentSummary,
  OpsTask,
  UpdateOpsTaskInput,
} from "@/lib/ops-types";
import type { ServerVisibilitySummary } from "@/lib/types";

const OPS_BASE = "/api/ops";

function buildHeaders(token?: string, init?: HeadersInit) {
  const headers = new Headers(init);
  headers.set("Content-Type", "application/json");
  if (token?.trim()) {
    headers.set("Authorization", `Bearer ${token.trim()}`);
  }
  return headers;
}

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

async function opsRequest<T>(path: string, options?: RequestInit & { token?: string }) {
  const response = await fetch(`${OPS_BASE}${path}`, {
    cache: "no-store",
    ...options,
    headers: buildHeaders(options?.token, options?.headers),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

export function useAgentOps() {
  const token = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN;
  const [tasks, setTasks] = useState<OpsTask[]>([]);
  const [summary, setSummary] = useState<OpsAgentSummary | null>(null);
  const [visibility, setVisibility] = useState<ServerVisibilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [nextTasks, nextSummary] = await Promise.all([
          opsRequest<OpsTask[]>("/tasks", { token }),
          opsRequest<{ ops: OpsAgentSummary; visibility?: ServerVisibilitySummary | null }>("/agents", { token }),
        ]);

        startTransition(() => {
          setTasks(nextTasks);
          setSummary(nextSummary.ops);
          setVisibility(nextSummary.visibility ?? null);
          setError(null);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [token],
  );

  useEffect(() => {
    void refresh(false);
    const interval = window.setInterval(() => {
      void refresh(true);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refresh]);

  const createTask = useCallback(
    async (input: CreateOpsTaskInput) => {
      const created = await opsRequest<OpsTask>("/tasks", {
        method: "POST",
        token,
        body: JSON.stringify(input),
      });
      await refresh(true);
      return created;
    },
    [refresh, token],
  );

  const updateTask = useCallback(
    async (taskId: string, patch: UpdateOpsTaskInput) => {
      const updated = await opsRequest<OpsTask>(`/tasks/${taskId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(patch),
      });
      await refresh(true);
      return updated;
    },
    [refresh, token],
  );

  const addNote = useCallback(
    async (taskId: string, text: string) => {
      const note = await opsRequest<{ text: string; timestamp: string }>(`/tasks/${taskId}/notes`, {
        method: "POST",
        token,
        body: JSON.stringify({ text }),
      });
      await refresh(true);
      return note;
    },
    [refresh, token],
  );

  const spawnTask = useCallback(
    async (taskId: string) => {
      const task = await opsRequest<OpsTask>(`/tasks/${taskId}/spawn`, {
        method: "POST",
        token,
      });
      await refresh(true);
      return task;
    },
    [refresh, token],
  );

  const spawnBatch = useCallback(
    async (taskIds: string[]) => {
      const result = await opsRequest<{ spawned: number }>(`/tasks/spawn-batch`, {
        method: "POST",
        token,
        body: JSON.stringify({ taskIds }),
      });
      await refresh(true);
      return result;
    },
    [refresh, token],
  );

  return {
    tasks,
    summary,
    visibility,
    loading,
    refreshing,
    error,
    refresh,
    createTask,
    updateTask,
    addNote,
    spawnTask,
    spawnBatch,
  };
}
