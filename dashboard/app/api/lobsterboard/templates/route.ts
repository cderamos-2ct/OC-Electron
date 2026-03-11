import { NextResponse } from "next/server";
import { readLobsterboardTemplates } from "@/lib/lobsterboard-files";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(readLobsterboardTemplates());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
