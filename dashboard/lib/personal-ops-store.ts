import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { OpsTask } from "@/lib/ops-types";
import { listOpsTasks } from "@/lib/antigravity-tasks";
import {
  COMMS_BUCKETS,
  type AttentionCenterModule,
  type CommsBoardItem,
  type CommsBucketKey,
  type PersonalOpsActionDescriptor,
  type PersonalOpsEvidenceRef,
  type PersonalOpsInteractionMode,
  type PersonalOpsItemDetail,
  type PersonalOpsLinkedTask,
  type PersonalOpsSnapshot,
  type PersonalOpsSourceKind,
  type PersonalOpsSourceType,
} from "@/lib/personal-ops-types";

const ROOT_DIR = process.env.OPENCLAW_DATA_DIR || "/Volumes/Storage/OpenClaw-Data";
const OVERLAY_DIR = path.join(ROOT_DIR, "evidence", "personal-ops");
const OVERLAY_PATH = path.join(OVERLAY_DIR, "comms-board.json");
const RUN_045_PATH = path.join(ROOT_DIR, "tasks", "items", "RUN-045.md");
const OPS_019_PATH = path.join(ROOT_DIR, "tasks", "items", "OPS-019.md");
const OPS_021_PATH = path.join(ROOT_DIR, "tasks", "items", "OPS-021.md");
const BRIEF_PATH = path.join(ROOT_DIR, "details", "plans", "PERSONAL_OPS_ATTENTION_CENTER_SLICE_BRIEF.md");

function createBucketRecord<T>(factory: () => T): Record<CommsBucketKey, T> {
  return {
    urgent: factory(),
    needs_reply: factory(),
    follow_up: factory(),
    waiting: factory(),
    reference: factory(),
    junk: factory(),
  };
}

function toLinkedTaskSummary(task: OpsTask): PersonalOpsLinkedTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    ownerAgent: task.assignee || null,
    updatedAt: task.updatedAt,
  };
}

function loadTaskMap() {
  try {
    return new Map(listOpsTasks().map((task) => [task.id, toLinkedTaskSummary(task)]));
  } catch {
    return new Map<string, PersonalOpsLinkedTask>();
  }
}

function normalizeDate(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

function taskEvidence(taskMap: Map<string, PersonalOpsLinkedTask>, taskId: string, occurredAt: string): PersonalOpsEvidenceRef | null {
  const task = taskMap.get(taskId);
  if (!task) {
    return null;
  }

  return {
    id: `task:${task.id}`,
    kind: "task",
    title: task.title,
    subtitle: `${task.status} · ${task.priority}`,
    snippet: task.ownerAgent ? `Owner: ${task.ownerAgent}` : "Owner not assigned.",
    occurredAt: normalizeDate(task.updatedAt, occurredAt),
    metadata: {
      taskId: task.id,
      status: task.status,
      ownerAgent: task.ownerAgent,
    },
  };
}

function seedEvidence(
  evidence: Omit<PersonalOpsEvidenceRef, "id"> & { id?: string },
): PersonalOpsEvidenceRef {
  return {
    id: evidence.id ?? `${evidence.kind}:${evidence.title}:${evidence.occurredAt}`,
    ...evidence,
  };
}

function inferSourceType(sourceKind: CommsBoardItem["sourceKind"]): PersonalOpsSourceType {
  switch (sourceKind) {
    case "gmail_thread": return "email";
    case "message_thread": return "message";
    default: return "email";
  }
}

function buildSeedItems(taskMap: Map<string, PersonalOpsLinkedTask>): CommsBoardItem[] {
  const run047 = taskMap.get("RUN-047") ?? null;
  const run048 = taskMap.get("RUN-048") ?? null;
  const run053 = taskMap.get("RUN-053") ?? null;
  const run054 = taskMap.get("RUN-054") ?? null;

  return [
    {
      id: "gmail:visualgraphx:security-alert-2026-02-22",
      bucket: "urgent",
      sourceKind: "gmail_thread",
      source_type: "email" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "cderamos@gmail.com",
      sourceThreadId: "19c858ae852bba23",
      participants: ["Google"],
      displayName: "Google",
      subject: "Security alert",
      snippet: "New sign-in to your account needs confirmation before it can be closed as stale reminder residue.",
      latestAt: "2026-02-22T13:29:57Z",
      latestDirection: "inbound",
      ownerAgentId: run053?.ownerAgent ?? "main",
      linkedTaskId: run053?.id ?? "RUN-053",
      linkedTask: run053,
      statusNote: "Urgent because the remaining blocker is explicit human confirmation of whether the sign-in was expected.",
      suggestedAction: "Confirm whether the 2026-02-22 sign-in was expected, then close or escalate the security lane.",
      provenance: ["imported", "task_promoted"],
      evidence: [
        seedEvidence({
          kind: "gmail_thread",
          title: "Security alert",
          subtitle: "Google <no-reply@accounts.google.com>",
          snippet: "New sign-in to your account for cderamos@gmail.com.",
          sourceAccount: "cderamos@gmail.com",
          occurredAt: "2026-02-22T13:29:57Z",
          metadata: {
            threadId: "19c858ae852bba23",
          },
        }),
        taskEvidence(taskMap, "RUN-053", "2026-03-12T19:00:00Z"),
      ].filter(Boolean) as PersonalOpsEvidenceRef[],
      supportingContext: [
        seedEvidence({
          kind: "reminder",
          title: "Action: Security alert for cderamos@gmail.com",
          subtitle: "Tasks - AG",
          snippet: "Reminder promoted into canonical task state because it is direct attention/security work.",
          occurredAt: "2026-03-12T17:15:00Z",
        }),
      ],
    },
    {
      id: "gmail:visualgraphx:david-cannon-tupelo",
      bucket: "needs_reply",
      sourceKind: "gmail_thread",
      source_type: "email" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "christian@visualgraphx.com",
      sourceThreadId: "19cde65cc47d1030",
      participants: ["David Cannon"],
      displayName: "David Cannon",
      subject: "Tupelo Honey requirements",
      snippet: "Substantive requirements email with invoice samples; this is estimate/build packet work, not passive inbox residue.",
      latestAt: "2026-03-11T20:00:00Z",
      latestDirection: "inbound",
      ownerAgentId: run047?.ownerAgent ?? "main",
      linkedTaskId: run047?.id ?? "RUN-047",
      linkedTask: run047,
      statusNote: "Latest human inbound needs a concrete owner path and internal packet before any external reply.",
      suggestedAction: "Turn the thread into an internal implementation/estimate packet and recover the Tupelo store map plus SFTP spec.",
      provenance: ["imported", "task_promoted"],
      evidence: [
        seedEvidence({
          kind: "gmail_thread",
          title: "Tupelo Honey requirements",
          subtitle: "David Cannon <dcannon@pro-matters.com>",
          snippet: "Invoice pack and CSV sample prove multi-vendor extraction plus ship-to based store resolution.",
          sourceAccount: "christian@visualgraphx.com",
          occurredAt: "2026-03-11T20:00:00Z",
          metadata: {
            threadId: "19cde65cc47d1030",
          },
        }),
        seedEvidence({
          kind: "gmail_thread",
          title: "CSV Sample for Tupelo",
          subtitle: "Companion evidence thread",
          snippet: "Defines the output contract: Vendor Name, Invoice Number, Invoice Date, Store Number, Total, File Path.",
          sourceAccount: "christian@visualgraphx.com",
          occurredAt: "2026-03-11T19:45:00Z",
          metadata: {
            threadId: "19cde54a0bab9795",
          },
        }),
        taskEvidence(taskMap, "RUN-047", "2026-03-12T15:15:00Z"),
      ].filter(Boolean) as PersonalOpsEvidenceRef[],
      supportingContext: [],
    },
    {
      id: "message:fluid-collar-spec-question",
      bucket: "needs_reply",
      sourceKind: "message_thread",
      source_type: "message" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "Messages",
      sourceThreadId: "+12143352222",
      participants: ["+12143352222"],
      displayName: "+12143352222",
      subject: "Fluid collar hardware / air requirement question",
      snippet: "Asked whether the hardware is hardwire, single-phase, or three-phase and what the air requirements are.",
      latestAt: "2026-03-11T18:00:00Z",
      latestDirection: "inbound",
      ownerAgentId: run048?.ownerAgent ?? "main",
      linkedTaskId: run048?.id ?? "RUN-048",
      linkedTask: run048,
      statusNote: "Still an unanswered inbound technical question with no source-confirmed reply drafted yet.",
      suggestedAction: "Confirm the spec source and prepare a concise approved reply.",
      provenance: ["imported", "task_promoted"],
      evidence: [
        seedEvidence({
          kind: "message_thread",
          title: "Fluid collar technical SMS",
          subtitle: "+12143352222",
          snippet: "What are the air requirements on the fluid collar, and is the hardware single-phase or three-phase?",
          sourceHandle: "+12143352222",
          occurredAt: "2026-03-11T18:00:00Z",
        }),
        taskEvidence(taskMap, "RUN-048", "2026-03-12T13:55:00Z"),
      ].filter(Boolean) as PersonalOpsEvidenceRef[],
      supportingContext: [],
    },
    {
      id: "message:family-pickup-plan",
      bucket: "needs_reply",
      sourceKind: "message_thread",
      source_type: "message" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "Messages",
      sourceThreadId: "+16028042022",
      participants: ["+16028042022"],
      displayName: "+16028042022",
      subject: "Pick up plan?",
      snippet: "Family/logistics thread is still sitting as inbound reply debt.",
      latestAt: "2026-03-11T17:10:00Z",
      latestDirection: "inbound",
      statusNote: "No canonical task yet because this looks like a straightforward reply instead of a deeper work packet.",
      suggestedAction: "Prepare a one-message logistics response or route it into a follow-up slot.",
      provenance: ["imported"],
      evidence: [
        seedEvidence({
          kind: "message_thread",
          title: "Pick up plan?",
          subtitle: "Family/logistics SMS",
          snippet: "Latest visible message is a direct question with no captured response.",
          sourceHandle: "+16028042022",
          occurredAt: "2026-03-11T17:10:00Z",
        }),
      ],
      supportingContext: [],
    },
    {
      id: "gmail:visualgraphx:eric-clarity-sow",
      bucket: "follow_up",
      sourceKind: "gmail_thread",
      source_type: "email" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "christian@visualgraphx.com",
      sourceThreadId: "19cddeb65480c012",
      participants: ["Eric Rosenfeld"],
      displayName: "Eric Rosenfeld",
      subject: "Change to Clarity SOW meeting",
      snippet: "Meeting prep/follow-up thread is active; the next move depends on what came out of the meeting, not another generic outbound call.",
      latestAt: "2026-03-12T20:30:00Z",
      latestDirection: "mixed",
      ownerAgentId: run054?.ownerAgent ?? "main",
      linkedTaskId: run054?.id ?? "RUN-054",
      linkedTask: run054,
      followUpAt: "2026-03-12T22:00:00Z",
      statusNote: "Treat today’s Clarity SOW meeting as the immediate next move, then classify the lane as waiting or follow-up based on outcomes.",
      suggestedAction: "Capture the post-meeting decision and either set a follow-up date or move the thread into waiting.",
      provenance: ["imported", "task_promoted"],
      evidence: [
        seedEvidence({
          kind: "gmail_thread",
          title: "Change to Clarity SOW meeting",
          subtitle: "Eric Rosenfeld",
          snippet: "Christian already replied that the new time works, but he needs to leave by 2:45 PM.",
          sourceAccount: "christian@visualgraphx.com",
          occurredAt: "2026-03-12T19:25:00Z",
          metadata: {
            threadId: "19cddeb65480c012",
          },
        }),
        taskEvidence(taskMap, "RUN-054", "2026-03-12T19:25:17Z"),
      ].filter(Boolean) as PersonalOpsEvidenceRef[],
      supportingContext: [
        seedEvidence({
          kind: "calendar_event",
          title: "Christian De Ramos and Eric Rosenfeld",
          subtitle: "Calendar support context",
          snippet: "2026-03-12 1:30 PM - 2:30 PM MST",
          occurredAt: "2026-03-12T20:30:00Z",
        }),
        seedEvidence({
          kind: "reminder",
          title: "Call Eric Rosenfeld",
          subtitle: "Tasks - AG",
          snippet: "Reminder lane was reconciled against Gmail and Calendar so it can become tracked prep/follow-up work.",
          occurredAt: "2026-03-12T17:15:00Z",
        }),
      ],
    },
    {
      id: "message:review-right-away",
      bucket: "follow_up",
      sourceKind: "message_thread",
      source_type: "message" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "Messages",
      sourceThreadId: "+16023270462",
      participants: ["+16023270462"],
      displayName: "+16023270462",
      subject: "Promised immediate review",
      snippet: "Christian already said he would review something right away, so this should live in follow-up rather than ambient memory.",
      latestAt: "2026-03-11T16:15:00Z",
      latestDirection: "outbound",
      followUpAt: "2026-03-12T18:00:00Z",
      statusNote: "Represents promise debt, not new reply debt.",
      suggestedAction: "Either reply with the review result or push the follow-up date if work is still in motion.",
      provenance: ["imported"],
      evidence: [
        seedEvidence({
          kind: "message_thread",
          title: "Review promise",
          subtitle: "+16023270462",
          snippet: "Christian promised he would review something right away.",
          sourceHandle: "+16023270462",
          occurredAt: "2026-03-11T16:15:00Z",
        }),
      ],
      supportingContext: [],
    },
    {
      id: "gmail:visualgraphx:onevision-ticket",
      bucket: "waiting",
      sourceKind: "gmail_thread",
      source_type: "email" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "christian@visualgraphx.com",
      sourceThreadId: "onevision-us-59355625",
      participants: ["Support.US@onevision.com"],
      displayName: "Support.US@onevision.com",
      subject: "US 59355625",
      snippet: "Support asked for screenshots and before/after files; Christian replied that the issue still exists but he used a workaround.",
      latestAt: "2026-03-11T15:45:00Z",
      latestDirection: "mixed",
      waitingOn: "OneVision support",
      followUpAt: "2026-03-13T18:00:00Z",
      statusNote: "This belongs in waiting until support returns or artifacts need to be collected.",
      suggestedAction: "Check back on support response or attach artifacts when they are ready.",
      provenance: ["imported"],
      evidence: [
        seedEvidence({
          kind: "gmail_thread",
          title: "US 59355625",
          subtitle: "Support.US@onevision.com",
          snippet: "Support thread is already in external-waiting state rather than fresh reply debt.",
          sourceAccount: "christian@visualgraphx.com",
          occurredAt: "2026-03-11T15:45:00Z",
        }),
      ],
      supportingContext: [],
    },
    {
      id: "gmail:visualgraphx:vg-accounting-overdue",
      bucket: "waiting",
      sourceKind: "gmail_thread",
      source_type: "email" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "christian@visualgraphx.com",
      sourceThreadId: "vg-accounting-90-days-overdue",
      participants: ["VG Accounting", "Andy"],
      displayName: "VG Accounting",
      subject: "90 Days Overdue Invoices",
      snippet: "Christian already forwarded this internally to Andy, so the thread is waiting on internal feedback instead of sitting as inbox residue.",
      latestAt: "2026-03-11T14:15:00Z",
      latestDirection: "mixed",
      waitingOn: "Andy",
      followUpAt: "2026-03-13T17:00:00Z",
      statusNote: "Keep it visible as waiting-on-others rather than re-triaging the same finance thread.",
      suggestedAction: "Confirm whether Andy has cleared the overdue invoice path.",
      provenance: ["imported"],
      evidence: [
        seedEvidence({
          kind: "gmail_thread",
          title: "90 Days Overdue Invoices",
          subtitle: "VG Accounting",
          snippet: "Forwarded internally, now explicitly waiting on Andy.",
          sourceAccount: "christian@visualgraphx.com",
          occurredAt: "2026-03-11T14:15:00Z",
        }),
      ],
      supportingContext: [],
    },
    {
      id: "gmail:visualgraphx:lease-review",
      bucket: "waiting",
      sourceKind: "gmail_thread",
      source_type: "email" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "christian@visualgraphx.com",
      sourceThreadId: "mark-smith-lease-review",
      participants: ["Mark Smith"],
      displayName: "Mark Smith",
      subject: "Lease review",
      snippet: "The thread has advanced to an external waiting state around broker/red-line response instead of immediate reply debt.",
      latestAt: "2026-03-11T13:30:00Z",
      latestDirection: "mixed",
      waitingOn: "Broker / red-line response",
      followUpAt: "2026-03-14T18:00:00Z",
      statusNote: "Waiting on external edits before it returns to active attention.",
      suggestedAction: "Recheck once the broker or red-line path moves.",
      provenance: ["imported"],
      evidence: [
        seedEvidence({
          kind: "gmail_thread",
          title: "Lease review",
          subtitle: "Mark Smith",
          snippet: "RUN-045 classified this as external waiting rather than immediate reply work.",
          sourceAccount: "christian@visualgraphx.com",
          occurredAt: "2026-03-11T13:30:00Z",
        }),
      ],
      supportingContext: [],
    },
    {
      id: "message:srp-payment",
      bucket: "reference",
      sourceKind: "message_thread",
      source_type: "message" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "Messages",
      sourceThreadId: "srp-short-code",
      participants: ["SRP"],
      displayName: "SRP",
      subject: "Payment confirmation",
      snippet: "Useful record, not current attention debt.",
      latestAt: "2026-03-11T12:20:00Z",
      latestDirection: "mixed",
      statusNote: "Reference by default so confirmations stay visible without inflating critical counts.",
      suggestedAction: "Leave available as context only.",
      provenance: ["imported"],
      evidence: [
        seedEvidence({
          kind: "message_thread",
          title: "SRP payment short-code",
          subtitle: "Automated confirmation",
          snippet: "Reference/automated thread from the first Messages sweep.",
          sourceHandle: "SRP",
          occurredAt: "2026-03-11T12:20:00Z",
        }),
      ],
      supportingContext: [],
    },
    {
      id: "message:dmv-scam",
      bucket: "junk",
      sourceKind: "message_thread",
      source_type: "message" as PersonalOpsSourceType,
      interaction_mode: "triage" as PersonalOpsInteractionMode,
      sourceAccount: "Messages",
      sourceThreadId: "dmv-suspension-scam",
      participants: ["Unknown sender"],
      displayName: "Unknown sender",
      subject: "DMV suspension warning",
      snippet: "Explicit junk/scam traffic from the first Messages sweep.",
      latestAt: "2026-03-11T11:00:00Z",
      latestDirection: "inbound",
      statusNote: "Keep visible in the model, collapsed out of attention-critical flows.",
      suggestedAction: "Mark junk and keep it out of the working set.",
      provenance: ["imported"],
      evidence: [
        seedEvidence({
          kind: "message_thread",
          title: "DMV suspension scam text",
          subtitle: "Scam / junk",
          snippet: "Identified as junk during the first Messages audit.",
          sourceHandle: "Unknown sender",
          occurredAt: "2026-03-11T11:00:00Z",
        }),
      ],
      supportingContext: [],
    },
  ];
}

function sortBoardItems(items: CommsBoardItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.followUpAt ?? left.latestAt);
    const rightTime = Date.parse(right.followUpAt ?? right.latestAt);
    return rightTime - leftTime;
  });
}

function buildAttentionModules(items: CommsBoardItem[]): AttentionCenterModule[] {
  const toModuleItem = (item: CommsBoardItem, subtitle?: string | null) => ({
    id: item.id,
    title: item.subject,
    subtitle: subtitle ?? item.displayName,
    bucket: item.bucket,
    latestAt: item.followUpAt ?? item.latestAt,
    linkedTaskId: item.linkedTaskId ?? null,
    route: {
      kind: "board_item" as const,
      id: item.id,
    },
  });

  const needsReply = items
    .filter((item) => item.bucket === "urgent" || item.bucket === "needs_reply")
    .sort((left, right) => {
      const leftRank = left.bucket === "urgent" ? 2 : 1;
      const rightRank = right.bucket === "urgent" ? 2 : 1;
      return rightRank - leftRank || Date.parse(right.latestAt) - Date.parse(left.latestAt);
    });
  const waiting = items.filter((item) => item.bucket === "waiting").sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));
  const followUps = items
    .filter((item) => item.bucket === "follow_up")
    .sort((a, b) => Date.parse(a.followUpAt ?? a.latestAt) - Date.parse(b.followUpAt ?? b.latestAt));
  const meetingContext = items
    .filter((item) => item.supportingContext.some((entry) => entry.kind === "calendar_event"))
    .sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));
  const contextToProcess = items
    .filter((item) => item.supportingContext.some((entry) => entry.kind === "reminder" || entry.kind === "meeting_recap" || entry.kind === "note"))
    .sort((a, b) => Date.parse(b.latestAt) - Date.parse(a.latestAt));
  const risks = items
    .filter((item) =>
      item.bucket === "urgent"
      || (item.bucket === "waiting" && Boolean(item.followUpAt))
      || (item.bucket === "follow_up" && Boolean(item.followUpAt)),
    )
    .sort((a, b) => Date.parse(b.followUpAt ?? b.latestAt) - Date.parse(a.followUpAt ?? a.latestAt));

  return [
    {
      key: "needs_reply_now",
      label: "Needs Reply Now",
      description: "Urgent and inbound human threads that need a next move today.",
      total: needsReply.length,
      items: needsReply.slice(0, 4).map((item) => toModuleItem(item, item.suggestedAction ?? item.displayName)),
    },
    {
      key: "waiting_on_others",
      label: "Waiting on Others",
      description: "Threads where the next move belongs to a third party, but the lane still needs watchfulness.",
      total: waiting.length,
      items: waiting.slice(0, 4).map((item) => toModuleItem(item, item.waitingOn ? `Waiting on ${item.waitingOn}` : item.displayName)),
    },
    {
      key: "followups_due",
      label: "Follow-Ups Due Back",
      description: "Promises and loops that need a deliberate return pass.",
      total: followUps.length,
      items: followUps.slice(0, 4).map((item) => toModuleItem(item, item.followUpAt ? `Follow up by ${item.followUpAt}` : item.displayName)),
    },
    {
      key: "meetings_today_next",
      label: "Meetings Today / Next",
      description: "Calendar-linked context that changes how a comms thread should be handled.",
      total: meetingContext.length,
      items: meetingContext.slice(0, 4).map((item) => {
        const event = item.supportingContext.find((entry) => entry.kind === "calendar_event");
        return toModuleItem(item, event?.title ?? item.displayName);
      }),
    },
    {
      key: "new_context_to_process",
      label: "New Context To Process",
      description: "Reminder and recap evidence that should be processed into a concrete next state.",
      total: contextToProcess.length,
      items: contextToProcess.slice(0, 4).map((item) => {
        const context = item.supportingContext.find((entry) => entry.kind === "reminder" || entry.kind === "meeting_recap" || entry.kind === "note");
        return toModuleItem(item, context?.title ?? item.displayName);
      }),
    },
    {
      key: "risks_overdue_stalled",
      label: "Risks / Overdue / Stalled",
      description: "Attention debt that can slip if it stays ambient.",
      total: risks.length,
      items: risks.slice(0, 4).map((item) => toModuleItem(item, item.statusNote ?? item.displayName)),
    },
  ];
}

function materializeSnapshot(items: CommsBoardItem[], params: {
  dataMode: PersonalOpsSnapshot["dataMode"];
  warnings: string[];
  overlayAvailable: boolean;
}): PersonalOpsSnapshot {
  const buckets = createBucketRecord<CommsBoardItem[]>(() => []);
  const totals = createBucketRecord<number>(() => 0);
  const gmailAccounts = new Set<string>();
  const messageHandles = new Set<string>();
  const contextSources = new Set<PersonalOpsSourceKind>();

  for (const item of items) {
    buckets[item.bucket].push(item);
    totals[item.bucket] += 1;
    if (item.sourceKind === "gmail_thread") {
      gmailAccounts.add(item.sourceAccount);
    } else {
      messageHandles.add(item.sourceThreadId);
    }
    for (const evidence of [...item.evidence, ...item.supportingContext]) {
      contextSources.add(evidence.kind);
    }
  }

  for (const bucket of COMMS_BUCKETS) {
    buckets[bucket] = sortBoardItems(buckets[bucket]);
  }

  return {
    generatedAt: new Date().toISOString(),
    dataMode: params.dataMode,
    warnings: params.warnings,
    board: {
      buckets,
      totals,
      totalItems: items.length,
    },
    attentionCenter: buildAttentionModules(items),
    sources: {
      gmailAccounts: [...gmailAccounts].sort(),
      messageHandles: [...messageHandles].sort(),
      contextSources: [...contextSources].sort(),
      overlayPath: OVERLAY_PATH,
      overlayAvailable: params.overlayAvailable,
    },
    capabilities: {
      readOnly: false,
      canMutate: true,
      reason: params.dataMode === "overlay"
        ? "Overlay mode: local actions (promote, attach, reclassify) are enabled. Gmail provider writeback remains disabled pending provider integration."
        : "Seed mode: local classification actions are enabled. Gmail provider writeback remains disabled pending provider integration.",
    },
  };
}

function maybeReadOverlaySnapshot(taskMap: Map<string, PersonalOpsLinkedTask>): PersonalOpsSnapshot | null {
  if (!fs.existsSync(OVERLAY_PATH)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(OVERLAY_PATH, "utf8")) as {
      items?: CommsBoardItem[];
      board?: PersonalOpsSnapshot["board"];
      warnings?: string[];
    };

    if (Array.isArray(raw.items)) {
      return materializeSnapshot(
        raw.items.map((item) => ({
          ...item,
          source_type: item.source_type ?? inferSourceType(item.sourceKind),
          interaction_mode: item.interaction_mode ?? "triage",
          linkedTask: item.linkedTaskId ? taskMap.get(item.linkedTaskId) ?? item.linkedTask ?? null : item.linkedTask ?? null,
        })),
        {
          dataMode: "overlay",
          warnings: raw.warnings ?? [],
          overlayAvailable: true,
        },
      );
    }

    if (raw.board?.buckets) {
      const items = COMMS_BUCKETS.flatMap((bucket) => raw.board?.buckets[bucket] ?? []);
      return materializeSnapshot(
        items.map((item) => ({
          ...item,
          source_type: item.source_type ?? inferSourceType(item.sourceKind),
          interaction_mode: item.interaction_mode ?? "triage",
          linkedTask: item.linkedTaskId ? taskMap.get(item.linkedTaskId) ?? item.linkedTask ?? null : item.linkedTask ?? null,
        })),
        {
          dataMode: "overlay",
          warnings: raw.warnings ?? [],
          overlayAvailable: true,
        },
      );
    }
  } catch {
    return materializeSnapshot(buildSeedItems(taskMap), {
      dataMode: "run_045_seed",
      warnings: [
        "Seeded review mode is active because the personal-ops overlay file exists but could not be parsed. The board is falling back to the first-slice RUN-045 seed dataset instead of presenting broken overlay state.",
      ],
      overlayAvailable: true,
    });
  }

  return null;
}

export function getPersonalOpsSnapshot(): PersonalOpsSnapshot {
  const taskMap = loadTaskMap();
  const overlaySnapshot = maybeReadOverlaySnapshot(taskMap);
  if (overlaySnapshot) {
    return overlaySnapshot;
  }

  return materializeSnapshot(buildSeedItems(taskMap), {
    dataMode: "run_045_seed",
    overlayAvailable: false,
    warnings: [
      "Seeded review mode is active. No durable `.antigravity/evidence/personal-ops/comms-board.json` overlay exists yet, so this first slice is intentionally rendering the RUN-045 seed board plus linked canonical tasks in read-only review mode.",
    ],
  });
}

function buildActionsForItem(item: CommsBoardItem): PersonalOpsActionDescriptor[] {
  const gmailReason = "Requires Gmail provider writeback — not yet enabled in this slice.";

  if (item.source_type === "email" && item.interaction_mode === "triage") {
    return [
      { key: "open_email", label: "Open Email", detail: "Open the source email thread.", group: "primary", enabled: false, reason: gmailReason },
      { key: "mark_read", label: "Mark Read", detail: "Mark the thread as read.", group: "primary", enabled: false, reason: gmailReason },
      { key: "archive", label: "Archive", detail: "Archive the thread out of the active inbox.", group: "primary", enabled: false, reason: gmailReason },
      { key: "delete", label: "Delete", detail: "Delete the thread permanently.", group: "primary", enabled: false, reason: gmailReason },
      { key: "promote_to_task", label: "Promote to Task", detail: "Promote this email into a canonical task.", group: "secondary", enabled: true },
      { key: "attach_task", label: "Attach Task", detail: "Link the thread to an existing RUN/OPS task.", group: "secondary", enabled: true },
      { key: "mark_waiting", label: "Mark Waiting", detail: "Track who owes the next move and when to recheck.", group: "secondary", enabled: true },
      { key: "mark_follow_up", label: "Mark Follow Up", detail: "Capture promise debt and follow-up dates durably.", group: "secondary", enabled: true },
      { key: "ask_cd", label: "Ask CD", detail: "Surface a bounded question to Christian for disposition.", group: "secondary", enabled: true },
      { key: "archive_reference", label: "Archive To Reference", detail: "Move context out of critical attention counts while keeping evidence visible.", group: "secondary", enabled: true },
      { key: "mark_junk", label: "Mark Junk", detail: "Hide obvious noise without deleting evidence.", group: "secondary", enabled: true },
    ];
  }

  // Fallback: generic action set for non-email or non-triage items
  return [
    { key: "attach_task", label: "Attach Task", detail: "Link the thread to an existing RUN/OPS task.", group: "secondary", enabled: true },
    { key: "promote_to_task", label: "Promote to Task", detail: "Promote a non-trivial thread into canonical task state.", group: "secondary", enabled: true },
    { key: "mark_waiting", label: "Mark Waiting", detail: "Track who owes the next move and when to recheck.", group: "secondary", enabled: true },
    { key: "mark_follow_up", label: "Mark Follow Up", detail: "Capture promise debt and follow-up dates durably.", group: "secondary", enabled: true },
    { key: "ask_cd", label: "Ask CD", detail: "Surface a bounded question to Christian for disposition.", group: "secondary", enabled: true },
    { key: "prepare_reply_draft", label: "Prepare Reply Draft", detail: "Write a draft artifact without sending anything externally.", group: "secondary", enabled: true },
    { key: "archive_reference", label: "Archive To Reference", detail: "Move context out of critical attention counts while keeping evidence visible.", group: "secondary", enabled: true },
    { key: "mark_junk", label: "Mark Junk", detail: "Hide obvious noise without deleting evidence.", group: "secondary", enabled: true },
  ];
}

export function getPersonalOpsItemDetail(itemId: string): PersonalOpsItemDetail | null {
  const snapshot = getPersonalOpsSnapshot();
  const item = COMMS_BUCKETS.flatMap((bucket) => snapshot.board.buckets[bucket]).find((entry) => entry.id === itemId);
  if (!item) {
    return null;
  }

  const artifactPaths = [
    RUN_045_PATH,
    OPS_019_PATH,
    OPS_021_PATH,
    BRIEF_PATH,
    snapshot.sources.overlayPath,
  ];

  return {
    generatedAt: snapshot.generatedAt,
    dataMode: snapshot.dataMode,
    warnings: snapshot.warnings,
    artifactPaths,
    item,
    actions: buildActionsForItem(item),
  };
}
