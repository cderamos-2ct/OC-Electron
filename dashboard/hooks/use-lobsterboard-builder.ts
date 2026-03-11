"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import type {
  BuilderConfig,
  BuilderTemplateMeta,
  BuilderWidgetDefinition,
} from "@/lib/builder-types";
import { normalizeBuilderConfig } from "@/lib/builder-types";

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

export function useLobsterboardBuilder() {
  const [config, setConfig] = useState<BuilderConfig | null>(null);
  const [templates, setTemplates] = useState<BuilderTemplateMeta[]>([]);
  const [widgetCatalog, setWidgetCatalog] = useState<BuilderWidgetDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverFingerprint, setServerFingerprint] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const [nextConfig, nextTemplates, nextCatalog] = await Promise.all([
        fetchJson<BuilderConfig>("/api/lobsterboard/config"),
        fetchJson<BuilderTemplateMeta[]>("/api/lobsterboard/templates"),
        fetchJson<BuilderWidgetDefinition[]>("/api/lobsterboard/widgets"),
      ]);

      const normalized = normalizeBuilderConfig(nextConfig);
      const fingerprint = JSON.stringify(normalized);

      startTransition(() => {
        setConfig(normalized);
        setTemplates(nextTemplates);
        setWidgetCatalog(nextCatalog);
        setServerFingerprint(fingerprint);
        setError(null);
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveConfig = useCallback(async (nextConfig: BuilderConfig) => {
    setSaving(true);

    try {
      await fetchJson<{ status: string; message: string }>("/api/lobsterboard/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextConfig),
      });

      const normalized = normalizeBuilderConfig(nextConfig);

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
  }, []);

  return {
    config,
    setConfig,
    templates,
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
