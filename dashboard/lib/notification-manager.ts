// notification-manager.ts
// Manages OS-level (Web Notifications API) alerts for backgrounded tabs.
// This module is parallel to ToastNotificationStack — they are independent systems.

let permissionGranted = false;
let isHidden = false;

export function initNotificationManager(): void {
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    Notification.requestPermission().then((p) => {
      permissionGranted = p === "granted";
    });
  } else {
    permissionGranted = Notification.permission === "granted";
  }

  // Track tab visibility so we only fire OS notifications when the tab is hidden
  document.addEventListener("visibilitychange", () => {
    isHidden = document.hidden;
  });
  // Initialise from current state
  isHidden = document.hidden;
}

export function shouldShowOsNotification(): boolean {
  return permissionGranted && isHidden;
}

export function showOsNotification(
  title: string,
  body: string,
  options?: { tag?: string; urgency?: string }
): void {
  if (!shouldShowOsNotification()) return;

  // Only notify for warning-level and above; skip info/low/normal
  const urgency = options?.urgency;
  if (
    urgency === "info" ||
    urgency === "low" ||
    urgency === "normal" ||
    urgency === undefined
  ) {
    return;
  }

  const n = new Notification(title, {
    body,
    icon: "/icon",
    tag: options?.tag ?? "openclaw-alert",
    silent: urgency !== "urgent",
  });

  // Bring the tab into focus when the user clicks the notification
  n.onclick = () => {
    window.focus();
    n.close();
  };

  // Auto-close after 10 seconds to avoid notification pile-up
  setTimeout(() => n.close(), 10_000);
}
