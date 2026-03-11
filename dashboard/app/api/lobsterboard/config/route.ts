import { NextResponse } from "next/server";
import type { BuilderConfig } from "@/lib/builder-types";
import {
  readLobsterboardConfig,
  writeLobsterboardConfig,
} from "@/lib/lobsterboard-files";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(readLobsterboardConfig());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BuilderConfig;
    const saved = writeLobsterboardConfig(body);

    return NextResponse.json({
      status: "ok",
      message: "Builder config saved.",
      config: saved,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
