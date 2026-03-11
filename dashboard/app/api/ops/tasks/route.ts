import { NextResponse } from "next/server";
import { createOpsTask, listOpsTasks } from "@/lib/antigravity-tasks";

export async function GET() {
  return NextResponse.json(listOpsTasks());
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(createOpsTask(body), { status: 201 });
}
