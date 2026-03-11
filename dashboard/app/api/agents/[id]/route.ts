import { NextResponse } from "next/server";
import { deleteCanonicalAgent, getCanonicalAgent, updateCanonicalAgent } from "@/lib/antigravity-agents";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return NextResponse.json(getCanonicalAgent(id));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json();
  return NextResponse.json(updateCanonicalAgent(id, body));
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return NextResponse.json(deleteCanonicalAgent(id));
}
