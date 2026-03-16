import "server-only";

import path from "node:path";
import type { GraphxReviewSnapshot } from "@/lib/graphx-review-types";

const ROOT_DIR = process.env.OPENCLAW_DATA_DIR || "/Volumes/Storage/OpenClaw-Data";
const RUN_047_PATH = path.join(ROOT_DIR, "tasks", "items", "RUN-047.md");
const RUN_057_PATH = path.join(ROOT_DIR, "tasks", "items", "RUN-057.md");
const RUN_057_BRIEF_PATH = path.join(ROOT_DIR, "details", "tasks", "RUN-057_GRAPHX_EXTRACTED_VALUE_UX_BRIEF_2026-03-12.md");

export function getGraphxReviewSnapshot(): GraphxReviewSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    dataMode: "run_057_seed",
    warnings: [
      "Seeded review mode is active. This first slice is intentionally frozen to one sample invoice and one selected extracted field.",
      "The source pane is a positioned preview highlight, not a PDF renderer or editable annotation surface.",
    ],
    artifactPaths: [RUN_047_PATH, RUN_057_PATH, RUN_057_BRIEF_PATH],
    capabilities: {
      readOnly: true,
      canMutate: false,
      reason:
        "RUN-057 ships an honest review slice only: operators can inspect one extracted value against one source region, but correction and rerun workflows stay outside this page.",
    },
    document: {
      id: "tupelo-sysco-cleveland-615763645",
      title: "Graphx extracted-value review",
      subtitle: "Sysco Cleveland invoice 615763645",
      fileName: "sysco-cleveland-invoice-615763645.pdf",
      vendor: "Sysco Cleveland",
      receivedAt: "2026-01-23T16:10:00Z",
      pageLabel: "Page 1 of 1",
      note:
        "Seeded from the Tupelo Honey invoice-review lane so the first Graphx review surface demonstrates one real field-check decision without implying a full reviewer toolchain.",
    },
    selectedField: {
      id: "invoice_total",
      label: "Invoice total",
      value: "$3,549.37",
      confidence: 0.97,
      confidenceLabel: "High confidence",
      confidenceTone: "high",
      rationale:
        "The first slice stays review-first: one obvious financial field, a stable read-only value, and direct source context instead of inline editing.",
      sourceQuote: "TOTAL     $3,549.37",
      sourceHighlightId: "highlight-total-block",
    },
    sourceHighlight: {
      id: "highlight-total-block",
      label: "Selected source region",
      page: 1,
      quote: "TOTAL     $3,549.37",
      note:
        "Highlight fidelity is intentionally narrow in v1. The preview only proves field-to-region grounding for one seeded value before broader viewer or annotation work exists.",
      bounds: {
        topPct: 72,
        leftPct: 55,
        widthPct: 29,
        heightPct: 10,
      },
    },
    viewer: {
      modeLabel: "Seeded review preview",
      detail:
        "This page separates review from correction: the extracted value stays read-only while the source pane shows the single grounded region that produced it.",
    },
    changeExtractionAction: {
      key: "change_extraction",
      label: "Change extraction",
      detail:
        "Route this document and field into the correction or rerun workflow instead of editing the value inline on the review surface.",
      enabled: true,
      reason:
        "Visible by design, but still non-mutating in v1. The button only reveals the correction handoff guidance for this slice.",
    },
  };
}
