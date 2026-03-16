export type CommsBucketKey =
  | "urgent"
  | "needs_reply"
  | "follow_up"
  | "waiting"
  | "reference"
  | "junk";

export type PersonalOpsDataMode = "overlay" | "run_045_seed";

export type PersonalOpsSourceType =
  | "email"
  | "message"
  | "calendar"
  | "reminder"
  | "task";

export type PersonalOpsInteractionMode = "triage" | "review" | "follow_up";

export type PersonalOpsSourceKind =
  | "gmail_thread"
  | "message_thread"
  | "calendar_event"
  | "reminder"
  | "note"
  | "meeting_recap"
  | "task"
  | "reply_draft";

export type PersonalOpsRouteTarget = {
  kind: "board_item" | "evidence" | "task";
  id: string;
};

export type PersonalOpsLinkedTask = {
  id: string;
  title: string;
  status: string;
  priority: "high" | "medium" | "low";
  ownerAgent: string | null;
  updatedAt: string;
};

export type PersonalOpsEvidenceRef = {
  id: string;
  kind: PersonalOpsSourceKind;
  title: string;
  subtitle?: string | null;
  snippet?: string | null;
  url?: string | null;
  sourceAccount?: string | null;
  sourceHandle?: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown>;
};

export type CommsBoardItem = {
  id: string;
  bucket: CommsBucketKey;
  sourceKind: "gmail_thread" | "message_thread";
  sourceAccount: string;
  sourceThreadId: string;
  source_type: PersonalOpsSourceType;
  interaction_mode: PersonalOpsInteractionMode;
  participants: string[];
  displayName: string;
  subject: string;
  snippet: string;
  latestAt: string;
  latestDirection: "inbound" | "outbound" | "mixed";
  ownerAgentId?: string | null;
  linkedTaskId?: string | null;
  linkedTask?: PersonalOpsLinkedTask | null;
  linkedDraftPath?: string | null;
  followUpAt?: string | null;
  waitingOn?: string | null;
  statusNote?: string | null;
  suggestedAction?: string | null;
  provenance: Array<"imported" | "manual_override" | "task_promoted" | "draft_prepared">;
  evidence: PersonalOpsEvidenceRef[];
  supportingContext: PersonalOpsEvidenceRef[];
};

export type AttentionCenterModule = {
  key:
    | "needs_reply_now"
    | "waiting_on_others"
    | "followups_due"
    | "meetings_today_next"
    | "new_context_to_process"
    | "risks_overdue_stalled";
  label: string;
  description: string;
  total: number;
  items: Array<{
    id: string;
    title: string;
    subtitle?: string | null;
    bucket?: CommsBucketKey | null;
    latestAt: string;
    linkedTaskId?: string | null;
    route: PersonalOpsRouteTarget;
  }>;
};

export type PersonalOpsActionKey =
  | "open_email"
  | "mark_read"
  | "archive"
  | "delete"
  | "keep_as_followup"
  | "promote_to_task"
  | "ask_cd"
  | "create_task"
  | "attach_task"
  | "mark_waiting"
  | "mark_follow_up"
  | "prepare_reply_draft"
  | "archive_reference"
  | "mark_junk";

export type PersonalOpsActionDescriptor = {
  key: PersonalOpsActionKey;
  label: string;
  detail: string;
  enabled: boolean;
  group: "primary" | "secondary";
  reason?: string | null;
};

export type PersonalOpsSnapshot = {
  generatedAt: string;
  dataMode: PersonalOpsDataMode;
  warnings: string[];
  board: {
    buckets: Record<CommsBucketKey, CommsBoardItem[]>;
    totals: Record<CommsBucketKey, number>;
    totalItems: number;
  };
  attentionCenter: AttentionCenterModule[];
  sources: {
    gmailAccounts: string[];
    messageHandles: string[];
    contextSources: PersonalOpsSourceKind[];
    overlayPath: string;
    overlayAvailable: boolean;
  };
  capabilities: {
    readOnly: boolean;
    canMutate: boolean;
    reason: string;
  };
};

export type PersonalOpsItemDetail = {
  generatedAt: string;
  dataMode: PersonalOpsDataMode;
  warnings: string[];
  artifactPaths: string[];
  item: CommsBoardItem;
  actions: PersonalOpsActionDescriptor[];
};

export const COMMS_BUCKETS: readonly CommsBucketKey[] = [
  "urgent",
  "needs_reply",
  "follow_up",
  "waiting",
  "reference",
  "junk",
] as const;

export const COMMS_BUCKET_META: Record<
  CommsBucketKey,
  {
    label: string;
    description: string;
    accent: string;
    background: string;
  }
> = {
  urgent: {
    label: "Urgent",
    description: "Same-day blocker or decision.",
    accent: "#f97316",
    background: "rgba(249,115,22,0.12)",
  },
  needs_reply: {
    label: "Needs Reply",
    description: "Latest move is inbound from a human.",
    accent: "#fb7185",
    background: "rgba(251,113,133,0.12)",
  },
  follow_up: {
    label: "Follow Up",
    description: "Christian owes a return loop.",
    accent: "#facc15",
    background: "rgba(250,204,21,0.12)",
  },
  waiting: {
    label: "Waiting",
    description: "Third party owes the next move.",
    accent: "#38bdf8",
    background: "rgba(56,189,248,0.12)",
  },
  reference: {
    label: "Reference",
    description: "Useful context, not current debt.",
    accent: "#94a3b8",
    background: "rgba(148,163,184,0.12)",
  },
  junk: {
    label: "Junk",
    description: "Noise and obvious clutter.",
    accent: "#71717a",
    background: "rgba(113,113,122,0.12)",
  },
};
