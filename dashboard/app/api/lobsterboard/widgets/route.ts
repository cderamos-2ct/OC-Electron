import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { NextResponse } from "next/server";
import type { BuilderWidgetDefinition } from "@/lib/builder-types";

export const runtime = "nodejs";

function loadWidgetCatalog() {
  const widgetsPath = path.resolve(process.cwd(), "../LobsterBoard/js/widgets.js");
  const source = fs.readFileSync(widgetsPath, "utf8");

  const sandbox: {
    module: { exports: Record<string, unknown> };
    exports: Record<string, unknown>;
    window: Record<string, unknown>;
    EventSource: () => void;
    console: Pick<Console, "warn" | "error" | "log">;
  } = {
    module: { exports: {} },
    exports: {},
    window: {},
    EventSource: () => {},
    console,
  };

  vm.runInNewContext(source, sandbox, {
    filename: widgetsPath,
  });

  const widgets = sandbox.module.exports as Record<string, any>;

  return Object.entries(widgets)
    .map<BuilderWidgetDefinition>(([type, definition]) => ({
      type,
      name: definition.name ?? type,
      icon: definition.icon ?? "",
      category: definition.category ?? "",
      description: definition.description ?? "",
      defaultWidth: Number(definition.defaultWidth ?? 240),
      defaultHeight: Number(definition.defaultHeight ?? 140),
      properties: JSON.parse(JSON.stringify(definition.properties ?? {})),
      preview: typeof definition.preview === "string" ? definition.preview : "",
      hasApiKey: Boolean(definition.hasApiKey),
      apiKeyName: definition.apiKeyName ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function GET() {
  try {
    return NextResponse.json(loadWidgetCatalog());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
