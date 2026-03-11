import { NextResponse } from "next/server";
import { spawnOpsTaskBatch } from "@/lib/antigravity-tasks";

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(spawnOpsTaskBatch(Array.isArray(body.taskIds) ? body.taskIds : []));
}
