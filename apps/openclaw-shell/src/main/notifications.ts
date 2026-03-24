// Native OS notifications for the OpenClaw Shell
// Fires macOS notification center alerts when the window is not focused

import { Notification, BrowserWindow } from 'electron';

export type NotificationPriority = 'info' | 'attention' | 'urgent';

export interface ShellNotification {
  title: string;
  body: string;
  priority: NotificationPriority;
  serviceId?: string;
  actionId?: string;
}

let mainWindow: BrowserWindow | null = null;

export function setNotificationWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

/**
 * Show a native OS notification if the shell window is not focused.
 * - 'info' priority: never fires native notification (toast-only in renderer)
 * - 'attention' priority: fires when window is not focused
 * - 'urgent' priority: always fires native notification
 */
export function showNativeNotification(notification: ShellNotification): void {
  if (!Notification.isSupported()) return;

  const windowFocused = mainWindow?.isFocused() ?? false;

  // Info-level notifications are renderer-only (toast)
  if (notification.priority === 'info') return;

  // Attention-level only fires when window is not focused
  if (notification.priority === 'attention' && windowFocused) return;

  // Urgent always fires

  const n = new Notification({
    title: notification.title,
    body: notification.body,
    silent: notification.priority !== 'urgent',
    urgency: notification.priority === 'urgent' ? 'critical' : 'normal',
  });

  n.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();

      // Navigate to relevant context
      if (notification.serviceId) {
        mainWindow.webContents.send('shell:focus-service', {
          serviceId: notification.serviceId,
        });
      }
      if (notification.actionId) {
        mainWindow.webContents.send('shell:toggle-rail', undefined);
      }
    }
  });

  n.show();
}

/**
 * Classify a gateway event into a notification priority.
 */
export function classifyEventPriority(event: string, payload?: unknown): NotificationPriority {
  // Urgent: approval requests, external message needs reply, system failures
  if (event === 'cd.action.request') return 'urgent';
  if (event === 'exec.approval.requested') return 'urgent';

  // Attention: task blocked, agent errors
  const p = payload as Record<string, unknown> | undefined;
  if (p?.priority === 'needs_now' || p?.priority === 'urgent') return 'urgent';
  if (p?.priority === 'high') return 'attention';

  // Routine system noise should never surface as native notifications.
  if (event === 'heartbeat' || event === 'tick' || event === 'presence' || event === 'health') {
    return 'info';
  }

  // Default: attention for unknown events with payloads
  return 'attention';
}
