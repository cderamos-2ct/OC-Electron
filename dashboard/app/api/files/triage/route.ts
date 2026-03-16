import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { guardMovePaths } from "@/lib/file-management-guards";
import {
  executeMove,
  loadInboxState,
  saveInboxState,
} from "@/lib/file-classification";
import type { MoveResult, Confidence } from "@/lib/file-classification";

interface TriageAction {
  src: string;
  dst: string;
  action: "approve" | "reject" | "skip";
  confidence?: Confidence;
}

export async function POST(req: NextRequest) {
  let body: { actions: TriageAction[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    return NextResponse.json({ error: "actions array is required" }, { status: 400 });
  }

  const inboxState = await loadInboxState();
  const results: MoveResult[] = [];

  for (const item of body.actions) {
    if (item.action === "skip") {
      continue;
    }

    if (item.action === "reject") {
      inboxState[item.src] = "rejected";
      results.push({ success: true, src: item.src, dst: item.dst, dryRun: false });
      continue;
    }

    // action === "approve"
    let guarded: { src: string; dst: string };
    try {
      const dstFile = path.join(item.dst, path.basename(item.src));
      guarded = guardMovePaths(item.src, dstFile);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ success: false, src: item.src, dst: item.dst, dryRun: false, error: message });
      continue;
    }

    const result = await executeMove(guarded.src, guarded.dst, {
      auto: false,
      confidence: item.confidence ?? "medium",
    });

    if (result.success) {
      inboxState[item.src] = "approved";
    }

    results.push(result);
  }

  await saveInboxState(inboxState);

  return NextResponse.json({ results });
}
