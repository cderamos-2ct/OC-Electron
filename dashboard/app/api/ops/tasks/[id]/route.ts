import { NextResponse } from "next/server";
import { updateOpsTask } from "@/lib/antigravity-tasks";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json();
  return NextResponse.json(updateOpsTask(id, body));
}
