import React, { useCallback, useEffect, useState } from 'react';
import type { PendingApproval, ApprovalResult, CDActionResult } from '../../../shared/types';
import {
  approvalList,
  approvalDecide,
  onApprovalRequested,
  onApprovalResolved,
} from '../../lib/ipc-client';
import { useShellStore } from '../../stores/shell-store';

const ACTION_ICONS: Record<string, string> = {
  click: '\u25B6',
  fill: '\u270E',
  select: '\u2611',
  navigate: '\u2192',
  read: '\u25CE',
  scroll: '\u2195',
};

const RISK_COLORS: Record<string, string> = {
  silent: '#22c55e',
  confirm: '#f59e0b',
  'confirm-send': '#ef4444',
};

export function ActionPanel() {
  const actionPanelVisible = useShellStore((s) => s.actionPanelVisible);
  const setActionPanelVisible = useShellStore((s) => s.setActionPanelVisible);
  const setPendingActionCount = useShellStore((s) => s.setPendingActionCount);

  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [deciding, setDeciding] = useState<Set<string>>(new Set());
  const [batchDeciding, setBatchDeciding] = useState(false);

  // Sync pending count to store
  useEffect(() => {
    setPendingActionCount(pending.length);
  }, [pending.length, setPendingActionCount]);

  // Load pending approvals on mount
  useEffect(() => {
    void approvalList().then(setPending);
  }, []);

  // Subscribe to new requests and resolutions
  useEffect(() => {
    const unsubReq = onApprovalRequested((approval) => {
      setPending((prev) => {
        if (prev.find((p) => p.action.id === approval.action.id)) return prev;
        return [...prev, approval];
      });
      // Auto-show panel when new actions arrive
      if (!actionPanelVisible) {
        setActionPanelVisible(true);
      }
    });

    const unsubRes = onApprovalResolved((result) => {
      setPending((prev) => prev.filter((p) => p.action.id !== result.actionId));
      setDeciding((prev) => {
        const next = new Set(prev);
        next.delete(result.actionId);
        return next;
      });
    });

    return () => {
      unsubReq();
      unsubRes();
    };
  }, [actionPanelVisible, setActionPanelVisible]);

  const handleDecide = useCallback(
    async (actionId: string, decision: 'approved' | 'denied') => {
      setDeciding((prev) => new Set(prev).add(actionId));
      try {
        await approvalDecide(actionId, decision);
      } catch {
        setDeciding((prev) => {
          const next = new Set(prev);
          next.delete(actionId);
          return next;
        });
      }
    },
    [],
  );

  const handleBatchApprove = useCallback(async () => {
    setBatchDeciding(true);
    try {
      const ids = pending.map((p) => p.action.id);
      setDeciding(new Set(ids));
      await Promise.allSettled(ids.map((id) => approvalDecide(id, 'approved')));
    } finally {
      setBatchDeciding(false);
    }
  }, [pending]);

  const handleDiscard = useCallback(
    async (actionId: string) => {
      await handleDecide(actionId, 'denied');
    },
    [handleDecide],
  );

  // Don't render if hidden or no pending actions
  if (!actionPanelVisible || pending.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '52px', // above AgentStatusBar
        left: '8px',
        right: '8px',
        maxHeight: '320px',
        background: 'rgba(24, 24, 27, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--accent-orange)',
        borderRadius: '10px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 90,
        animation: 'actionPanelSlideUp 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-default)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          Pending Actions
        </span>
        <span
          style={{
            marginLeft: '8px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#fff',
            background: 'var(--accent-orange)',
            borderRadius: '10px',
            padding: '1px 7px',
            lineHeight: '14px',
          }}
        >
          {pending.length}
        </span>

        <div style={{ flex: 1 }} />

        {/* Batch approve */}
        <button
          onClick={handleBatchApprove}
          disabled={batchDeciding}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#fff',
            background: '#16a34a',
            border: 'none',
            borderRadius: '4px',
            padding: '3px 10px',
            cursor: batchDeciding ? 'wait' : 'pointer',
            marginRight: '6px',
          }}
        >
          Approve All
        </button>

        {/* Close button */}
        <button
          onClick={() => setActionPanelVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          &times;
        </button>
      </div>

      {/* Action list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {pending.map((p) => {
          const { action } = p;
          const isDeciding = deciding.has(action.id);
          const riskColor = RISK_COLORS[action.riskTier] ?? '#71717a';
          const icon = ACTION_ICONS[action.type] ?? '?';

          return (
            <div
              key={action.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                opacity: isDeciding ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>

              {/* Description */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {action.description}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginTop: '1px',
                  }}
                >
                  {action.agentId} &middot; {action.serviceId}
                </div>
              </div>

              {/* Risk badge */}
              <span
                style={{
                  fontSize: '9px',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  background: riskColor + '22',
                  color: riskColor,
                  fontWeight: 700,
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}
              >
                {action.riskTier}
              </span>

              {/* Action buttons */}
              <button
                onClick={() => handleDecide(action.id, 'approved')}
                disabled={isDeciding}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fff',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  cursor: isDeciding ? 'wait' : 'pointer',
                  flexShrink: 0,
                }}
              >
                Approve
              </button>
              <button
                onClick={() => handleDiscard(action.id)}
                disabled={isDeciding}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fca5a5',
                  background: '#7f1d1d',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  cursor: isDeciding ? 'wait' : 'pointer',
                  flexShrink: 0,
                }}
              >
                Discard
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
