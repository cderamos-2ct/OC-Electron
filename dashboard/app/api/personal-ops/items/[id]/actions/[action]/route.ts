import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { CommsBoardItem, CommsBucketKey } from "@/lib/personal-ops-types";
import { COMMS_BUCKETS } from "@/lib/personal-ops-types";
import { getPersonalOpsSnapshot } from "@/lib/personal-ops-store";

const WORKSPACE_ROOT = process.env.OPENCLAW_DATA_DIR || "/Volumes/Storage/OpenClaw-Data";
const OVERLAY_PATH = path.join(WORKSPACE_ROOT, "evidence", "personal-ops", "comms-board.json");
const TASKS_DIR = path.join(WORKSPACE_ROOT, "tasks", "items");

type OverlayFile = {
  version: number;
  updatedAt: string;
  items: CommsBoardItem[];
};

function readOverlay(): OverlayFile {
  try {
    const raw = fs.readFileSync(OVERLAY_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<OverlayFile>;
    return {
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      items: Array.isArray(parsed.items) ? parsed.items : [],
    };
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), items: [] };
  }
}

function writeOverlay(overlay: OverlayFile): void {
  overlay.updatedAt = new Date().toISOString();
  fs.writeFileSync(OVERLAY_PATH, JSON.stringify(overlay, null, 2), "utf8");
}

function findOrSeedItem(overlay: OverlayFile, itemId: string): { item: CommsBoardItem; fromSeed: boolean } | null {
  const existing = overlay.items.find((i) => i.id === itemId);
  if (existing) {
    return { item: existing, fromSeed: false };
  }

  // Fall through to seed snapshot to find the item
  try {
    const snapshot = getPersonalOpsSnapshot();
    const seedItem = COMMS_BUCKETS.flatMap((b) => snapshot.board.buckets[b]).find((i) => i.id === itemId);
    if (seedItem) {
      return { item: { ...seedItem }, fromSeed: true };
    }
  } catch {
    // ignore
  }

  return null;
}

function upsertItem(overlay: OverlayFile, item: CommsBoardItem): void {
  const idx = overlay.items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    overlay.items[idx] = item;
  } else {
    overlay.items.push(item);
  }
}

function nextRunId(): string {
  try {
    const files = fs.readdirSync(TASKS_DIR);
    const nums = files
      .map((f) => f.match(/^RUN-(\d+)\.md$/))
      .filter(Boolean)
      .map((m) => parseInt(m![1], 10));
    const max = nums.length > 0 ? Math.max(...nums) : 64;
    return `RUN-${String(max + 1).padStart(3, "0")}`;
  } catch {
    return "RUN-065";
  }
}

function createTaskFile(taskId: string, item: CommsBoardItem): void {
  const now = new Date().toISOString();
  const content = [
    `---`,
    `id: "${taskId}"`,
    `title: "Personal Ops: ${item.subject}"`,
    `status: "open"`,
    `priority: "medium"`,
    `owner_agent: "main"`,
    `agent_type: "orchestrator"`,
    `created_at: "${now}"`,
    `updated_at: "${now}"`,
    `tags:`,
    `  - "personal-ops"`,
    `  - "comms"`,
    `  - "${item.sourceKind}"`,
    `artifacts: []`,
    `---`,
    ``,
    `# ${taskId}: Personal Ops — ${item.subject}`,
    ``,
    `**Source:** ${item.sourceKind} / ${item.sourceAccount}`,
    `**Thread:** ${item.sourceThreadId}`,
    `**Participants:** ${item.participants.join(", ")}`,
    `**Original Bucket:** ${item.bucket}`,
    `**Promoted from comms item:** \`${item.id}\``,
    ``,
    `## Summary`,
    ``,
    item.snippet,
    ``,
    `## Status Note`,
    ``,
    item.statusNote ?? "_No status note._",
    ``,
    `## Suggested Action`,
    ``,
    item.suggestedAction ?? "_No suggested action._",
    ``,
  ].join("\n");

  fs.writeFileSync(path.join(TASKS_DIR, `${taskId}.md`), content, "utf8");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  const { id: itemId, action } = await context.params;

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const overlay = readOverlay();
  const found = findOrSeedItem(overlay, itemId);

  if (!found) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const item: CommsBoardItem = { ...found.item };

  switch (action) {
    case "promote_to_task": {
      const taskId = nextRunId();
      createTaskFile(taskId, item);
      item.linkedTaskId = taskId;
      item.provenance = [...new Set([...item.provenance, "task_promoted"])] as CommsBoardItem["provenance"];
      break;
    }

    case "attach_task": {
      const taskId = body.taskId;
      if (typeof taskId !== "string" || !taskId.trim()) {
        return NextResponse.json({ error: "taskId is required" }, { status: 400 });
      }
      item.linkedTaskId = taskId.trim();
      break;
    }

    case "mark_waiting": {
      const waitingOn = body.waitingOn;
      if (typeof waitingOn !== "string" || !waitingOn.trim()) {
        return NextResponse.json({ error: "waitingOn is required" }, { status: 400 });
      }
      item.bucket = "waiting" as CommsBucketKey;
      item.waitingOn = waitingOn.trim();
      break;
    }

    case "mark_follow_up": {
      const followUpAt = body.followUpAt;
      if (typeof followUpAt !== "string" || !followUpAt.trim()) {
        return NextResponse.json({ error: "followUpAt is required" }, { status: 400 });
      }
      item.bucket = "follow_up" as CommsBucketKey;
      item.followUpAt = followUpAt.trim();
      break;
    }

    case "ask_cd": {
      const message = body.message;
      if (typeof message !== "string" || !message.trim()) {
        return NextResponse.json({ error: "message is required" }, { status: 400 });
      }
      // Log the ask_cd request — CD routing will be wired in a later slice
      console.log(`[personal-ops] ask_cd for item ${itemId}:`, message.trim());
      break;
    }

    case "archive_reference": {
      item.bucket = "reference" as CommsBucketKey;
      break;
    }

    case "mark_junk": {
      item.bucket = "junk" as CommsBucketKey;
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  upsertItem(overlay, item);
  writeOverlay(overlay);

  return NextResponse.json({ ok: true, item });
}
