import { NextResponse } from "next/server";
import { createCanonicalAgent, listCanonicalAgents } from "@/lib/antigravity-agents";
import { getServerVisibilitySummary } from "@/lib/antigravity-tasks";

export async function GET() {
  const visibility = getServerVisibilitySummary();
  return NextResponse.json({
    defaultId: "cd",
    agents: visibility.agents ?? listCanonicalAgents(),
    visibility,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(createCanonicalAgent(body), { status: 201 });
}
