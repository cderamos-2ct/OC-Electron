"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type { PersonalOpsItemDetail, PersonalOpsSnapshot } from "@/lib/personal-ops-types";

const PERSONAL_OPS_BASE = "/api/personal-ops";

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

export function usePersonalOps() {
  const [snapshot, setSnapshot] = useState<PersonalOpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const nextSnapshot = await requestJson<PersonalOpsSnapshot>(PERSONAL_OPS_BASE);
      startTransition(() => {
        setSnapshot(nextSnapshot);
        setError(null);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load personal ops snapshot");
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    const interval = window.setInterval(() => {
      void refresh(true);
    }, 20000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refresh]);

  const loadItemDetail = useCallback(async (itemId: string) => {
    return requestJson<PersonalOpsItemDetail>(`${PERSONAL_OPS_BASE}/items/${encodeURIComponent(itemId)}`);
  }, []);

  const executeAction = useCallback(
    async (itemId: string, actionKey: string, payload?: Record<string, unknown>) => {
      const res = await fetch(`${PERSONAL_OPS_BASE}/items/${encodeURIComponent(itemId)}/actions/${encodeURIComponent(actionKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      if (!res.ok) throw new Error(`Action failed: ${res.status}`);
      const result = await res.json();
      await refresh(true); // silent refresh to update snapshot
      return result;
    },
    [refresh],
  );

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh,
    loadItemDetail,
    executeAction,
  };
}
