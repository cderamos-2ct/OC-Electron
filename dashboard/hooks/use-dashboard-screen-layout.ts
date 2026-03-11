"use client";

import { useEffect, useState } from "react";
import type { BuilderConfig } from "@/lib/builder-types";
import { normalizeBuilderConfig } from "@/lib/builder-types";
import {
  buildDefaultDashboardScreenLayout,
  getDashboardScreenLayoutDefinition,
  type DashboardScreenKey,
} from "@/lib/dashboard-screen-layouts";

type ScreenLayoutResponse = {
  config?: BuilderConfig;
};

export function useDashboardScreenLayout(screenKey: DashboardScreenKey) {
  const definition = getDashboardScreenLayoutDefinition(screenKey);
  const [config, setConfig] = useState<BuilderConfig>(() =>
    buildDefaultDashboardScreenLayout(screenKey),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const response = await fetch(`/api/dashboard-layouts/${screenKey}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`.trim());
        }

        const body = (await response.json()) as ScreenLayoutResponse;
        if (cancelled) {
          return;
        }

        setConfig(
          normalizeBuilderConfig(
            body.config ?? buildDefaultDashboardScreenLayout(screenKey),
          ),
        );
        setError(null);
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setConfig(buildDefaultDashboardScreenLayout(screenKey));
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [definition.key, screenKey]);

  return {
    definition,
    config,
    loading,
    error,
  };
}
