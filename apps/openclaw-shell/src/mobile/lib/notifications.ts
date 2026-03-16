// notifications.ts — Push notification lifecycle manager
// Handles permission, VAPID subscription, and gateway registration.

import type { MobileGatewayClient } from './mobile-gateway';

// VAPID public key — set via env var, falls back to empty (local-only mode)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type NotificationCategory = 'agent_alerts' | 'task_approvals' | 'comms' | 'calendar';

export const NOTIFICATION_CATEGORIES: Record<NotificationCategory, string> = {
  agent_alerts: 'Agent Alerts',
  task_approvals: 'Task Approvals',
  comms: 'Communications',
  calendar: 'Calendar',
};

// ─── Permission ──────────────────────────────────────────────────────────────

/**
 * Request Notification permission from the browser.
 * Returns the resulting permission state.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.requestPermission();
}

/**
 * Current notification permission state.
 */
export function getPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

/**
 * Get the current PushSubscription, or null if not subscribed.
 */
export async function getSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Create a new PushSubscription using the VAPID public key.
 * Returns null if push is not supported or subscription fails.
 */
export async function subscribe(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const permission = await requestPermission();
  if (permission !== 'granted') return null;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Return existing subscription if present
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;

    const subscribeOptions: PushSubscriptionOptionsInit = { userVisibleOnly: true };

    if (VAPID_PUBLIC_KEY) {
      subscribeOptions.applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource;
    }

    return reg.pushManager.subscribe(subscribeOptions);
  } catch (err) {
    console.warn('[notifications] subscribe failed:', err);
    return null;
  }
}

/**
 * Remove the current PushSubscription.
 */
export async function unsubscribe(): Promise<boolean> {
  const sub = await getSubscription();
  if (!sub) return true;
  try {
    return sub.unsubscribe();
  } catch {
    return false;
  }
}

// ─── Gateway registration ─────────────────────────────────────────────────────

/**
 * Send the push subscription to the Aegilume gateway so the server
 * can push notifications to this device.
 */
export async function sendSubscriptionToGateway(
  gateway: MobileGatewayClient,
  subscription: PushSubscription
): Promise<void> {
  const payload = subscription.toJSON();
  await gateway.request('push.subscribe', {
    endpoint: payload.endpoint,
    keys: payload.keys,
  });
}

// ─── Local notification ───────────────────────────────────────────────────────

/**
 * Show a local notification via the service worker (works when app is backgrounded).
 */
export async function showNotification(
  title: string,
  body: string,
  options?: { tag?: string; url?: string; category?: NotificationCategory }
): Promise<void> {
  if (getPermission() !== 'granted') return;

  const notifOptions: NotificationOptions = {
    body,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: options?.tag ?? 'openclaw',
    data: { url: options?.url ?? '/', category: options?.category },
    requireInteraction: false,
  };

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, notifOptions);
      return;
    } catch {
      // fall through to direct Notification
    }
  }

  new Notification(title, notifOptions);
}

// ─── Category preferences ─────────────────────────────────────────────────────

const PREFS_KEY = 'openclaw-notif-prefs';

export type NotificationPrefs = Record<NotificationCategory, boolean>;

export function getPrefs(): NotificationPrefs {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) return JSON.parse(stored) as NotificationPrefs;
  } catch {/* ignore */}
  // Default: all categories enabled
  return {
    agent_alerts: true,
    task_approvals: true,
    comms: true,
    calendar: true,
  };
}

export function savePrefs(prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {/* ignore */}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a base64url VAPID key to a Uint8Array for the Push API. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
