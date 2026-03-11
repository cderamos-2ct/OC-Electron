import { NextResponse } from "next/server";
import { getOpsSummary } from "@/lib/antigravity-tasks";

export async function GET() {
  return NextResponse.json(getOpsSummary());
}
