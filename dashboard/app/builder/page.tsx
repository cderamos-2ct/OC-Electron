"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDashboardLayoutBuilder } from "@/hooks/use-dashboard-layout-builder";
import type {
  BuilderWidget,
  BuilderWidgetDefinition,
  BuilderWidgetPrimitive,
} from "@/lib/builder-types";
import { cloneBuilderConfig } from "@/lib/builder-types";
import {
  buildDefaultDashboardScreenLayout,
  isDashboardScreenKey,
  listDashboardScreenLayoutDefinitions,
} from "@/lib/dashboard-screen-layouts";
import {
  AlertTriangle,
  ArrowUpRight,
  Copy,
  LayoutGrid,
  Loader2,
  PencilRuler,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";

const GRID_SIZE = 20;
const DRAFT_STORAGE_KEY_PREFIX = "openclaw.builder.draft.v2";
const CANVAS_PRESETS = [
  { label: "Phone", width: 390, height: 844 },
  { label: "Tablet", width: 1024, height: 768 },
  { label: "HD", width: 1280, height: 720 },
  { label: "Full HD", width: 1920, height: 1080 },
];

type InteractionState = {
  widgetId: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
};

function snapToGrid(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function buildWidgetId() {
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getBottomEdge(widgets: BuilderWidget[]) {
  return widgets.reduce(
    (current, widget) => Math.max(current, widget.y + widget.height),
    0,
  );
}

function getDefaultPlacement(
  widgets: BuilderWidget[],
  canvasWidth: number,
  widgetWidth: number,
) {
  const nextRow = getBottomEdge(widgets);
  const x =
    widgets.length % 2 === 0
      ? 20
      : Math.max(20, canvasWidth - widgetWidth - 40);

  return {
    x,
    y: nextRow ? snapToGrid(nextRow + GRID_SIZE) : GRID_SIZE,
  };
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<BuilderLoadingState />}>
      <BuilderPageWithSearchParams />
    </Suspense>
  );
}

function BuilderPageWithSearchParams() {
  return <BuilderPageContent />;
}

function BuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedScreen = searchParams.get("screen");
  const returnTo = searchParams.get("returnTo")?.trim();
  const screenKey = isDashboardScreenKey(requestedScreen)
    ? requestedScreen
    : "overview";
  const availableScreens = listDashboardScreenLayoutDefinitions();
  const {
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
  } = useDashboardLayoutBuilder(screenKey);

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [widgetSearch, setWidgetSearch] = useState("");
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [previewScale, setPreviewScale] = useState(0.42);
  const [localError, setLocalError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [draftCandidate, setDraftCandidate] = useState<BuilderWidget[] | null>(null);
  const [checkedDraftFingerprint, setCheckedDraftFingerprint] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const deferredWidgetSearch = useDeferredValue(widgetSearch);

  const draftStorageKey = `${DRAFT_STORAGE_KEY_PREFIX}:${screenKey}`;
  const filteredWidgetCatalog = widgetCatalog.filter((widget) => {
    const needle = deferredWidgetSearch.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return [widget.name, widget.type, widget.category, widget.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  const selectedWidget =
    config?.widgets.find((widget) => widget.id === selectedWidgetId) ?? null;
  const dirty =
    Boolean(config) && JSON.stringify(config) !== serverFingerprint;
  const openScreenHref = returnTo || definition.path;

  useEffect(() => {
    setSelectedWidgetId(null);
    setWidgetSearch("");
    setStatusMessage(null);
    setLocalError(null);
    setDraftCandidate(null);
    setCheckedDraftFingerprint(null);
  }, [screenKey]);

  useEffect(() => {
    if (!config?.widgets.length) {
      setSelectedWidgetId(null);
      return;
    }

    if (
      !selectedWidgetId ||
      !config.widgets.some((widget) => widget.id === selectedWidgetId)
    ) {
      setSelectedWidgetId(config.widgets[0].id);
    }
  }, [config, selectedWidgetId]);

  useEffect(() => {
    if (!config || !previewRef.current) {
      return;
    }

    const node = previewRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const nextScale = Math.min(
        1,
        Math.max(0.18, (entry.contentRect.width - 24) / config.canvas.width),
      );
      setPreviewScale(nextScale);
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [config?.canvas.width]);

  useEffect(() => {
    if (!serverFingerprint || checkedDraftFingerprint === serverFingerprint) {
      return;
    }

    setCheckedDraftFingerprint(serverFingerprint);

    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) {
        return;
      }

      if (raw === serverFingerprint) {
        window.localStorage.removeItem(draftStorageKey);
        return;
      }

      const parsed = JSON.parse(raw) as { widgets?: BuilderWidget[] };
      if (Array.isArray(parsed.widgets)) {
        setDraftCandidate(parsed.widgets);
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    }
  }, [checkedDraftFingerprint, draftStorageKey, serverFingerprint]);

  useEffect(() => {
    if (!config) {
      return;
    }

    if (dirty) {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({ widgets: config.widgets }),
      );
      return;
    }

    window.localStorage.removeItem(draftStorageKey);
  }, [config, dirty, draftStorageKey]);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty]);

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    if (!interaction || !config) {
      return;
    }

    const deltaX = snapToGrid(
      (event.clientX - interaction.startClientX) / previewScale,
    );
    const deltaY = snapToGrid(
      (event.clientY - interaction.startClientY) / previewScale,
    );

    setConfig((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        widgets: current.widgets.map((widget) => {
          if (widget.id !== interaction.widgetId) {
            return widget;
          }

          if (interaction.mode === "move") {
            return {
              ...widget,
              x: Math.max(
                0,
                Math.min(
                  current.canvas.width - widget.width,
                  interaction.initialX + deltaX,
                ),
              ),
              y: Math.max(
                0,
                Math.min(
                  current.canvas.height - widget.height,
                  interaction.initialY + deltaY,
                ),
              ),
            };
          }

          return {
            ...widget,
            width: Math.max(
              120,
              Math.min(
                current.canvas.width - widget.x,
                interaction.initialWidth + deltaX,
              ),
            ),
            height: Math.max(
              80,
              Math.min(
                current.canvas.height - widget.y,
                interaction.initialHeight + deltaY,
              ),
            ),
          };
        }),
      };
    });
  });

  const handlePointerUp = useEffectEvent(() => {
    setInteraction(null);
  });

  useEffect(() => {
    if (!interaction) {
      return;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp, interaction]);

  const updateWidget = (
    widgetId: string,
    updater: (widget: BuilderWidget) => BuilderWidget,
  ) => {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        widgets: current.widgets.map((widget) =>
          widget.id === widgetId ? updater(widget) : widget,
        ),
      };
    });
  };

  const addWidget = (definitionToAdd: BuilderWidgetDefinition) => {
    if (!config) {
      return;
    }

    const placement = getDefaultPlacement(
      config.widgets,
      config.canvas.width,
      definitionToAdd.defaultWidth,
    );
    const nextWidget: BuilderWidget = {
      id: buildWidgetId(),
      type: definitionToAdd.type,
      x: placement.x,
      y: placement.y,
      width: definitionToAdd.defaultWidth,
      height: definitionToAdd.defaultHeight,
      properties: cloneBuilderConfig(definitionToAdd.properties),
    };

    setConfig((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        widgets: [...current.widgets, nextWidget],
      };
    });

    setSelectedWidgetId(nextWidget.id);
    setStatusMessage(`${definitionToAdd.name} added to ${definition.label}.`);
  };

  const duplicateSelectedWidget = () => {
    if (!config || !selectedWidget) {
      return;
    }

    const nextWidget: BuilderWidget = {
      ...cloneBuilderConfig(selectedWidget),
      id: buildWidgetId(),
      x: Math.min(
        config.canvas.width - selectedWidget.width,
        selectedWidget.x + GRID_SIZE * 2,
      ),
      y: Math.min(
        config.canvas.height - selectedWidget.height,
        selectedWidget.y + GRID_SIZE * 2,
      ),
    };

    setConfig((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        widgets: [...current.widgets, nextWidget],
      };
    });

    setSelectedWidgetId(nextWidget.id);
    setStatusMessage("Widget duplicated.");
  };

  const deleteSelectedWidget = () => {
    if (!selectedWidget) {
      return;
    }

    setConfig((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        widgets: current.widgets.filter(
          (widget) => widget.id !== selectedWidget.id,
        ),
      };
    });

    setSelectedWidgetId(null);
    setStatusMessage("Widget removed from the layout.");
  };

  const handleSave = async () => {
    if (!config) {
      return;
    }

    setLocalError(null);

    try {
      await saveConfig(config);
      setDraftCandidate(null);
      window.localStorage.removeItem(draftStorageKey);
      setStatusMessage(`${definition.label} layout saved.`);
    } catch (nextError) {
      setLocalError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  };

  const handleScreenChange = (nextScreen: string) => {
    if (!isDashboardScreenKey(nextScreen)) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("screen", nextScreen);
    router.replace(`/builder?${nextParams.toString()}`);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.24em]"
            style={{ color: "var(--primary)" }}
          >
            Screen layout builder
          </p>
          <h1
            className="font-display mt-2 text-3xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {definition.label} studio
          </h1>
          <p
            className="mt-3 max-w-3xl text-sm leading-6"
            style={{ color: "var(--text-secondary)" }}
          >
            Turn each dashboard surface into a movable, resizable widget layout.
            Rearrange the sections for {definition.label.toLowerCase()}, save the
            layout, and reopen the live screen to see the change immediately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label
            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <PencilRuler className="h-4 w-4" />
            <select
              value={screenKey}
              onChange={(event) => handleScreenChange(event.target.value)}
              className="bg-transparent outline-none"
              style={{ color: "var(--text-primary)" }}
            >
              {availableScreens.map((screen) => (
                <option key={screen.key} value={screen.key} className="bg-[#0b1720]">
                  {screen.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            href={openScreenHref}
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <ArrowUpRight className="h-4 w-4" />
            Open screen
          </Link>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <RefreshCw className="h-4 w-4" />
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              setConfig(buildDefaultDashboardScreenLayout(screenKey));
              setSelectedWidgetId(null);
              setStatusMessage("Restored the default layout in the editor.");
            }}
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <RotateCcw className="h-4 w-4" />
            Reset draft
          </button>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#08121a] disabled:opacity-60"
            style={{
              background:
                "linear-gradient(135deg, rgba(255, 122, 26, 1), rgba(255, 179, 106, 0.94))",
            }}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : dirty ? "Save layout" : "Saved"}
          </button>
        </div>
      </div>

      {(error || localError || statusMessage) && (
        <div className="grid gap-3">
          {(error || localError) && (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: "rgba(251, 113, 133, 0.28)",
                background: "rgba(251, 113, 133, 0.08)",
                color: "#fecdd3",
              }}
            >
              {localError ?? error}
            </div>
          )}
          {statusMessage && (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: "rgba(99, 211, 189, 0.22)",
                background: "rgba(99, 211, 189, 0.08)",
                color: "#d6fff5",
              }}
            >
              {statusMessage}
            </div>
          )}
        </div>
      )}

      {draftCandidate && config && (
        <div
          className="flex flex-col gap-3 rounded-2xl border px-4 py-4 md:flex-row md:items-center md:justify-between"
          style={{
            borderColor: "rgba(255, 122, 26, 0.24)",
            background: "rgba(255, 122, 26, 0.08)",
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--primary)]" />
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Unsaved layout draft found
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                A local draft differs from the saved layout for {definition.label}.
                Restore it or discard it before you keep editing.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setConfig((current) =>
                  current ? { ...current, widgets: draftCandidate } : current,
                );
                setDraftCandidate(null);
                setStatusMessage("Restored your local builder draft.");
              }}
              className="rounded-2xl px-4 py-2 text-sm font-semibold text-[#08121a]"
              style={{ background: "var(--accent)" }}
            >
              Restore draft
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftCandidate(null);
                window.localStorage.removeItem(draftStorageKey);
              }}
              className="rounded-2xl border px-4 py-2 text-sm font-medium"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Screen"
          value={definition.label}
          detail={definition.description}
        />
        <MetricCard
          label="Canvas"
          value={config ? `${config.canvas.width} × ${config.canvas.height}` : "—"}
          detail="Desktop master canvas"
        />
        <MetricCard
          label="Widgets"
          value={config ? String(config.widgets.length) : "—"}
          detail={`${widgetCatalog.length} available section widgets`}
        />
        <MetricCard
          label="Last saved"
          value={savedAt ? formatRelativeTime(savedAt) : dirty ? "Unsaved" : "Server"}
          detail={dirty ? "Draft diverges from saved state" : "No pending changes"}
        />
      </div>

      {loading || !config ? (
        <div
          className="flex min-h-[28rem] items-center justify-center rounded-3xl border"
          style={{ borderColor: "var(--border)" }}
        >
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.45fr)_24rem]">
          <div className="space-y-6">
            <section
              className="rounded-3xl border p-4 md:p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                    Canvas preview
                  </h2>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Drag sections to reposition them. Use the lower-right handle to resize on a 20px grid.
                  </p>
                </div>
                <div
                  className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="rounded-full border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
                    {Math.round(previewScale * 100)}% scale
                  </span>
                  <span className="rounded-full border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
                    {selectedWidget ? `${selectedWidget.type}` : "Select a widget"}
                  </span>
                </div>
              </div>

              <div
                ref={previewRef}
                className="mt-5 overflow-hidden rounded-[2rem] border p-3"
                style={{
                  borderColor: "rgba(124, 151, 171, 0.18)",
                  background:
                    "linear-gradient(180deg, rgba(8, 18, 26, 0.95), rgba(10, 24, 31, 0.82))",
                }}
              >
                <div
                  className="relative overflow-hidden rounded-[1.6rem] border"
                  style={{
                    width: config.canvas.width * previewScale,
                    height: config.canvas.height * previewScale,
                    maxWidth: "100%",
                    borderColor: "rgba(99, 211, 189, 0.22)",
                    backgroundColor: "#0a1821",
                    backgroundImage:
                      "linear-gradient(rgba(99, 211, 189, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 211, 189, 0.09) 1px, transparent 1px)",
                    backgroundSize: `${GRID_SIZE * previewScale}px ${GRID_SIZE * previewScale}px`,
                  }}
                >
                  {config.widgets.map((widget) => {
                    const selected = widget.id === selectedWidgetId;
                    const title =
                      typeof widget.properties.title === "string" &&
                      widget.properties.title
                        ? widget.properties.title
                        : widget.type;

                    return (
                      <div
                        key={widget.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedWidgetId(widget.id)}
                        onPointerDown={(event) => {
                          if (event.button !== 0) {
                            return;
                          }
                          setSelectedWidgetId(widget.id);
                          setInteraction({
                            widgetId: widget.id,
                            mode: "move",
                            startClientX: event.clientX,
                            startClientY: event.clientY,
                            initialX: widget.x,
                            initialY: widget.y,
                            initialWidth: widget.width,
                            initialHeight: widget.height,
                          });
                        }}
                        className="absolute cursor-move overflow-hidden rounded-2xl border px-3 py-3 shadow-lg"
                        style={{
                          left: widget.x * previewScale,
                          top: widget.y * previewScale,
                          width: widget.width * previewScale,
                          height: widget.height * previewScale,
                          borderColor: selected
                            ? "rgba(255, 122, 26, 0.42)"
                            : "rgba(124, 151, 171, 0.16)",
                          background: selected
                            ? "rgba(255, 122, 26, 0.16)"
                            : "rgba(16, 33, 44, 0.9)",
                          color: "var(--text-primary)",
                          touchAction: "none",
                        }}
                      >
                        <div
                          className="flex items-start justify-between gap-2"
                          style={{ fontSize: Math.max(10, previewScale * 14) }}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{title}</p>
                            <p className="mt-1 truncate uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
                              {widget.type}
                            </p>
                          </div>
                          <div
                            className="rounded-full border px-2 py-1 text-[10px]"
                            style={{ borderColor: "rgba(124,151,171,0.18)" }}
                          >
                            {widget.width}×{widget.height}
                          </div>
                        </div>
                        <div
                          className="mt-3"
                          style={{
                            fontSize: Math.max(9, previewScale * 11),
                            color: "var(--text-secondary)",
                          }}
                        >
                          {widget.x}, {widget.y}
                        </div>
                        <button
                          type="button"
                          aria-label={`Resize ${title}`}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            if (event.button !== 0) {
                              return;
                            }
                            setSelectedWidgetId(widget.id);
                            setInteraction({
                              widgetId: widget.id,
                              mode: "resize",
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                              initialX: widget.x,
                              initialY: widget.y,
                              initialWidth: widget.width,
                              initialHeight: widget.height,
                            });
                          }}
                          className="absolute bottom-2 right-2 h-5 w-5 rounded-full border"
                          style={{
                            borderColor: "rgba(99, 211, 189, 0.34)",
                            background: "rgba(99, 211, 189, 0.12)",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section
              className="rounded-3xl border p-4 md:p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-[var(--accent)]" />
                <h2
                  className="text-sm font-semibold uppercase tracking-[0.18em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Canvas
                </h2>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <NumericField
                  label="Width"
                  value={config.canvas.width}
                  min={320}
                  max={3840}
                  onChange={(value) =>
                    setConfig((current) =>
                      current
                        ? { ...current, canvas: { ...current.canvas, width: value } }
                        : current,
                    )
                  }
                />
                <NumericField
                  label="Height"
                  value={config.canvas.height}
                  min={240}
                  max={2160}
                  onChange={(value) =>
                    setConfig((current) =>
                      current
                        ? { ...current, canvas: { ...current.canvas, height: value } }
                        : current,
                    )
                  }
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {CANVAS_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setConfig((current) =>
                        current
                          ? {
                              ...current,
                              canvas: { width: preset.width, height: preset.height },
                            }
                          : current,
                      )
                    }
                    className="rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em]"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>

            <section
              className="rounded-3xl border p-4 md:p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                    Widget inspector
                  </h2>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Edit geometry and live properties for the selected section.
                  </p>
                </div>
                {selectedWidget && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={duplicateSelectedWidget}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                      aria-label="Duplicate widget"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={deleteSelectedWidget}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border"
                      style={{
                        borderColor: "rgba(251, 113, 133, 0.24)",
                        color: "#fecdd3",
                      }}
                      aria-label="Delete widget"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {selectedWidget ? (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <NumericField
                      label="X"
                      value={selectedWidget.x}
                      min={0}
                      max={config.canvas.width}
                      onChange={(value) =>
                        updateWidget(selectedWidget.id, (widget) => ({
                          ...widget,
                          x: value,
                        }))
                      }
                    />
                    <NumericField
                      label="Y"
                      value={selectedWidget.y}
                      min={0}
                      max={config.canvas.height}
                      onChange={(value) =>
                        updateWidget(selectedWidget.id, (widget) => ({
                          ...widget,
                          y: value,
                        }))
                      }
                    />
                    <NumericField
                      label="Width"
                      value={selectedWidget.width}
                      min={120}
                      max={config.canvas.width}
                      onChange={(value) =>
                        updateWidget(selectedWidget.id, (widget) => ({
                          ...widget,
                          width: value,
                        }))
                      }
                    />
                    <NumericField
                      label="Height"
                      value={selectedWidget.height}
                      min={80}
                      max={config.canvas.height}
                      onChange={(value) =>
                        updateWidget(selectedWidget.id, (widget) => ({
                          ...widget,
                          height: value,
                        }))
                      }
                    />
                  </div>

                  <div
                    className="rounded-2xl border px-3 py-3"
                    style={{
                      borderColor: "var(--border)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Type
                    </p>
                    <p
                      className="mt-2 text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {selectedWidget.type}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(selectedWidget.properties).map(([key, value]) => (
                      <PropertyField
                        key={key}
                        label={key}
                        value={value}
                        onChange={(nextValue) =>
                          updateWidget(selectedWidget.id, (widget) => ({
                            ...widget,
                            properties: {
                              ...widget.properties,
                              [key]: nextValue,
                            },
                          }))
                        }
                      />
                    ))}

                    {!Object.keys(selectedWidget.properties).length && (
                      <div
                        className="rounded-2xl border border-dashed px-4 py-6 text-sm"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        This widget has no editable properties in its current definition.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="mt-5 rounded-2xl border border-dashed px-4 py-8 text-center text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Select a widget on the canvas to inspect and edit it.
                </div>
              )}
            </section>

            <section
              className="rounded-3xl border p-4 md:p-5"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex flex-col gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
                    Widget palette
                  </h2>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Each screen exposes only the sections that belong to it, so the builder stays focused on real dashboard surfaces.
                  </p>
                </div>

                <label
                  className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  <Search className="h-4 w-4" />
                  <input
                    value={widgetSearch}
                    onChange={(event) => setWidgetSearch(event.target.value)}
                    placeholder="Search widgets"
                    className="bg-transparent outline-none placeholder:text-inherit"
                    style={{ color: "var(--text-primary)" }}
                  />
                </label>
              </div>

              <div className="mt-5 space-y-3">
                {filteredWidgetCatalog.map((widget) => (
                  <button
                    key={widget.type}
                    type="button"
                    onClick={() => addWidget(widget)}
                    className="w-full rounded-2xl border px-4 py-4 text-left transition-colors hover:border-[rgba(255,122,26,0.26)]"
                    style={{
                      borderColor: "var(--border)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {widget.name}
                        </h3>
                        <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                          {widget.description || "Screen widget"}
                        </p>
                      </div>
                      <div
                        className="rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em]"
                        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                      >
                        {widget.defaultWidth}×{widget.defaultHeight}
                      </div>
                    </div>
                  </button>
                ))}

                {!filteredWidgetCatalog.length && (
                  <div
                    className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    No widgets matched that search.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function BuilderLoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div
        className="min-h-[24rem] rounded-3xl border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      className="rounded-3xl border px-4 py-4"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
        {detail}
      </p>
    </div>
  );
}

function NumericField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={GRID_SIZE}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-2xl border px-3 py-2.5 text-sm outline-none"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-primary)",
          background: "rgba(255,255,255,0.03)",
        }}
      />
    </label>
  );
}

function PropertyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BuilderWidgetPrimitive;
  onChange: (value: BuilderWidgetPrimitive) => void;
}) {
  const prettyLabel = label
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .trim();

  if (typeof value === "boolean") {
    return (
      <label className="flex items-center justify-between rounded-2xl border px-3 py-3" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {prettyLabel}
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            Toggle this widget setting.
          </p>
        </div>
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    );
  }

  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
        {prettyLabel}
      </span>
      <input
        value={value ?? ""}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (typeof value === "number") {
            onChange(Number(nextValue));
            return;
          }

          onChange(nextValue);
        }}
        className="rounded-2xl border px-3 py-2.5 text-sm outline-none"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-primary)",
          background: "rgba(255,255,255,0.03)",
        }}
      />
    </label>
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "Unknown";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes <= 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
