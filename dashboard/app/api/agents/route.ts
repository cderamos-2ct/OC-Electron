import { NextResponse } from "next/server";
import { createCanonicalAgent, listCanonicalAgents } from "@/lib/antigravity-agents";

export async function GET() {
  return NextResponse.json({
    defaultId: "cd",
    agents: listCanonicalAgents(),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(createCanonicalAgent(body), { status: 201 });
}
