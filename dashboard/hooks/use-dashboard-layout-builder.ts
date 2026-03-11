"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type {
  BuilderConfig,
  BuilderWidgetDefinition,
} from "@/lib/builder-types";
import { normalizeBuilderConfig } from "@/lib/builder-types";
import {
  buildDefaultDashboardScreenLayout,
  getDashboardScreenLayoutDefinition,
  type DashboardScreenKey,
} from "@/lib/dashboard-screen-layouts";

type LayoutBuilderResponse = {
  config?: BuilderConfig;
  widgets?: BuilderWidgetDefinition[];
  label?: string;
  description?: string;
};

async function readError(response: Response) {
  try {
    const body = await response.json();
    if (body?.error) {
      return String(body.error);
    }
    if (body?.message) {
      return String(body.message);
    }
  } catch {
    // fall through
  }

  return `${response.status} ${response.statusText}`.trim();
}

async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return (await response.json()) as T;
}

export function useDashboardLayoutBuilder(screenKey: DashboardScreenKey) {
  const definition = getDashboardScreenLayoutDefinition(screenKey);
  const [config, setConfig] = useState<BuilderConfig | null>(() =>
    buildDefaultDashboardScreenLayout(screenKey),
  );
  const [widgetCatalog, setWidgetCatalog] = useState<BuilderWidgetDefinition[]>(
    definition.widgets,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverFingerprint, setServerFingerprint] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetchJson<LayoutBuilderResponse>(
        `/api/dashboard-layouts/${screenKey}`,
      );
      const normalized = normalizeBuilderConfig(
        response.config ?? buildDefaultDashboardScreenLayout(screenKey),
      );
      const fingerprint = JSON.stringify(normalized);

      startTransition(() => {
        setConfig(normalized);
        setWidgetCatalog(response.widgets ?? definition.widgets);
        setServerFingerprint(fingerprint);
        setError(null);
      });
    } catch (nextError) {
      setConfig(buildDefaultDashboardScreenLayout(screenKey));
      setWidgetCatalog(definition.widgets);
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, [definition.widgets, screenKey]);

  useEffect(() => {
    setConfig(buildDefaultDashboardScreenLayout(screenKey));
    setWidgetCatalog(definition.widgets);
    void refresh();
  }, [definition.widgets, refresh, screenKey]);

  const saveConfig = useCallback(
    async (nextConfig: BuilderConfig) => {
      setSaving(true);

      try {
        const response = await fetchJson<{ config?: BuilderConfig }>(
          `/api/dashboard-layouts/${screenKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              config: nextConfig,
            }),
          },
        );

        const normalized = normalizeBuilderConfig(
          response.config ?? nextConfig,
        );

        startTransition(() => {
          setConfig(normalized);
          setServerFingerprint(JSON.stringify(normalized));
          setSavedAt(new Date().toISOString());
          setError(null);
        });
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
        throw nextError;
      } finally {
        setSaving(false);
      }
    },
    [screenKey],
  );

  return {
    definition,
    config,
    setConfig,
    widgetCatalog,
    loading,
    saving,
    error,
    refresh,
    saveConfig,
    serverFingerprint,
    savedAt,
  };
}
