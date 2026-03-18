import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * Persistent top banner shown when the gateway is disconnected.
 * Non-modal — sits at the top of the content area.
 * Auto-shows on disconnect, auto-hides on reconnect.
 */
export function OfflineBanner() {
  const { isGatewayConnected, isOnline, pendingCount } = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  const isOffline = !isGatewayConnected;

  // Auto-show whenever we go offline
  useEffect(() => {
    if (isOffline) {
      setDismissed(false);
    }
  }, [isOffline]);

  if (!isOffline || dismissed) return null;

  const isReconnecting = isOnline && !isGatewayConnected;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        background: 'var(--accent, #d4a843)',
        color: 'var(--bg, #0f0f10)',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.2px',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--bg, #0f0f10)',
            opacity: 0.7,
            flexShrink: 0,
          }}
        />
        {isReconnecting ? (
          <span>Reconnecting...</span>
        ) : (
          <span>
            {"You're offline"}
            {pendingCount > 0 && (
              <span style={{ marginLeft: '6px', opacity: 0.75 }}>
                — {pendingCount} {pendingCount === 1 ? 'action' : 'actions'} queued
              </span>
            )}
          </span>
        )}
      </span>

      {!isReconnecting && (
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--bg, #0f0f10)',
            opacity: 0.6,
            fontSize: '11px',
            padding: '0 2px',
            lineHeight: 1,
          }}
          aria-label="Dismiss offline banner"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
