import { NextResponse } from "next/server";
import { spawnOpsTask } from "@/lib/antigravity-tasks";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return NextResponse.json(spawnOpsTask(id));
}
