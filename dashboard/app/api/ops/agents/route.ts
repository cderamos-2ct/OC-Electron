import { NextResponse } from "next/server";
import { getOpsSummary, getServerVisibilitySummary } from "@/lib/antigravity-tasks";

export async function GET() {
  return NextResponse.json({
    ops: getOpsSummary(),
    visibility: getServerVisibilitySummary(),
  });
}
