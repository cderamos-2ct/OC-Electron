"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified: string;
}

interface DirListing {
  path: string;
  entries: FileEntry[];
}

interface FileContent {
  path: string;
  name: string;
  size: number;
  modified: string;
  content?: string;
  binary?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Inline markdown → HTML converter                                   */
/* ------------------------------------------------------------------ */

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inCode = false;
  let inList = false;
  let lang = "";

  function escHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function inlineFormat(s: string): string {
    // Code spans first to avoid double-processing
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code class="md-code-span">${escHtml(c)}</code>`);
    // Bold + italic
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/_(.+?)_/g, "<em>$1</em>");
    // Links
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="md-link" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    if (/^```/.test(line)) {
      if (!inCode) {
        if (inList) { out.push("</ul>"); inList = false; }
        lang = line.slice(3).trim();
        out.push(`<pre class="md-pre"><code class="md-code-block language-${escHtml(lang)}">`);
        inCode = true;
      } else {
        out.push("</code></pre>");
        inCode = false;
        lang = "";
      }
      continue;
    }

    if (inCode) {
      out.push(escHtml(line));
      continue;
    }

    // Headings
    const h6 = line.match(/^#{6}\s+(.*)/);
    const h5 = line.match(/^#{5}\s+(.*)/);
    const h4 = line.match(/^#{4}\s+(.*)/);
    const h3 = line.match(/^#{3}\s+(.*)/);
    const h2 = line.match(/^#{2}\s+(.*)/);
    const h1 = line.match(/^#{1}\s+(.*)/);
    if (h6) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h6 class="md-h6">${inlineFormat(h6[1])}</h6>`); continue; }
    if (h5) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h5 class="md-h5">${inlineFormat(h5[1])}</h5>`); continue; }
    if (h4) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h4 class="md-h4">${inlineFormat(h4[1])}</h4>`); continue; }
    if (h3) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h3 class="md-h3">${inlineFormat(h3[1])}</h3>`); continue; }
    if (h2) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h2 class="md-h2">${inlineFormat(h2[1])}</h2>`); continue; }
    if (h1) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h1 class="md-h1">${inlineFormat(h1[1])}</h1>`); continue; }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("<hr class=\"md-hr\" />");
      continue;
    }

    // Blockquote
    if (/^>\s*/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<blockquote class="md-blockquote">${inlineFormat(line.replace(/^>\s*/, ""))}</blockquote>`);
      continue;
    }

    // Unordered list
    const liMatch = line.match(/^[-*+]\s+(.*)/);
    if (liMatch) {
      if (!inList) { out.push("<ul class=\"md-ul\">"); inList = true; }
      out.push(`<li class="md-li">${inlineFormat(liMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const oliMatch = line.match(/^\d+\.\s+(.*)/);
    if (oliMatch) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<ol class="md-ol"><li class="md-li">${inlineFormat(oliMatch[1])}</li></ol>`);
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
      continue;
    }

    // Paragraph
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p class="md-p">${inlineFormat(escHtml(line))}</p>`);
  }

  if (inList) out.push("</ul>");
  if (inCode) out.push("</code></pre>");

  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function pathSegments(p: string): { label: string; path: string }[] {
  const parts = p.replace(/^\/+/, "").split("/").filter(Boolean);
  const segs: { label: string; path: string }[] = [{ label: "Home", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc += "/" + part;
    segs.push({ label: part, path: acc });
  }
  return segs;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const PAGE_STYLES = `
  .fb-back-btn:hover {
    border-color: rgba(124,151,171,0.34) !important;
    background: rgba(255,255,255,0.08) !important;
    color: #edf4f8 !important;
  }
  .fb-crumb-btn:hover {
    color: #edf4f8 !important;
  }
  .fb-entry-row:hover {
    border-color: rgba(124,151,171,0.18) !important;
    background: rgba(255,255,255,0.04) !important;
  }
  @keyframes fb-spin {
    to { transform: rotate(360deg); }
  }
  .fb-spinner { display: inline-block; animation: fb-spin 1s linear infinite; }
  @media (min-width: 640px) {
    .fb-entry-date { display: inline !important; }
  }
  /* Markdown body styles */
  .fb-md h1, .fb-md h2, .fb-md h3, .fb-md h4, .fb-md h5, .fb-md h6 {
    font-family: var(--font-display), serif;
    color: #edf4f8;
    letter-spacing: -0.03em;
    margin: 1.4em 0 0.5em;
    line-height: 1.2;
  }
  .fb-md h1 { font-size: 1.6rem; }
  .fb-md h2 { font-size: 1.3rem; border-bottom: 1px solid rgba(124,151,171,0.18); padding-bottom: 0.3em; }
  .fb-md h3 { font-size: 1.1rem; }
  .fb-md h4, .fb-md h5, .fb-md h6 { font-size: 0.95rem; }
  .fb-md p { margin: 0.75em 0; }
  .fb-md ul { padding-left: 1.4em; margin: 0.6em 0; list-style: disc; }
  .fb-md ol { padding-left: 1.4em; margin: 0.6em 0; list-style: decimal; }
  .fb-md li { margin: 0.25em 0; }
  .fb-md a { color: #ff7a1a; text-decoration: underline; text-underline-offset: 2px; }
  .fb-md a:hover { color: #ffaa5e; }
  .fb-md strong { color: #edf4f8; font-weight: 600; }
  .fb-md em { color: #aec8d8; font-style: italic; }
  .fb-md code { font-family: ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace; font-size: 0.85em; background: rgba(255,255,255,0.08); border-radius: 4px; padding: 1px 5px; color: #63d3bd; }
  .fb-md pre { background: rgba(6,14,20,0.85); border: 1px solid rgba(124,151,171,0.14); border-radius: 10px; padding: 16px; overflow-x: auto; margin: 1em 0; }
  .fb-md pre code { background: none; padding: 0; border-radius: 0; color: #c8dce8; font-size: 0.82rem; line-height: 1.65; }
  .fb-md blockquote { border-left: 3px solid rgba(255,122,26,0.4); padding: 4px 0 4px 16px; margin: 0.8em 0; color: #8ea1ae; font-style: italic; }
  .fb-md hr { border: none; border-top: 1px solid rgba(124,151,171,0.18); margin: 1.5em 0; }
`;

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState("/");
  const [listing, setListing] = useState<DirListing | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const loadDir = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    setFileContent(null);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load directory");
      setListing(data as DirListing);
      setCurrentPath(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFile = useCallback(async (p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to read file");
      setFileContent(data as FileContent);
      setCurrentPath(p);
      setTimeout(() => contentRef.current?.scrollTo({ top: 0 }), 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDir("/");
  }, [loadDir]);

  const handleEntryClick = (entry: FileEntry) => {
    const base = listing?.path ?? "/";
    const entryPath = base === "/" ? `/${entry.name}` : `${base}/${entry.name}`;
    if (entry.type === "directory") {
      loadDir(entryPath);
    } else {
      loadFile(entryPath);
    }
  };

  const handleBreadcrumb = (seg: { label: string; path: string }) => {
    if (fileContent) {
      // If viewing a file, clicking any breadcrumb segment goes to that dir
      loadDir(seg.path);
    } else {
      loadDir(seg.path);
    }
  };

  const handleBack = () => {
    if (fileContent) {
      // Go back to the directory containing this file
      const dir = fileContent.path.substring(0, fileContent.path.lastIndexOf("/")) || "/";
      loadDir(dir);
      return;
    }
    if (currentPath === "/") return;
    const parent = currentPath.substring(0, currentPath.lastIndexOf("/")) || "/";
    loadDir(parent);
  };

  const segments = pathSegments(fileContent ? fileContent.path : currentPath);
  const canGoBack = fileContent !== null || currentPath !== "/";

  const isMarkdown = fileContent?.name.toLowerCase().endsWith(".md");
  const isJson = fileContent?.name.toLowerCase().endsWith(".json") || fileContent?.name.toLowerCase().endsWith(".jsonl");

  let jsonFormatted: string | null = null;
  if (isJson && fileContent?.content) {
    try {
      jsonFormatted = JSON.stringify(JSON.parse(fileContent.content), null, 2);
    } catch {
      jsonFormatted = fileContent.content;
    }
  }

  return (
    <div style={styles.page}>
      <style dangerouslySetInnerHTML={{ __html: PAGE_STYLES }} />
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.headerLeft}>
            <span style={styles.kicker}>Data Directory</span>
            <h1 style={styles.title}>File Browser</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Link href="/files/inbox" style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36, padding: "0 14px", border: "1px solid rgba(124,151,171,0.18)", borderRadius: 999, background: "rgba(255,255,255,0.04)", color: "#8ea1ae", fontSize: "0.86rem", fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" }} className="fb-back-btn">
              Inbox
            </Link>
            <Link href="/files/audit-log" style={{ display: "inline-flex", alignItems: "center", gap: 5, minHeight: 36, padding: "0 14px", border: "1px solid rgba(124,151,171,0.18)", borderRadius: 999, background: "rgba(255,255,255,0.04)", color: "#8ea1ae", fontSize: "0.86rem", fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap" }} className="fb-back-btn">
              Audit Log
            </Link>
            {canGoBack && (
              <button onClick={handleBack} style={styles.backBtn} className="fb-back-btn" aria-label="Go back">
                ← Back
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        <nav style={styles.breadcrumb} aria-label="Breadcrumb">
          {segments.map((seg, i) => (
            <span key={seg.path} style={styles.breadcrumbItem}>
              {i > 0 && <span style={styles.breadcrumbSep}>/</span>}
              <button
                onClick={() => handleBreadcrumb(seg)}
                style={{
                  ...styles.breadcrumbBtn,
                  ...(i === segments.length - 1 ? styles.breadcrumbActive : {}),
                }}
              >
                {seg.label}
              </button>
            </span>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <div style={styles.contentWrap} ref={contentRef}>
        {loading && (
          <div style={styles.state}>
            <span style={styles.stateIcon}>⟳</span>
            <span style={styles.stateText}>Loading…</span>
          </div>
        )}

        {!loading && error && (
          <div style={styles.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && fileContent && (
          <div style={styles.fileView}>
            <div style={styles.fileMeta}>
              <span style={styles.fileMetaName}>📄 {fileContent.name}</span>
              <span style={styles.fileMetaDivider}>·</span>
              {fileContent.binary ? (
                <span style={styles.fileMetaItem}>Binary file — {formatSize(fileContent.size)}</span>
              ) : (
                <>
                  <span style={styles.fileMetaItem}>{formatSize(fileContent.size)}</span>
                  <span style={styles.fileMetaDivider}>·</span>
                  <span style={styles.fileMetaItem}>{formatDate(fileContent.modified)}</span>
                </>
              )}
            </div>

            {fileContent.binary ? (
              <div style={styles.binaryNotice}>
                Binary file — preview not available.
              </div>
            ) : isMarkdown && fileContent.content ? (
              <div
                style={styles.markdownBody}
                dangerouslySetInnerHTML={{ __html: markdownToHtml(fileContent.content) }}
              />
            ) : isJson && jsonFormatted ? (
              <pre style={styles.monoContent}>{jsonFormatted}</pre>
            ) : (
              <pre style={styles.monoContent}>{fileContent.content}</pre>
            )}
          </div>
        )}

        {!loading && !error && !fileContent && listing && (
          <div style={styles.listing}>
            {listing.entries.length === 0 ? (
              <div style={styles.emptyState}>This directory is empty.</div>
            ) : (
              listing.entries.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => handleEntryClick(entry)}
                  style={styles.entryRow}
                  aria-label={`${entry.type === "directory" ? "Open folder" : "Open file"}: ${entry.name}`}
                >
                  <span style={styles.entryIcon}>
                    {entry.type === "directory" ? "📁" : "📄"}
                  </span>
                  <span style={styles.entryName}>{entry.name}</span>
                  <span style={styles.entryMeta}>
                    {entry.type === "file" && entry.size !== undefined && (
                      <span style={styles.entrySize}>{formatSize(entry.size)}</span>
                    )}
                    <span style={styles.entryDate}>{formatDate(entry.modified)}</span>
                  </span>
                  <span style={styles.entryChevron} aria-hidden>›</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline styles — matches the dashboard dark theme                   */
/* ------------------------------------------------------------------ */

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    flex: 1,
    gap: 0,
    padding: "24px 24px 32px",
    maxWidth: "100%",
    overflowX: "hidden",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottom: "1px solid rgba(124,151,171,0.18)",
  },
  headerTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap" as React.CSSProperties["flexWrap"],
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  kicker: {
    color: "#ff7a1a",
    fontSize: "0.72rem",
    letterSpacing: "0.24em",
    textTransform: "uppercase" as React.CSSProperties["textTransform"],
    fontWeight: 600,
  },
  title: {
    fontFamily: "var(--font-display), serif",
    fontSize: "clamp(1.5rem, 3vw, 2rem)",
    fontWeight: 600,
    color: "#edf4f8",
    margin: 0,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    padding: "0 14px",
    border: "1px solid rgba(124,151,171,0.18)",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    color: "#8ea1ae",
    fontSize: "0.86rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "color 140ms ease, border-color 140ms ease, background 140ms ease",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap" as React.CSSProperties["flexWrap"],
    gap: 0,
    fontSize: "0.84rem",
    minWidth: 0,
  },
  breadcrumbItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 0,
    minWidth: 0,
  },
  breadcrumbSep: {
    color: "rgba(124,151,171,0.4)",
    padding: "0 4px",
    userSelect: "none",
  },
  breadcrumbBtn: {
    background: "none",
    border: "none",
    padding: "2px 4px",
    borderRadius: 6,
    color: "#8ea1ae",
    cursor: "pointer",
    fontSize: "0.84rem",
    fontWeight: 400,
    transition: "color 120ms ease",
    maxWidth: "180px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  breadcrumbActive: {
    color: "#edf4f8",
    fontWeight: 500,
    cursor: "default",
    pointerEvents: "none",
  },
  contentWrap: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
  },
  state: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "40px 0",
    justifyContent: "center",
    color: "#6b7f8d",
  },
  stateIcon: {
    fontSize: "1.4rem",
    animation: "spin 1s linear infinite",
  },
  stateText: {
    fontSize: "0.9rem",
  },
  errorBox: {
    margin: "16px 0",
    padding: "14px 16px",
    border: "1px solid rgba(239,68,68,0.28)",
    borderRadius: 14,
    background: "rgba(239,68,68,0.08)",
    color: "#fca5a5",
    fontSize: "0.88rem",
    lineHeight: 1.5,
  },
  listing: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  emptyState: {
    padding: "48px 0",
    textAlign: "center",
    color: "#6b7f8d",
    fontSize: "0.9rem",
  },
  entryRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 52,
    padding: "10px 14px",
    border: "1px solid transparent",
    borderRadius: 14,
    background: "transparent",
    color: "#edf4f8",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 140ms ease, background 140ms ease",
    boxSizing: "border-box",
  },
  entryIcon: {
    fontSize: "1.1rem",
    flexShrink: 0,
    lineHeight: 1,
  },
  entryName: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "0.9rem",
    fontWeight: 400,
  },
  entryMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    color: "#6b7f8d",
    fontSize: "0.78rem",
  },
  entrySize: {
    minWidth: 56,
    textAlign: "right",
  },
  entryDate: {
    display: "none",
  },
  entryChevron: {
    color: "rgba(124,151,171,0.4)",
    fontSize: "1.1rem",
    flexShrink: 0,
    lineHeight: 1,
  },
  fileView: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    minWidth: 0,
    maxWidth: "100%",
  },
  fileMeta: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap" as React.CSSProperties["flexWrap"],
    gap: 6,
    padding: "10px 14px",
    marginBottom: 2,
    border: "1px solid rgba(124,151,171,0.14)",
    borderRadius: "14px 14px 0 0",
    background: "rgba(14,25,34,0.6)",
    fontSize: "0.82rem",
    color: "#8ea1ae",
  },
  fileMetaName: {
    color: "#edf4f8",
    fontWeight: 500,
    fontSize: "0.88rem",
  },
  fileMetaDivider: {
    color: "rgba(124,151,171,0.4)",
  },
  fileMetaItem: {
    color: "#6b7f8d",
  },
  binaryNotice: {
    padding: "40px 24px",
    textAlign: "center",
    color: "#6b7f8d",
    fontSize: "0.9rem",
    border: "1px solid rgba(124,151,171,0.14)",
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    background: "rgba(8,18,26,0.6)",
  },
  monoContent: {
    margin: 0,
    padding: "20px",
    border: "1px solid rgba(124,151,171,0.14)",
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    background: "rgba(6,14,20,0.8)",
    color: "#c8dce8",
    fontSize: "0.82rem",
    fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace",
    lineHeight: 1.65,
    overflowX: "auto",
    whiteSpace: "pre",
    tabSize: 2,
    maxWidth: "100%",
  },
  markdownBody: {
    padding: "24px",
    border: "1px solid rgba(124,151,171,0.14)",
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    background: "rgba(10,20,28,0.7)",
    color: "#c8dce8",
    fontSize: "0.92rem",
    lineHeight: 1.7,
    maxWidth: "100%",
    overflowX: "auto",
  },
};
