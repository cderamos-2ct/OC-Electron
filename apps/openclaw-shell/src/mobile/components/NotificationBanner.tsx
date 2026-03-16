// NotificationBanner — dismissable banner prompting push notification opt-in
// Shows on first visit when permission is 'default'.
// Includes per-category notification preferences toggle.

import { useState } from 'react';
import {
  NOTIFICATION_CATEGORIES,
  getPrefs,
  savePrefs,
  subscribe,
  sendSubscriptionToGateway,
  type NotificationCategory,
  type NotificationPrefs,
} from '../lib/notifications';
import type { MobileGatewayClient } from '../lib/mobile-gateway';

interface NotificationBannerProps {
  /** Current Notification.permission value */
  permission: NotificationPermission | 'unsupported';
  gateway: MobileGatewayClient;
  onPermissionGranted?: () => void;
}

export function NotificationBanner({
  permission,
  gateway,
  onPermissionGranted,
}: NotificationBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(getPrefs);
  const [loading, setLoading] = useState(false);

  // Don't show if: already dismissed, not 'default', or unsupported
  if (dismissed || permission !== 'default') return null;

  async function handleAllow() {
    setLoading(true);
    try {
      const sub = await subscribe();
      if (sub) {
        try {
          await sendSubscriptionToGateway(gateway, sub);
        } catch {
          // Gateway registration is best-effort; local notifications still work
        }
        onPermissionGranted?.();
      }
    } finally {
      setLoading(false);
      setDismissed(true);
    }
  }

  function toggleCategory(cat: NotificationCategory) {
    const next = { ...prefs, [cat]: !prefs[cat] };
    setPrefs(next);
    savePrefs(next);
  }

  return (
    <div style={{
      background: '#161618',
      borderBottom: '1px solid #27272a',
      fontSize: '13px',
    }}>
      {/* Main prompt row */}
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ flex: 1, color: '#a1a1aa', lineHeight: 1.4 }}>
          Get alerted on high-priority tasks and agent activity.
        </span>

        <button
          onClick={() => setShowPrefs((v) => !v)}
          style={{
            background: 'none',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            color: '#71717a',
            cursor: 'pointer',
            padding: '5px 10px',
            fontSize: '12px',
            flexShrink: 0,
          }}
        >
          {showPrefs ? 'Hide' : 'Options'}
        </button>

        <button
          onClick={handleAllow}
          disabled={loading}
          style={{
            background: '#a3862a',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: 600,
            flexShrink: 0,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Enabling…' : 'Allow'}
        </button>

        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#52525b',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px',
            lineHeight: 1,
          }}
          aria-label="Dismiss notification prompt"
        >
          ✕
        </button>
      </div>

      {/* Category preferences */}
      {showPrefs && (
        <div style={{
          padding: '8px 16px 12px',
          borderTop: '1px solid #27272a',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <p style={{ margin: 0, color: '#71717a', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Notify me about
          </p>
          {(Object.entries(NOTIFICATION_CATEGORIES) as [NotificationCategory, string][]).map(([cat, label]) => (
            <label
              key={cat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                color: '#a1a1aa',
              }}
            >
              <input
                type="checkbox"
                checked={prefs[cat]}
                onChange={() => toggleCategory(cat)}
                style={{ accentColor: '#a3862a', width: '15px', height: '15px' }}
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
