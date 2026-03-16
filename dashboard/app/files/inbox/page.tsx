"use client";

import { useCallback, useState } from "react";
import { useFileInbox } from "@/hooks/use-file-inbox";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function shortPath(p: string, segments = 3): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= segments) return p;
  return "…/" + parts.slice(-segments).join("/");
}

/* ------------------------------------------------------------------ */
/*  Badge components                                                    */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<string, string> = {
  business: "#3b82f6",
  finance: "#22c55e",
  projects: "#a855f7",
  reference: "#6b7280",
  research: "#f97316",
  data: "#14b8a6",
  personal: "#ec4899",
  archive: "#78716c",
  unknown: "#ef4444",
};

const CONFIDENCE_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "rgba(34,197,94,0.15)", text: "#4ade80" },
  medium: { bg: "rgba(234,179,8,0.15)", text: "#facc15" },
  low: { bg: "rgba(239,68,68,0.15)", text: "#f87171" },
};

function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.unknown;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 4,
        background: color + "22",
        color,
        border: `1px solid ${color}44`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {category}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const c = CONFIDENCE_COLORS[confidence] ?? CONFIDENCE_COLORS.low;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 4,
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.text}44`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {confidence}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function FileInboxPage() {
  const { data, loading, error, refresh, approve, reject, batchApprove } = useFileInbox();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleApprove = useCallback(
    async (src: string, dst: string, confidence: string) => {
      setBusy(true);
      setActionError(null);
      try {
        await approve(src, dst, confidence as "high" | "medium" | "low");
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [approve],
  );

  const handleReject = useCallback(
    async (src: string) => {
      setBusy(true);
      setActionError(null);
      try {
        await reject(src);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [reject],
  );

  const handleApproveAll = useCallback(async () => {
    if (!data) return;
    const highConf = data.items.filter((i) => i.classification.confidence === "high");
    if (highConf.length === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      await batchApprove(
        highConf.map((i) => ({
          src: i.file.absolutePath,
          dst: i.classification.suggestedPath,
          confidence: "high" as const,
        })),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [data, batchApprove]);

  const highConfCount = data?.items.filter((i) => i.classification.confidence === "high").length ?? 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e5e5e5",
        padding: "24px",
        fontFamily: "inherit",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f5f5f5" }}>File Inbox</h1>
          {data && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
              {data.counts.pending} pending &nbsp;·&nbsp; {data.counts.autoFiled} auto-filed today
            </p>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => refresh()}
            disabled={loading || busy}
            style={btnStyle("secondary")}
          >
            Refresh
          </button>
          <button
            onClick={handleApproveAll}
            disabled={loading || busy || highConfCount === 0}
            style={btnStyle("primary")}
          >
            Approve All High-Confidence{highConfCount > 0 ? ` (${highConfCount})` : ""}
          </button>
        </div>
      </div>

      {/* Error banners */}
      {(error || actionError) && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
            fontSize: 13,
          }}
        >
          {error ?? actionError}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div style={{ textAlign: "center", padding: 60, color: "#555", fontSize: 14 }}>
          Loading inbox…
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.items.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            background: "#141414",
            border: "1px solid #222",
            borderRadius: 12,
            color: "#555",
            fontSize: 15,
          }}
        >
          Inbox is clear!
        </div>
      )}

      {/* Item list */}
      {data && data.items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.items.map((item) => {
            const { file, classification } = item;
            return (
              <div
                key={file.absolutePath}
                style={{
                  background: "#141414",
                  border: "1px solid #222",
                  borderRadius: 10,
                  padding: "14px 16px",
                }}
              >
                {/* Top row: name + badges */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: "#f5f5f5", marginRight: 2 }}>
                    {file.name}
                  </span>
                  <CategoryBadge category={classification.suggestedCategory} />
                  <ConfidenceBadge confidence={classification.confidence} />
                  <span style={{ fontSize: 12, color: "#666", marginLeft: "auto" }}>
                    {formatSize(file.size)} &nbsp;·&nbsp; {formatDate(file.modified)}
                  </span>
                </div>

                {/* Destination */}
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                  <span style={{ color: "#555" }}>→ </span>
                  <span style={{ fontFamily: "monospace", color: "#aaa" }}>
                    {shortPath(classification.suggestedPath)}
                  </span>
                </div>

                {/* Reasoning */}
                <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                  {classification.reasoning}
                </div>

                {/* Conflict warning */}
                {classification.conflictAtDestination && (
                  <div
                    style={{
                      fontSize: 12,
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: "rgba(234,179,8,0.1)",
                      border: "1px solid rgba(234,179,8,0.3)",
                      color: "#facc15",
                      marginBottom: 8,
                    }}
                  >
                    Warning: A file already exists at the destination path.
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleApprove(file.absolutePath, classification.suggestedPath, classification.confidence)}
                    disabled={busy}
                    style={btnStyle("approve")}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(file.absolutePath)}
                    disabled={busy}
                    style={btnStyle("reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Button style helper                                                 */
/* ------------------------------------------------------------------ */

function btnStyle(variant: "primary" | "secondary" | "approve" | "reject"): React.CSSProperties {
  const base: React.CSSProperties = {
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 14px",
    transition: "opacity 0.15s",
  };
  switch (variant) {
    case "primary":
      return { ...base, background: "#3b82f6", color: "#fff" };
    case "secondary":
      return { ...base, background: "#222", color: "#aaa", border: "1px solid #333" };
    case "approve":
      return { ...base, background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" };
    case "reject":
      return { ...base, background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" };
  }
}
