"use client";

import { useState } from "react";
import { useAuditLog } from "@/hooks/use-file-inbox";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function todayString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function shortPath(p: string, segments = 3): string {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= segments) return p;
  return "…/" + parts.slice(-segments).join("/");
}

/* ------------------------------------------------------------------ */
/*  Badges                                                              */
/* ------------------------------------------------------------------ */

const CONFIDENCE_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: "rgba(34,197,94,0.15)", text: "#4ade80" },
  medium: { bg: "rgba(234,179,8,0.15)", text: "#facc15" },
  low: { bg: "rgba(239,68,68,0.15)", text: "#f87171" },
};

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

function AutoBadge({ auto }: { auto: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 4,
        background: auto ? "rgba(59,130,246,0.15)" : "rgba(168,85,247,0.15)",
        color: auto ? "#60a5fa" : "#c084fc",
        border: `1px solid ${auto ? "#60a5fa44" : "#c084fc44"}`,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {auto ? "Auto" : "Manual"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function AuditLogPage() {
  const [date, setDate] = useState(todayString);
  const { entries, loading, refresh } = useAuditLog(date);

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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f5f5f5" }}>Audit Log</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            File move history
          </p>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: "#141414",
              border: "1px solid #333",
              borderRadius: 6,
              color: "#e5e5e5",
              fontSize: 13,
              padding: "5px 10px",
              outline: "none",
            }}
          />
          <button
            onClick={() => refresh()}
            disabled={loading}
            style={{
              background: "#222",
              border: "1px solid #333",
              borderRadius: 6,
              color: "#aaa",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              padding: "6px 14px",
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "#555", fontSize: 14 }}>
          Loading audit log…
        </div>
      )}

      {/* Empty state */}
      {!loading && entries.length === 0 && (
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
          No moves recorded for this date.
        </div>
      )}

      {/* Table */}
      {!loading && entries.length > 0 && (
        <div
          style={{
            background: "#141414",
            border: "1px solid #222",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #222" }}>
                {["Time", "Source", "Destination", "Confidence", "Mode"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "10px 14px",
                      color: "#555",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr
                  key={`${entry.ts}-${idx}`}
                  style={{
                    borderBottom: idx < entries.length - 1 ? "1px solid #1a1a1a" : "none",
                  }}
                >
                  <td style={{ padding: "10px 14px", color: "#888", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 12 }}>
                    {formatTime(entry.ts)}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#aaa", fontFamily: "monospace", fontSize: 12, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {shortPath(entry.src)}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#aaa", fontFamily: "monospace", fontSize: 12, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {shortPath(entry.dst)}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <ConfidenceBadge confidence={entry.confidence} />
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <AutoBadge auto={entry.auto} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
