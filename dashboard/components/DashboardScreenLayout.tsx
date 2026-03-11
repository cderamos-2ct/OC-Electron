"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BuilderWidget } from "@/lib/builder-types";
import type { DashboardScreenKey } from "@/lib/dashboard-screen-layouts";
import { useDashboardScreenLayout } from "@/hooks/use-dashboard-screen-layout";

type DashboardScreenLayoutProps = {
  screenKey: DashboardScreenKey;
  renderers: Record<string, (widget: BuilderWidget) => React.ReactNode>;
};

const COMPACT_QUERY = "(max-width: 1079px)";
const MIN_HEIGHT_BY_WIDGET: Record<string, number> = {
  "overview.status": 220,
  "overview.resources": 220,
  "overview.clients": 240,
  "overview.channels": 220,
  "chat.sessions": 112,
  "chat.thread": 420,
};
const MIN_WIDTH_BY_WIDGET: Record<string, number> = {
  "overview.status": 320,
  "overview.resources": 320,
  "overview.clients": 460,
  "overview.channels": 320,
  "chat.sessions": 280,
  "chat.thread": 540,
};

export function DashboardScreenLayout({
  screenKey,
  renderers,
}: DashboardScreenLayoutProps) {
  const { config, error } = useDashboardScreenLayout(screenKey);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_QUERY);
    const sync = () => setCompactMode(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const sortedWidgets = useMemo(() => {
    return [...config.widgets].sort((left, right) => {
      if (left.y === right.y) {
        return left.x - right.x;
      }

      return left.y - right.y;
    });
  }, [config.widgets]);

  const scale =
    compactMode || !config.canvas.width
      ? 1
      : Math.min(1, Math.max(0.36, containerWidth / config.canvas.width));
  const preferResponsiveSplitLayout = screenKey === "chat" && containerWidth >= 960;
  const fallsBelowWidgetFloor = useMemo(() => {
    if (!config.canvas.width || compactMode) {
      return false;
    }

    return sortedWidgets.some((widget) => {
      const minHeight = MIN_HEIGHT_BY_WIDGET[widget.type] ?? 220;
      const minWidth = MIN_WIDTH_BY_WIDGET[widget.type] ?? 280;
      return widget.height * scale < minHeight || widget.width * scale < minWidth;
    });
  }, [compactMode, config.canvas.width, scale, sortedWidgets]);
  const useStackedLayout = compactMode || preferResponsiveSplitLayout || fallsBelowWidgetFloor;
  const useResponsiveSplitLayout = useStackedLayout && screenKey === "chat" && containerWidth >= 960;
  const stackedWidgets = useMemo(() => {
    if (!(compactMode && screenKey === "chat")) {
      return sortedWidgets;
    }

    return [...sortedWidgets].sort((left, right) => {
      if (left.type === "chat.thread" && right.type !== "chat.thread") {
        return -1;
      }

      if (right.type === "chat.thread" && left.type !== "chat.thread") {
        return 1;
      }

      if (left.y === right.y) {
        return left.x - right.x;
      }

      return left.y - right.y;
    });
  }, [compactMode, screenKey, sortedWidgets]);
  const widgetRows = useMemo(() => {
    const rows: Array<{ key: string; widgets: typeof sortedWidgets }> = [];

    for (const widget of sortedWidgets) {
      const currentRow = rows.at(-1);
      if (currentRow && currentRow.widgets[0]?.y === widget.y) {
        currentRow.widgets.push(widget);
        continue;
      }

      rows.push({
        key: `${widget.y}-${rows.length}`,
        widgets: [widget],
      });
    }

    return rows;
  }, [sortedWidgets]);

  const canvasHeight =
    useStackedLayout || !config.canvas.height ? 0 : config.canvas.height * scale;
  const useCanvasFrame = !useStackedLayout && sortedWidgets.length > 1;
  const useCanvasLayout = screenKey === "chat" && !useStackedLayout;
  const getWidgetMinHeight = (widget: BuilderWidget, mode: "flow" | "stacked") => {
    const preset = MIN_HEIGHT_BY_WIDGET[widget.type];
    if (preset) {
      return preset;
    }

    const softFloor =
      widget.height <= 160 ? Math.max(108, Math.round(widget.height * 0.85)) : 180;
    const derivedHeight = Math.round(widget.height * (mode === "flow" ? 0.42 : 0.7));
    return Math.max(softFloor, Math.min(mode === "flow" ? 360 : 560, derivedHeight));
  };
  const renderResponsiveWidget = (
    widget: BuilderWidget,
    mode: "flow" | "stacked",
  ) => {
    const renderer = renderers[widget.type];
    if (!renderer) {
      return null;
    }

    return (
      <div
        key={widget.id}
        className="min-h-0 min-w-0"
        style={{ minHeight: getWidgetMinHeight(widget, mode) }}
        data-screen-widget={widget.type}
      >
        {renderer(widget)}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {error ? (
        <div className="px-4 pt-4 md:px-6">
          <div
            className="rounded-2xl border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(251, 113, 133, 0.22)",
              background: "rgba(251, 113, 133, 0.08)",
              color: "#fecdd3",
            }}
          >
            Layout settings could not be loaded. The screen is using its default arrangement.
          </div>
        </div>
      ) : null}

      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
        {!useCanvasLayout ? (
          <div
            className={
              useResponsiveSplitLayout
                ? "grid gap-4 pb-2"
                : "space-y-4 pb-2"
            }
            style={
              useResponsiveSplitLayout
                ? { gridTemplateColumns: "minmax(280px, 320px) minmax(0, 1fr)" }
                : undefined
            }
          >
            {useResponsiveSplitLayout
              ? stackedWidgets.map((widget) => renderResponsiveWidget(widget, "stacked"))
              : compactMode || screenKey === "chat"
                ? stackedWidgets.map((widget) => renderResponsiveWidget(widget, "stacked"))
                : widgetRows.map((row) =>
                    row.widgets.length === 1 ? (
                      renderResponsiveWidget(row.widgets[0], "flow")
                    ) : (
                      <div
                        key={row.key}
                        className="grid items-start gap-4"
                        style={{
                          gridTemplateColumns: row.widgets
                            .map((widget) => `minmax(0, ${Math.max(1, widget.width)}fr)`)
                            .join(" "),
                        }}
                      >
                        {row.widgets.map((widget) => renderResponsiveWidget(widget, "flow"))}
                      </div>
                    ),
                  )}
          </div>
        ) : (
          <div
            className={`relative min-h-0 w-full overflow-x-auto overflow-y-visible ${useCanvasFrame ? "rounded-[2rem] border p-3" : ""}`}
            style={
              useCanvasFrame
                ? {
                    minHeight: Math.max(320, canvasHeight + 24),
                    borderColor: "rgba(124, 151, 171, 0.18)",
                    background:
                      "linear-gradient(180deg, rgba(8, 18, 26, 0.92), rgba(10, 24, 31, 0.78))",
                  }
                : {
                    minHeight: Math.max(320, canvasHeight),
                  }
            }
          >
            <div
              className={`relative ${useCanvasFrame ? "rounded-[1.5rem]" : ""}`}
              style={{
                width: config.canvas.width * scale,
                height: canvasHeight,
                maxWidth: "100%",
              }}
            >
              {sortedWidgets.map((widget) => {
                const renderer = renderers[widget.type];
                if (!renderer) {
                  return null;
                }

                return (
                  <div
                    key={widget.id}
                    className="absolute min-h-0 min-w-0"
                    style={{
                      left: widget.x * scale,
                      top: widget.y * scale,
                      width: widget.width * scale,
                      height: widget.height * scale,
                    }}
                    data-screen-widget={widget.type}
                  >
                    <div className="h-full min-h-0 overflow-auto">
                      {renderer(widget)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
