"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type { GraphxReviewSnapshot } from "@/lib/graphx-review-types";

const GRAPHX_REVIEW_BASE = "/api/graphx-review";

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

export function useGraphxReview() {
  const [snapshot, setSnapshot] = useState<GraphxReviewSnapshot | null>(null);
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
      const nextSnapshot = await requestJson<GraphxReviewSnapshot>(GRAPHX_REVIEW_BASE);
      startTransition(() => {
        setSnapshot(nextSnapshot);
        setError(null);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Graphx review snapshot");
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
  }, [refresh]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh,
  };
}
