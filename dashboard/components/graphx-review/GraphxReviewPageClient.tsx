"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  FileDigit,
  Focus,
  Highlighter,
  RefreshCcw,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { useGraphxReview } from "@/hooks/use-graphx-review";
import type {
  GraphxConfidenceTone,
  GraphxReviewActionDescriptor,
  GraphxReviewSnapshot,
} from "@/lib/graphx-review-types";

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

function modeLabel(snapshot: GraphxReviewSnapshot | null) {
  if (!snapshot) {
    return "Waiting for seeded snapshot";
  }

  return snapshot.dataMode === "run_057_seed" ? "Seeded review mode" : "Review mode";
}

function confidenceMeta(tone: GraphxConfidenceTone) {
  switch (tone) {
    case "high":
      return {
        accent: "#34d399",
        background: "rgba(52,211,153,0.12)",
        border: "rgba(52,211,153,0.28)",
      };
    case "medium":
      return {
        accent: "#fbbf24",
        background: "rgba(251,191,36,0.12)",
        border: "rgba(251,191,36,0.28)",
      };
    default:
      return {
        accent: "#fb7185",
        background: "rgba(251,113,133,0.12)",
        border: "rgba(251,113,133,0.28)",
      };
  }
}

export function GraphxReviewPageClient() {
  const { snapshot, loading, refreshing, error, refresh } = useGraphxReview();
  const [showChangePath, setShowChangePath] = useState(false);

  const fieldMeta = useMemo(
    () => confidenceMeta(snapshot?.selectedField.confidenceTone ?? "high"),
    [snapshot?.selectedField.confidenceTone],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <section
        className="rounded-[28px] border px-5 py-5 md:px-6"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background:
            "linear-gradient(135deg, rgba(9,21,29,0.97) 0%, rgba(13,30,39,0.95) 58%, rgba(39,24,10,0.94) 100%)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              <ScanSearch className="h-3.5 w-3.5 text-[#f59e0b]" />
              Graphx Review Slice
            </div>
            <h1
              className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Extracted value review
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-[15px]">
              First bounded slice only: one seeded sample document, one selected extracted field, one explicit
              change-extraction handoff, and one visible source-region highlight. No inline editing and no PDF annotation ship here.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <SummaryChip label="Document" value={snapshot?.document.subtitle ?? "1 seeded sample"} />
              <SummaryChip label="Selected field" value={snapshot?.selectedField.label ?? "1 field"} />
              <SummaryChip label="Source region" value={snapshot?.sourceHighlight.label ?? "1 highlight"} />
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
              Refresh seeded snapshot
            </button>
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Mode</div>
              <div className="mt-1 text-[var(--text-primary)]">{modeLabel(snapshot)}</div>
              <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                {snapshot?.capabilities.reason ?? "Snapshot posture will appear after the first API load."}
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
          style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: "#fde68a" }}
        >
          {warning}
        </div>
      ))}

      {loading && !snapshot ? (
        <div
          className="rounded-2xl border px-4 py-8 text-center text-sm text-[var(--text-secondary)]"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          Loading the Graphx review slice…
        </div>
      ) : null}

      {snapshot ? (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.28fr)]">
          <section className="space-y-4">
            <InfoCard
              icon={<FileDigit className="h-4 w-4 text-[#f59e0b]" />}
              title="Seeded sample document"
              body={snapshot.document.note}
            >
              <DefinitionRow label="Document" value={snapshot.document.subtitle} />
              <DefinitionRow label="Vendor" value={snapshot.document.vendor} />
              <DefinitionRow label="File" value={snapshot.document.fileName} />
              <DefinitionRow label="Received" value={formatShortDate(snapshot.document.receivedAt)} />
              <DefinitionRow label="Page" value={snapshot.document.pageLabel} />
            </InfoCard>

            <section
              className="rounded-[24px] border px-4 py-4"
              style={{ borderColor: fieldMeta.border, background: fieldMeta.background }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    <ShieldCheck className="h-4 w-4" style={{ color: fieldMeta.accent }} />
                    Selected extracted field
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">{snapshot.selectedField.value}</h2>
                  <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{snapshot.selectedField.label}</div>
                </div>
                <span
                  className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ borderColor: fieldMeta.border, color: fieldMeta.accent }}
                >
                  {snapshot.selectedField.confidenceLabel}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{snapshot.selectedField.rationale}</p>
              <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)]">
                <DefinitionRow label="Confidence" value={`${Math.round(snapshot.selectedField.confidence * 100)}%`} />
                <DefinitionRow label="Source quote" value={snapshot.selectedField.sourceQuote} />
              </div>
            </section>

            <section
              id="change-extraction"
              className="rounded-[24px] border px-4 py-4"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(9,18,24,0.9)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    <ArrowRightLeft className="h-4 w-4 text-[#f97316]" />
                    Correction path
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-[var(--text-primary)]">
                    Keep review and correction separate
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {snapshot.changeExtractionAction.detail}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                <ActionButton
                  action={snapshot.changeExtractionAction}
                  active={showChangePath}
                  onClick={() => setShowChangePath((current) => !current)}
                />
                {showChangePath ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
                    This v1 page does not change values in place. The intended next move is to hand off the document
                    id, selected field, and highlighted quote into the extraction correction workflow, rerun extraction,
                    and then return to this review surface with a fresh artifact.
                  </div>
                ) : null}
              </div>
            </section>

            <InfoCard
              icon={<Focus className="h-4 w-4 text-[#38bdf8]" />}
              title={snapshot.viewer.modeLabel}
              body={snapshot.viewer.detail}
            >
              <DefinitionRow label="Highlighted region" value={snapshot.sourceHighlight.quote} />
              <DefinitionRow label="Artifact paths" value={`${snapshot.artifactPaths.length} linked sources`} />
            </InfoCard>
          </section>

          <aside className="min-h-0">
            <div
              className="sticky top-4 rounded-[28px] border p-4 md:p-5"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(9,18,24,0.92)" }}
            >
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Source region preview</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  One highlighted field-region only. This stays intentionally narrower than a full document viewer.
                </p>
              </div>
              <DocumentPreview snapshot={snapshot} />
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
                <div className="font-medium text-[var(--text-primary)]">{snapshot.sourceHighlight.label}</div>
                <p className="mt-2 leading-6">{snapshot.sourceHighlight.note}</p>
              </div>
              <div className="mt-3 text-xs text-[var(--text-muted)]">
                Source artifacts: {snapshot.artifactPaths.join(" · ")}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-2xl border px-3 py-2"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[24px] border px-4 py-4"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(9,18,24,0.9)" }}
    >
      <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
        {icon}
        {title}
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
      {children ? <div className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)]">{children}</div> : null}
    </section>
  );
}

function DefinitionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3">
      <div className="text-[var(--text-muted)]">{label}</div>
      <div className="break-words text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function ActionButton({
  action,
  active,
  onClick,
}: {
  action: GraphxReviewActionDescriptor;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border px-4 py-3 text-left transition hover:bg-white/5"
      style={{
        borderColor: active ? "rgba(249,115,22,0.38)" : "rgba(255,255,255,0.08)",
        background: active ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <Highlighter className="h-4 w-4 text-[#f97316]" />
          {action.label}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Read only
        </span>
      </div>
      {action.reason ? <div className="mt-2 text-xs text-[var(--text-muted)]">{action.reason}</div> : null}
    </button>
  );
}

function DocumentPreview({ snapshot }: { snapshot: GraphxReviewSnapshot }) {
  const { sourceHighlight } = snapshot;

  return (
    <div className="rounded-[24px] border border-white/10 bg-[#f8f4ea] p-4 text-[#1f2937] shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between border-b border-[#d6d0c4] pb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a5a15]">Seeded source preview</div>
          <div className="mt-2 text-lg font-semibold">{snapshot.document.vendor}</div>
        </div>
        <div className="text-right text-xs text-[#6b7280]">
          <div>{snapshot.document.fileName}</div>
          <div className="mt-1">{snapshot.document.pageLabel}</div>
        </div>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[20px] border border-[#d6d0c4] bg-white px-5 py-5">
        <div className="space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <PreviewFact label="Invoice #" value="615763645" />
            <PreviewFact label="Invoice date" value="01/23/2026" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <PreviewFact label="Ship to" value="Tupelo Honey - Gainesville" />
            <PreviewFact label="Terms" value="Net 30" />
          </div>
          <div className="rounded-2xl border border-[#ebe4d7] bg-[#faf7f2] px-4 py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6b7280]">
              <div>Description</div>
              <div className="text-right">Amount</div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <PreviewLineItem label="Produce and dairy delivery" value="$2,781.44" />
              <PreviewLineItem label="Frozen goods" value="$612.19" />
              <PreviewLineItem label="Fuel surcharge" value="$155.74" />
            </div>
          </div>
          <div className="ml-auto max-w-[240px] rounded-2xl border border-[#d6d0c4] bg-[#fffaf0] px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-[0.14em] text-[#8a5a15]">Total</span>
              <span className="text-lg font-semibold">$3,549.37</span>
            </div>
            <div className="mt-2 text-xs text-[#6b7280]">Grounded source quote for the selected extracted field.</div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute rounded-[20px] border-2 border-[#f97316] bg-[#f9731620] shadow-[0_0_0_1px_rgba(249,115,22,0.18)]"
          style={{
            top: `${sourceHighlight.bounds.topPct}%`,
            left: `${sourceHighlight.bounds.leftPct}%`,
            width: `${sourceHighlight.bounds.widthPct}%`,
            height: `${sourceHighlight.bounds.heightPct}%`,
          }}
        >
          <div className="-mt-7 ml-auto w-fit rounded-full bg-[#f97316] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
            Highlighted source
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#ebe4d7] bg-[#faf7f2] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">{label}</div>
      <div className="mt-2 text-sm font-medium text-[#111827]">{value}</div>
    </div>
  );
}

function PreviewLineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
      <div className="text-[#374151]">{label}</div>
      <div className="text-right font-medium text-[#111827]">{value}</div>
    </div>
  );
}
