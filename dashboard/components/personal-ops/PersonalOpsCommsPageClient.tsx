"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  FileStack,
  Inbox,
  Mail,
  MessageSquareText,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { usePersonalOps } from "@/hooks/use-personal-ops";
import {
  COMMS_BUCKETS,
  COMMS_BUCKET_META,
  type AttentionCenterModule,
  type CommsBoardItem,
  type CommsBucketKey,
  type PersonalOpsActionDescriptor,
  type PersonalOpsEvidenceRef,
  type PersonalOpsItemDetail,
  type PersonalOpsSnapshot,
} from "@/lib/personal-ops-types";

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isSelectedBucketRoute(module: AttentionCenterModule) {
  return module.items.length > 0;
}

function iconForSource(item: CommsBoardItem) {
  return item.sourceKind === "gmail_thread" ? Mail : MessageSquareText;
}

function iconForEvidence(evidence: PersonalOpsEvidenceRef) {
  switch (evidence.kind) {
    case "calendar_event":
      return CalendarDays;
    case "task":
      return FileStack;
    case "reminder":
      return AlertTriangle;
    case "gmail_thread":
      return Mail;
    case "message_thread":
      return MessageSquareText;
    default:
      return Inbox;
  }
}

function summarizeCounts(snapshot: PersonalOpsSnapshot | null) {
  if (!snapshot) {
    return [
      { label: "Needs Reply", value: 0 },
      { label: "Waiting", value: 0 },
      { label: "Follow Ups", value: 0 },
    ];
  }

  return [
    {
      label: "Needs Reply",
      value: snapshot.board.totals.urgent + snapshot.board.totals.needs_reply,
    },
    {
      label: "Waiting",
      value: snapshot.board.totals.waiting,
    },
    {
      label: "Follow Ups",
      value: snapshot.board.totals.follow_up,
    },
  ];
}

function modeLabel(snapshot: PersonalOpsSnapshot | null) {
  if (!snapshot) {
    return "Waiting for snapshot";
  }

  return snapshot.dataMode === "overlay" ? "Durable overlay" : "Seeded review mode";
}

function modeDetail(snapshot: PersonalOpsSnapshot | null) {
  if (!snapshot) {
    return "Snapshot status will appear after the first API load.";
  }

  return snapshot.dataMode === "overlay"
    ? "Using the durable comms-board overlay snapshot in read-only review mode."
    : "Frozen to the RUN-045 seed dataset until `.antigravity/evidence/personal-ops/comms-board.json` exists.";
}

export function PersonalOpsCommsPageClient() {
  const { snapshot, loading, refreshing, error, refresh, loadItemDetail } = usePersonalOps();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const deferredSelectedItemId = useDeferredValue(selectedItemId);
  const [detail, setDetail] = useState<PersonalOpsItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot || selectedItemId) {
      return;
    }

    const firstItem = COMMS_BUCKETS.flatMap((bucket) => snapshot.board.buckets[bucket])[0];
    if (firstItem) {
      setSelectedItemId(firstItem.id);
    }
  }, [selectedItemId, snapshot]);

  useEffect(() => {
    if (!deferredSelectedItemId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    startTransition(() => {
      void loadItemDetail(deferredSelectedItemId)
        .then((nextDetail) => {
          if (!cancelled) {
            setDetail(nextDetail);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setDetailError(err instanceof Error ? err.message : "Failed to load item detail");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setDetailLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [deferredSelectedItemId, loadItemDetail]);

  const counts = useMemo(() => summarizeCounts(snapshot), [snapshot]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <section
        className="rounded-[28px] border px-5 py-5 md:px-6"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background:
            "linear-gradient(135deg, rgba(10,26,37,0.96) 0%, rgba(15,28,36,0.94) 54%, rgba(42,18,7,0.92) 100%)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              <ShieldAlert className="h-3.5 w-3.5 text-[#f97316]" />
              Personal Ops Attention Center
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
              Attention Center + Comms Inbox Board
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-[15px]">
              First trustworthy slice only: Gmail and Messages are bucketed into operating states, evidence is inspectable,
              and the shipped posture stays explicitly read-only instead of implying provider writeback or a missing overlay-backed board.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {counts.map((count) => (
                <div
                  key={count.label}
                  className="rounded-2xl border px-3 py-2"
                  style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{count.label}</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{count.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <button
              type="button"
              onClick={() => void refresh(true)}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.1)", color: "var(--text-primary)" }}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh snapshot
            </button>
            <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Mode</div>
              <div className="mt-1 text-[var(--text-primary)]">
                {modeLabel(snapshot)}
              </div>
              <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                {modeDetail(snapshot)}
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {snapshot?.generatedAt ? `Generated ${formatShortDate(snapshot.generatedAt)}` : "Waiting for snapshot"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {snapshot?.warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(249,115,22,0.28)", background: "rgba(249,115,22,0.1)", color: "#fed7aa" }}
        >
          {warning}
        </div>
      ))}

      {snapshot ? (
        <div
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)" }}
        >
          {snapshot.capabilities.reason}
        </div>
      ) : null}

      {loading && !snapshot ? (
        <div className="rounded-2xl border px-4 py-8 text-center text-sm text-[var(--text-secondary)]" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          Loading the personal ops snapshot…
        </div>
      ) : null}

      {snapshot ? (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Attention Center</h2>
                <p className="text-sm text-[var(--text-secondary)]">What needs attention now, without duplicating the full board.</p>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Sources: {snapshot.sources.gmailAccounts.join(", ") || "No Gmail accounts"} · {snapshot.sources.messageHandles.length} message threads
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.attentionCenter.map((module) => (
                <AttentionModuleCard
                  key={module.key}
                  module={module}
                  onSelectItem={(itemId) => setSelectedItemId(itemId)}
                />
              ))}
            </div>
          </section>

          <section className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.9fr)]">
            <div className="min-w-0">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Comms Inbox Board</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Live bucket model: urgent, needs reply, follow up, waiting, reference, junk.
                </p>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="grid min-w-[1120px] grid-cols-6 gap-3">
                  {COMMS_BUCKETS.map((bucket) => (
                    <BucketColumn
                      key={bucket}
                      bucket={bucket}
                      items={snapshot.board.buckets[bucket]}
                      selectedItemId={selectedItemId}
                      onSelectItem={(itemId) => setSelectedItemId(itemId)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <aside className="min-h-0">
              <div
                className="sticky top-4 rounded-[28px] border p-4 md:p-5"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(9,18,24,0.92)" }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Evidence Drawer</h2>
                    <p className="text-sm text-[var(--text-secondary)]">Inspect the classification without dropping into raw transcripts.</p>
                  </div>
                  {detailLoading ? <Clock3 className="h-4 w-4 animate-pulse text-[var(--text-muted)]" /> : null}
                </div>
                <DetailPanel
                  detail={detail}
                  error={detailError}
                  loading={detailLoading}
                />
              </div>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  );
}

function AttentionModuleCard({
  module,
  onSelectItem,
}: {
  module: AttentionCenterModule;
  onSelectItem: (itemId: string) => void;
}) {
  return (
    <article
      className="rounded-[24px] border p-4"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(8,18,26,0.86)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{module.label}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{module.description}</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-[var(--text-primary)]">
          {module.total}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {isSelectedBucketRoute(module) ? (
          module.items.slice(0, 3).map((item) => (
            <button
              key={`${module.key}:${item.id}`}
              type="button"
              onClick={() => onSelectItem(item.route.id)}
              className="w-full rounded-2xl border px-3 py-3 text-left transition hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--text-primary)]">{item.title}</div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">{item.subtitle}</div>
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">{formatShortDate(item.latestAt)}</div>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-3 py-4 text-sm text-[var(--text-secondary)]">
            Nothing in this module yet.
          </div>
        )}
      </div>
    </article>
  );
}

function BucketColumn({
  bucket,
  items,
  selectedItemId,
  onSelectItem,
}: {
  bucket: CommsBucketKey;
  items: CommsBoardItem[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
}) {
  const meta = COMMS_BUCKET_META[bucket];

  return (
    <section
      className="rounded-[26px] border p-3"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(8,18,26,0.88)" }}
    >
      <div className="mb-3 rounded-[18px] border px-3 py-3" style={{ borderColor: `${meta.accent}22`, background: meta.background }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: meta.accent }}>{meta.label}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">{meta.description}</div>
          </div>
          <div className="rounded-full border px-3 py-1 text-sm font-semibold" style={{ borderColor: `${meta.accent}55`, color: meta.accent }}>
            {items.length}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <CommsItemCard
              key={item.id}
              item={item}
              selected={item.id === selectedItemId}
              onClick={() => onSelectItem(item.id)}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-3 py-5 text-center text-sm text-[var(--text-secondary)]">
            No items in this bucket.
          </div>
        )}
      </div>
    </section>
  );
}

function CommsItemCard({
  item,
  selected,
  onClick,
}: {
  item: CommsBoardItem;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = COMMS_BUCKET_META[item.bucket];
  const SourceIcon = iconForSource(item);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[22px] border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/5"
      style={{
        borderColor: selected ? `${meta.accent}88` : "rgba(255,255,255,0.08)",
        background: selected ? `${meta.accent}16` : "rgba(255,255,255,0.03)",
        boxShadow: selected ? `0 18px 34px ${meta.accent}14` : "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <SourceIcon className="h-3.5 w-3.5" />
          </span>
          <span>{item.displayName}</span>
        </div>
        <div className="text-[11px] text-[var(--text-muted)]">{formatShortDate(item.latestAt)}</div>
      </div>
      <div className="mt-3 text-sm font-semibold leading-6 text-[var(--text-primary)]">{item.subject}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.snippet}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.linkedTaskId ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
            Task {item.linkedTaskId}
          </span>
        ) : null}
        {item.waitingOn ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
            Waiting on {item.waitingOn}
          </span>
        ) : null}
        {item.followUpAt ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
            Due {formatShortDate(item.followUpAt)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function DetailPanel({
  detail,
  error,
  loading,
}: {
  detail: PersonalOpsItemDetail | null;
  error: string | null;
  loading: boolean;
}) {
  if (error) {
    return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>;
  }

  if (loading && !detail) {
    return <div className="rounded-2xl border border-white/10 px-4 py-6 text-sm text-[var(--text-secondary)]">Loading item detail…</div>;
  }

  if (!detail) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        Select a board card or module entry to inspect the evidence and planned safe actions.
      </div>
    );
  }

  const itemMeta = COMMS_BUCKET_META[detail.item.bucket];
  const SourceIcon = iconForSource(detail.item);

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border px-4 py-4" style={{ borderColor: `${itemMeta.accent}44`, background: `${itemMeta.accent}10` }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <SourceIcon className="h-4 w-4" />
              {detail.item.sourceAccount}
            </div>
            <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{detail.item.subject}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{detail.item.snippet}</p>
          </div>
          <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: `${itemMeta.accent}66`, color: itemMeta.accent }}>
            {itemMeta.label}
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)]">
          <div><span className="text-[var(--text-muted)]">Participants:</span> {detail.item.participants.join(", ")}</div>
          <div><span className="text-[var(--text-muted)]">Latest touch:</span> {formatShortDate(detail.item.latestAt)}</div>
          {detail.item.waitingOn ? <div><span className="text-[var(--text-muted)]">Waiting on:</span> {detail.item.waitingOn}</div> : null}
          {detail.item.followUpAt ? <div><span className="text-[var(--text-muted)]">Follow up at:</span> {formatShortDate(detail.item.followUpAt)}</div> : null}
          {detail.item.linkedTask ? (
            <div>
              <span className="text-[var(--text-muted)]">Linked task:</span> {detail.item.linkedTask.id} · {detail.item.linkedTask.title}
            </div>
          ) : null}
        </div>
      </div>

      <InfoBlock title="Current interpretation" body={detail.item.statusNote ?? "No explicit status note yet."} />
      <InfoBlock title="Suggested next move" body={detail.item.suggestedAction ?? "No next move captured yet."} />

      <section className="space-y-3">
        <InfoBlock
          title="Shipped posture"
          body={detail.dataMode === "overlay"
            ? "Overlay review mode is active. The durable board snapshot exists, but this first slice still keeps provider actions disabled."
            : "Seeded review mode is active. This item is rendered from the RUN-045 seed dataset until the durable comms-board overlay exists."}
        />
        <div className="text-sm font-semibold text-[var(--text-primary)]">Actions</div>
        {detail.actions.some((a) => a.group === "primary") ? (
          <div className="flex flex-wrap gap-2">
            {detail.actions
              .filter((a) => a.group === "primary")
              .map((action) => (
                <PrimaryActionButton key={action.key} action={action} />
              ))}
          </div>
        ) : null}
        {detail.actions.some((a) => a.group === "secondary") ? (
          <>
            {detail.actions.some((a) => a.group === "primary") ? (
              <div className="border-t border-white/10" />
            ) : null}
            <div className="grid gap-2">
              {detail.actions
                .filter((a) => a.group === "secondary")
                .map((action) => (
                  <ActionButton key={action.key} action={action} />
                ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-2">
        <div className="text-sm font-semibold text-[var(--text-primary)]">Primary evidence</div>
        <div className="space-y-2">
          {detail.item.evidence.map((evidence) => (
            <EvidenceCard key={evidence.id} evidence={evidence} />
          ))}
        </div>
      </section>

      {detail.item.supportingContext.length ? (
        <section className="space-y-2">
          <div className="text-sm font-semibold text-[var(--text-primary)]">Supporting context</div>
          <div className="space-y-2">
            {detail.item.supportingContext.map((evidence) => (
              <EvidenceCard key={evidence.id} evidence={evidence} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.warnings.length ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
          {detail.warnings.join(" ")}
        </div>
      ) : null}

      <div className="text-xs text-[var(--text-muted)]">
        Source artifacts: {detail.artifactPaths.join(" · ")}
      </div>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
    </section>
  );
}

function ActionButton({ action }: { action: PersonalOpsActionDescriptor }) {
  return (
    <button
      type="button"
      disabled={!action.enabled}
      className="rounded-2xl border px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-80"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--text-primary)]">{action.label}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {action.enabled ? "Ready" : "Review only"}
        </span>
      </div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{action.detail}</div>
      {action.reason ? <div className="mt-2 text-xs text-[var(--text-muted)]">{action.reason}</div> : null}
    </button>
  );
}

function PrimaryActionButton({ action }: { action: PersonalOpsActionDescriptor }) {
  return (
    <button
      type="button"
      disabled={!action.enabled}
      className="flex-1 rounded-2xl border px-3 py-2 text-center disabled:cursor-not-allowed disabled:opacity-70 transition hover:bg-white/5"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
    >
      <span className="text-sm font-medium text-[var(--text-primary)]">{action.label}</span>
    </button>
  );
}

function EvidenceCard({ evidence }: { evidence: PersonalOpsEvidenceRef }) {
  const Icon = iconForEvidence(evidence);

  return (
    <article className="rounded-2xl border border-white/10 bg-white/3 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--text-secondary)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--text-primary)]">{evidence.title}</div>
              {evidence.subtitle ? <div className="mt-1 text-xs text-[var(--text-secondary)]">{evidence.subtitle}</div> : null}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">{formatShortDate(evidence.occurredAt)}</div>
          </div>
          {evidence.snippet ? <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{evidence.snippet}</p> : null}
        </div>
      </div>
    </article>
  );
}
