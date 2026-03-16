"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOpenClaw } from "@/contexts/OpenClawContext";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastPriority = "info" | "warning" | "urgent";

interface Toast {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  priority: ToastPriority;
  exiting: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolvePriority(urgency: string | undefined): ToastPriority {
  if (urgency === "needs_now") return "urgent";
  if (urgency === "high") return "warning";
  return "info";
}

function priorityColor(priority: ToastPriority): string {
  if (priority === "urgent") return "#ef4444";
  if (priority === "warning") return "#f59e0b";
  return "#3b82f6";
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio not available — silently skip
  }
}

let toastSeq = 0;
function nextId(): string {
  return `toast-${++toastSeq}-${Date.now()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ToastNotificationStack() {
  const { subscribe } = useOpenClaw();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Dismiss helper — starts exit animation then removes
  const dismiss = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  };

  const addToast = (toast: Omit<Toast, "id" | "exiting">) => {
    const id = nextId();
    const entry: Toast = { ...toast, id, exiting: false };

    if (toast.priority === "urgent") {
      playBeep();
    }

    setToasts((prev) => {
      // Keep at most 3 visible; drop oldest if needed
      const next = [...prev, entry];
      if (next.length > 3) {
        const removed = next.shift()!;
        clearTimeout(timers.current.get(removed.id));
        timers.current.delete(removed.id);
      }
      return next;
    });

    const timer = setTimeout(() => dismiss(id), 8_000);
    timers.current.set(id, timer);
  };

  // Subscribe to gateway events
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribe("chat", (payload) => {
        const p = payload as Record<string, unknown> | null | undefined;
        if (!p) return;
        const role = p["role"] as string | undefined;
        if (role === "user") return; // skip user messages
        const agentId = (p["agentId"] as string | undefined) ?? "Agent";
        const content =
          (p["content"] as string | undefined) ??
          (p["text"] as string | undefined) ??
          "";
        const urgency = p["urgency"] as string | undefined;
        addToast({
          title: agentId,
          message: content.slice(0, 120) || "(no content)",
          timestamp: new Date(),
          priority: resolvePriority(urgency),
        });
      })
    );

    unsubs.push(
      subscribe("agent", (payload) => {
        const p = payload as Record<string, unknown> | null | undefined;
        if (!p) return;
        const agentId = (p["agentId"] as string | undefined) ?? "Agent";
        const status = (p["status"] as string | undefined) ?? "";
        const message =
          (p["message"] as string | undefined) ?? `Status: ${status}`;
        const urgency = p["urgency"] as string | undefined;
        addToast({
          title: `${agentId} — ${status}`,
          message: message.slice(0, 120) || "(no message)",
          timestamp: new Date(),
          priority: resolvePriority(urgency),
        });
      })
    );

    unsubs.push(
      subscribe("heartbeat", (payload) => {
        const p = payload as Record<string, unknown> | null | undefined;
        if (!p) return;
        const agentId = (p["agentId"] as string | undefined) ?? "System";
        const summary =
          (p["summary"] as string | undefined) ??
          (p["message"] as string | undefined) ??
          "";
        const urgency = p["urgency"] as string | undefined;
        addToast({
          title: `Heartbeat — ${agentId}`,
          message: summary.slice(0, 120) || "(no summary)",
          timestamp: new Date(),
          priority: resolvePriority(urgency),
        });
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notifications"
      style={{
        position: "fixed",
        top: "1rem",
        right: "1rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        pointerEvents: "none",
        width: "22rem",
        maxWidth: "calc(100vw - 2rem)",
      }}
    >
      <style>{`
        @keyframes oc-toast-in {
          from { opacity: 0; transform: translateX(110%); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes oc-toast-out {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(110%); }
        }
        .oc-toast-enter { animation: oc-toast-in 0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
        .oc-toast-exit  { animation: oc-toast-out 0.3s ease-in forwards; }
      `}</style>

      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={toast.exiting ? "oc-toast-exit" : "oc-toast-enter"}
          onClick={() => dismiss(toast.id)}
          style={{
            pointerEvents: "all",
            cursor: "pointer",
            display: "flex",
            alignItems: "stretch",
            borderRadius: "0.5rem",
            overflow: "hidden",
            background: "var(--card, #0d1e2b)",
            border: "1px solid var(--border, #1e3a4a)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          {/* Colored left border */}
          <div
            style={{
              width: "4px",
              flexShrink: 0,
              background: priorityColor(toast.priority),
            }}
          />

          {/* Content */}
          <div style={{ padding: "0.625rem 0.75rem", flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "0.5rem",
                marginBottom: "0.25rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text-primary, #e2e8f0)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {toast.title}
              </span>
              <span
                style={{
                  fontSize: "0.65rem",
                  color: "var(--text-muted, #64748b)",
                  flexShrink: 0,
                }}
              >
                {formatTime(toast.timestamp)}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "0.7rem",
                color: "var(--text-secondary, #94a3b8)",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {toast.message}
            </p>
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}
