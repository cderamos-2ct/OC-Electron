"use client";
import { useState, useEffect, useCallback } from "react";

interface FileMetadata {
  name: string;
  ext: string;
  size: number;
  modified: string;
  absolutePath: string;
  relativePath: string;
  isGoogleDriveLink: boolean;
}

type FileCategory = "business" | "projects" | "reference" | "archive" | "finance" | "data" | "personal" | "research" | "unknown";
type Confidence = "high" | "medium" | "low";

interface ClassificationResult {
  file: FileMetadata;
  suggestedCategory: FileCategory;
  suggestedPath: string;
  confidence: Confidence;
  reasoning: string;
  conflictAtDestination: boolean;
}

interface InboxItem {
  file: FileMetadata;
  classification: ClassificationResult;
  status: string;
}

interface InboxData {
  items: InboxItem[];
  counts: { pending: number; autoFiled: number; total: number };
}

interface AuditLogEntry {
  ts: number;
  src: string;
  dst: string;
  kind: string;
  confidence: string;
  auto: boolean;
}

export function useFileInbox() {
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/files/inbox");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [refresh]);

  const approve = useCallback(async (src: string, dst: string, confidence?: Confidence) => {
    const res = await fetch("/api/files/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: [{ src, dst, action: "approve", confidence }] }),
    });
    if (!res.ok) throw new Error(await res.text());
    await refresh();
  }, [refresh]);

  const reject = useCallback(async (src: string) => {
    const res = await fetch("/api/files/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: [{ src, dst: "", action: "reject" }] }),
    });
    if (!res.ok) throw new Error(await res.text());
    await refresh();
  }, [refresh]);

  const batchApprove = useCallback(async (items: Array<{ src: string; dst: string; confidence?: Confidence }>) => {
    const actions = items.map((i) => ({ ...i, action: "approve" as const }));
    const res = await fetch("/api/files/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions }),
    });
    if (!res.ok) throw new Error(await res.text());
    await refresh();
  }, [refresh]);

  return { data, loading, error, refresh, approve, reject, batchApprove };
}

export function useAuditLog(date?: string) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      const res = await fetch(`/api/files/audit-log?${params}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setEntries(json.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { refresh(); }, [refresh]);

  return { entries, loading, refresh };
}
