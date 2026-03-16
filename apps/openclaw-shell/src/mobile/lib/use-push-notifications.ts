// usePushNotifications — handles permission request, SW subscription, and
// relays push messages from the service worker to the app.

import { useState, useEffect, useCallback } from 'react';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface PushNotificationState {
  permission: PushPermission;
  subscription: PushSubscription | null;
  requestPermission: () => Promise<void>;
}

/**
 * Hook that manages push notification permission + subscription lifecycle.
 *
 * Usage:
 *   const { permission, requestPermission } = usePushNotifications(onMessage);
 *
 * @param onMessage  Optional callback invoked when the SW sends a
 *                   FLUSH_ACTION_QUEUE or other SW→app message.
 */
export function usePushNotifications(
  onMessage?: (data: unknown) => void
): PushNotificationState {
  const [permission, setPermission] = useState<PushPermission>(getInitialPermission);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  // Keep permission state in sync with the browser's Notification permission
  useEffect(() => {
    if (typeof Notification === 'undefined') return;

    const update = () => setPermission(Notification.permission as PushPermission);

    // Some browsers expose permissionchange on the Notification object
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' })
        .then((status) => {
          status.addEventListener('change', update);
          return () => status.removeEventListener('change', update);
        })
        .catch(() => {/* permissions API not available */});
    }
  }, []);

  // Subscribe once we have permission and a registered SW
  useEffect(() => {
    if (permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setSubscription(sub);
      })
      .catch(() => {/* push manager may not exist in all environments */});

    return () => { cancelled = true; };
  }, [permission]);

  // Listen for messages from the service worker (e.g., FLUSH_ACTION_QUEUE)
  useEffect(() => {
    if (!onMessage || !('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent) => {
      onMessage(event.data);
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [onMessage]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    if (permission === 'denied') return;

    const result = await Notification.requestPermission();
    setPermission(result as PushPermission);

    if (result === 'granted' && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setSubscription(existing);
          return;
        }
        // Subscribe — VAPID public key would come from the gateway config.
        // For now we store without a server key (local-only notifications work).
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // applicationServerKey will be wired up when gateway push endpoint is live
        }).catch(() => null);
        setSubscription(sub);
      } catch {
        // Push subscription is optional; local notifications still work
      }
    }
  }, [permission]);

  return { permission, subscription, requestPermission };
}

function getInitialPermission(): PushPermission {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PushPermission;
}

/**
 * Fire a local (in-browser) notification without a push server.
 * Used to notify the user of high-priority agent events while the app is open.
 */
export function showLocalNotification(title: string, body: string, tag?: string): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  // Prefer SW notification (shows even when app is backgrounded)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) =>
        reg.showNotification(title, {
          body,
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          tag: tag ?? 'openclaw-local',
        })
      )
      .catch(() => new Notification(title, { body, tag }));
    return;
  }

  new Notification(title, { body, tag });
}
