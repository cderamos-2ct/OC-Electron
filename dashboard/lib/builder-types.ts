export type BuilderWidgetPrimitive = string | number | boolean | null;

export type BuilderWidget = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: Record<string, BuilderWidgetPrimitive>;
};

export type BuilderConfig = {
  canvas: {
    width: number;
    height: number;
  };
  widgets: BuilderWidget[];
};

export type BuilderTemplateWidgetType = {
  type: string;
  name: string;
  icon?: string;
  count: number;
};

export type BuilderTemplateMeta = {
  id: string;
  name: string;
  description?: string;
  author?: string;
  tags?: string[];
  canvasSize?: string;
  widgetCount?: number;
  widgetTypes?: BuilderTemplateWidgetType[];
  preview?: string;
};

export type BuilderWidgetDefinition = {
  type: string;
  name: string;
  icon?: string;
  category?: string;
  description?: string;
  defaultWidth: number;
  defaultHeight: number;
  properties: Record<string, BuilderWidgetPrimitive>;
  preview?: string;
  hasApiKey?: boolean;
  apiKeyName?: string | null;
};

export function cloneBuilderConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeBuilderConfig(value?: Partial<BuilderConfig> | null): BuilderConfig {
  const canvas = value?.canvas;
  const widgets = Array.isArray(value?.widgets) ? value?.widgets : [];

  return {
    canvas: {
      width: Number.isFinite(canvas?.width) ? Number(canvas?.width) : 1920,
      height: Number.isFinite(canvas?.height) ? Number(canvas?.height) : 1080,
    },
    widgets: widgets.map((widget, index) => ({
      id: widget.id || `widget-${index + 1}`,
      type: widget.type || "unknown",
      x: Number.isFinite(widget.x) ? Number(widget.x) : 0,
      y: Number.isFinite(widget.y) ? Number(widget.y) : 0,
      width: Number.isFinite(widget.width) ? Number(widget.width) : 240,
      height: Number.isFinite(widget.height) ? Number(widget.height) : 140,
      properties:
        widget.properties && typeof widget.properties === "object"
          ? (widget.properties as Record<string, BuilderWidgetPrimitive>)
          : {},
    })),
  };
}
