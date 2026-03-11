import { NextResponse } from "next/server";
import { normalizeBuilderConfig } from "@/lib/builder-types";
import {
  readDashboardScreenLayout,
  readDashboardScreenLayoutDefinition,
  resetDashboardScreenLayout,
  writeDashboardScreenLayout,
} from "@/lib/dashboard-layout-files";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ screen: string }> },
) {
  try {
    const { screen } = await context.params;
    const definition = readDashboardScreenLayoutDefinition(screen);
    const config = readDashboardScreenLayout(definition.key);

    return NextResponse.json({
      screen: definition.key,
      path: definition.path,
      label: definition.label,
      description: definition.description,
      widgets: definition.widgets,
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ screen: string }> },
) {
  try {
    const { screen } = await context.params;
    const definition = readDashboardScreenLayoutDefinition(screen);
    const body = (await request.json()) as {
      action?: string;
      config?: unknown;
    };

    if (body?.action === "reset") {
      const config = resetDashboardScreenLayout(definition.key);
      return NextResponse.json({ status: "ok", config });
    }

    const config = writeDashboardScreenLayout(
      definition.key,
      normalizeBuilderConfig(body?.config as never),
    );

    return NextResponse.json({
      status: "ok",
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}
