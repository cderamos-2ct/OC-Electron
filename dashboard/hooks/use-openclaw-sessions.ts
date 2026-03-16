"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import type { SessionSummary, SessionsListParams } from "@/lib/types";

const SESSIONS_LIST_MIN_INTERVAL_MS = 2_000;

export function useOpenClawSessions(params?: SessionsListParams) {
  const { rpc, isConnected } = useOpenClaw();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSessionsListRef = useRef<number>(0);
  const sessionsListInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    if (sessionsListInFlightRef.current) return;
    const now = Date.now();
    if (now - lastSessionsListRef.current < SESSIONS_LIST_MIN_INTERVAL_MS) return;
    sessionsListInFlightRef.current = true;
    lastSessionsListRef.current = now;
    setLoading(true);
    setError(null);
    try {
      const result = await rpc("sessions.list", {
        limit: 50,
        ...params,
      }) as SessionSummary[] | { sessions?: SessionSummary[] };
      const nextSessions = Array.isArray(result)
        ? result
        : Array.isArray(result?.sessions)
          ? result.sessions
          : [];
      setSessions(nextSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
      sessionsListInFlightRef.current = false;
    }
  }, [rpc, isConnected, params]);

  useEffect(() => {
    if (isConnected) refresh();
  }, [isConnected, refresh]);

  const deleteSession = useCallback(
    async (key: string) => {
      await rpc("sessions.delete", { key });
      await refresh();
    },
    [rpc, refresh]
  );

  const resetSession = useCallback(
    async (key: string) => {
      await rpc("sessions.reset", { key });
      await refresh();
    },
    [rpc, refresh]
  );

  const compactSession = useCallback(
    async (key: string) => {
      await rpc("sessions.compact", { key });
      await refresh();
    },
    [refresh, rpc]
  );

  return { sessions, loading, error, refresh, deleteSession, resetSession, compactSession };
}
