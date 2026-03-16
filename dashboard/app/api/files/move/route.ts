import { NextRequest, NextResponse } from "next/server";
import { guardMovePaths } from "@/lib/file-management-guards";
import { executeMove } from "@/lib/file-classification";
import type { Confidence } from "@/lib/file-classification";

export async function POST(req: NextRequest) {
  let body: { src: string; dst: string; dryRun?: boolean; auto?: boolean; confidence?: Confidence };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.src || !body.dst) {
    return NextResponse.json({ error: "src and dst are required" }, { status: 400 });
  }

  let guarded: { src: string; dst: string };
  try {
    guarded = guardMovePaths(body.src, body.dst);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const result = await executeMove(guarded.src, guarded.dst, {
    dryRun: body.dryRun ?? false,
    auto: body.auto ?? false,
    confidence: body.confidence ?? "low",
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
