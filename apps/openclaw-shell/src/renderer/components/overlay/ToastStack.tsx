import React, { useCallback, useEffect, useRef } from 'react';
import { useShellStore } from '../../stores/shell-store';
import { on } from '../../lib/ipc-client';
import type { Toast } from '../../stores/shell-store';

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5_000;

const PRIORITY_STYLES: Record<Toast['priority'], { border: string; bg: string }> = {
  info: { border: 'var(--border-default)', bg: 'rgba(24, 24, 27, 0.9)' },
  attention: { border: 'var(--accent-orange)', bg: 'rgba(30, 24, 14, 0.92)' },
  urgent: { border: 'var(--accent-red)', bg: 'rgba(30, 14, 14, 0.95)' },
};

export function ToastStack() {
  const toasts = useShellStore((s) => s.toasts);
  const addToast = useShellStore((s) => s.addToast);
  const removeToast = useShellStore((s) => s.removeToast);
  const setActiveService = useShellStore((s) => s.setActiveService);

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Wire to IPC events
  useEffect(() => {
    const unsubNotification = on('service:notification', (data) => {
      addToast({
        title: data.title,
        body: data.body,
        priority: 'info',
        serviceId: data.serviceId,
      });
    });

    const unsubAgentMessage = on('agent:message', (data) => {
      addToast({
        title: `${data.from}`,
        body: data.content,
        priority: data.viaCd ? 'attention' : 'info',
        taskId: data.taskId,
      });
    });

    const unsubRateLimit = on('ipc:rate-limited', (data) => {
      const retryS = Math.ceil(data.retryAfter / 1000);
      addToast({
        title: 'Rate limit reached',
        body: `Channel "${data.channel}" is throttled. Retry in ${retryS}s.`,
        priority: 'attention',
      });
    });

    return () => {
      unsubNotification();
      unsubAgentMessage();
      unsubRateLimit();
    };
  }, [addToast]);

  // Auto-dismiss non-urgent toasts
  useEffect(() => {
    for (const toast of toasts) {
      if (toast.priority === 'urgent') continue;
      if (timersRef.current.has(toast.id)) continue;

      const timer = setTimeout(() => {
        removeToast(toast.id);
        timersRef.current.delete(toast.id);
      }, AUTO_DISMISS_MS);

      timersRef.current.set(toast.id, timer);
    }

    // Cleanup timers for removed toasts
    for (const [id, timer] of timersRef.current.entries()) {
      if (!toasts.find((t) => t.id === id)) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }
  }, [toasts, removeToast]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const handleClick = useCallback(
    (toast: Toast) => {
      if (toast.serviceId) {
        setActiveService(toast.serviceId);
      }
      removeToast(toast.id);
    },
    [setActiveService, removeToast],
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent, toastId: string) => {
      e.stopPropagation();
      removeToast(toastId);
    },
    [removeToast],
  );

  const visible = toasts.slice(0, MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        zIndex: 100,
        pointerEvents: 'none',
        maxWidth: '320px',
        width: '100%',
      }}
    >
      {visible.map((toast) => {
        const styles = PRIORITY_STYLES[toast.priority];
        return (
          <div
            key={toast.id}
            onClick={() => handleClick(toast)}
            style={{
              pointerEvents: 'auto',
              background: styles.bg,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: `1px solid ${styles.border}`,
              borderRadius: '8px',
              padding: '10px 12px',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
              animation: 'toastSlideIn 0.2s ease-out',
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '2px',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {toast.title}
              </span>
              <button
                onClick={(e) => handleDismiss(e, toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  lineHeight: 1,
                  padding: '0 2px',
                  flexShrink: 0,
                }}
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {toast.body}
            </div>

            {/* Auto-dismiss progress bar (non-urgent only) */}
            {toast.priority !== 'urgent' && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '2px',
                  background: styles.border,
                  animation: `toastProgress ${AUTO_DISMISS_MS}ms linear forwards`,
                  width: '100%',
                }}
              />
            )}
          </div>
        );
      })}

      {/* Queued count indicator */}
      {toasts.length > MAX_VISIBLE && (
        <div
          style={{
            pointerEvents: 'auto',
            textAlign: 'center',
            fontSize: '10px',
            color: 'var(--text-muted)',
            padding: '2px 0',
          }}
        >
          +{toasts.length - MAX_VISIBLE} more
        </div>
      )}
    </div>
  );
}
