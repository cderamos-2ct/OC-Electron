"use client";

import { useEffect } from "react";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import { ToastNotificationStack } from "@/components/ToastNotificationStack";
import {
  initNotificationManager,
  shouldShowOsNotification,
  showOsNotification,
} from "@/lib/notification-manager";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapUrgencyToOsLevel(urgency: string | undefined): string {
  if (urgency === "needs_now") return "urgent";
  if (urgency === "high") return "warning";
  return "info";
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * NotificationLayer
 *
 * Single mount point for both in-app toasts (ToastNotificationStack) and
 * OS-level browser notifications (notification-manager). Mount this once
 * inside <OpenClawProvider>, before <AppShell>.
 */
export function NotificationLayer() {
  const { subscribe } = useOpenClaw();

  // Initialise the OS notification manager once on mount
  useEffect(() => {
    initNotificationManager();
  }, []);

  // Subscribe to gateway events and fire OS notifications when the tab is hidden
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      subscribe("chat", (payload) => {
        if (!shouldShowOsNotification()) return;
        const p = payload as Record<string, unknown> | null | undefined;
        if (!p) return;
        if ((p["role"] as string | undefined) === "user") return;
        const agentId = (p["agentId"] as string | undefined) ?? "Agent";
        const content =
          (p["content"] as string | undefined) ??
          (p["text"] as string | undefined) ??
          "";
        const urgency = mapUrgencyToOsLevel(p["urgency"] as string | undefined);
        showOsNotification(`Message from ${agentId}`, content.slice(0, 200), {
          tag: `openclaw-chat-${agentId}`,
          urgency,
        });
      })
    );

    unsubs.push(
      subscribe("agent", (payload) => {
        if (!shouldShowOsNotification()) return;
        const p = payload as Record<string, unknown> | null | undefined;
        if (!p) return;
        const agentId = (p["agentId"] as string | undefined) ?? "Agent";
        const status = (p["status"] as string | undefined) ?? "";
        const message =
          (p["message"] as string | undefined) ?? `Status: ${status}`;
        const urgency = mapUrgencyToOsLevel(p["urgency"] as string | undefined);
        showOsNotification(`${agentId} — ${status}`, message.slice(0, 200), {
          tag: `openclaw-agent-${agentId}`,
          urgency,
        });
      })
    );

    unsubs.push(
      subscribe("heartbeat", (payload) => {
        if (!shouldShowOsNotification()) return;
        const p = payload as Record<string, unknown> | null | undefined;
        if (!p) return;
        const agentId = (p["agentId"] as string | undefined) ?? "System";
        const summary =
          (p["summary"] as string | undefined) ??
          (p["message"] as string | undefined) ??
          "";
        const urgency = mapUrgencyToOsLevel(p["urgency"] as string | undefined);
        showOsNotification(
          `Heartbeat — ${agentId}`,
          summary.slice(0, 200),
          { tag: `openclaw-heartbeat-${agentId}`, urgency }
        );
      })
    );

    return () => {
      unsubs.forEach((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  return <ToastNotificationStack />;
}
