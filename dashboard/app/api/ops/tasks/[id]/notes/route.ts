import { NextResponse } from "next/server";
import { addOpsTaskNote } from "@/lib/antigravity-tasks";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json();
  return NextResponse.json(addOpsTaskNote(id, String(body.text || "")), { status: 201 });
}
