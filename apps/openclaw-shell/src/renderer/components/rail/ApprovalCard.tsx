import React, { useCallback, useEffect, useState } from 'react';
import type { PendingApproval, ApprovalResult, CDActionResult } from '../../../shared/types';
import {
  approvalList,
  approvalDecide,
  onApprovalRequested,
  onApprovalResolved,
} from '../../lib/ipc-client';

const RISK_COLORS: Record<string, string> = {
  silent: '#22c55e',
  confirm: '#f59e0b',
  'confirm-send': '#ef4444',
};

const RISK_LABELS: Record<string, string> = {
  silent: 'Read',
  confirm: 'Interaction',
  'confirm-send': 'Send',
};

const ACTION_ICONS: Record<string, string> = {
  click: '\u25B6',    // play
  fill: '\u270E',     // pencil
  select: '\u2611',   // checkbox
  navigate: '\u2192', // arrow
  read: '\u25CE',     // eye
  scroll: '\u2195',   // up-down
};

export function ApprovalCard() {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [deciding, setDeciding] = useState<Set<string>>(new Set());

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
  }, []);

  const handleDecide = useCallback(
    async (actionId: string, decision: 'approved' | 'denied', alwaysAllow = false) => {
      setDeciding((prev) => new Set(prev).add(actionId));
      try {
        await approvalDecide(actionId, decision, alwaysAllow);
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

  if (pending.length === 0) return null;

  return (
    <div
      style={{
        borderBottom: '1px solid #3f3f46',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '6px 12px',
          fontSize: '11px',
          fontWeight: 600,
          color: '#f59e0b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          borderBottom: '1px solid #3f3f46',
          background: '#1c1917',
        }}
      >
        Pending Approvals ({pending.length})
      </div>

      {pending.map((p) => {
        const { action } = p;
        const isDeciding = deciding.has(action.id);
        const riskColor = RISK_COLORS[action.riskTier] ?? '#71717a';
        const riskLabel = RISK_LABELS[action.riskTier] ?? action.riskTier;
        const icon = ACTION_ICONS[action.type] ?? '?';

        return (
          <div
            key={action.id}
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #27272a',
              opacity: isDeciding ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {/* Header: action type + risk badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '4px',
              }}
            >
              <span style={{ fontSize: '14px' }}>{icon}</span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#f4f4f5',
                  textTransform: 'capitalize',
                }}
              >
                {action.type}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: riskColor + '22',
                  color: riskColor,
                  fontWeight: 600,
                  marginLeft: 'auto',
                }}
              >
                {riskLabel}
              </span>
            </div>

            {/* Description */}
            <div
              style={{
                fontSize: '11px',
                color: '#a1a1aa',
                marginBottom: '4px',
                lineHeight: '1.4',
              }}
            >
              {action.description}
            </div>

            {/* Target info */}
            <div
              style={{
                fontSize: '10px',
                color: '#71717a',
                marginBottom: '6px',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {action.target.selector ??
                action.target.url ??
                action.target.text ??
                action.serviceId}
            </div>

            {/* Agent + service */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                fontSize: '10px',
                color: '#52525b',
                marginBottom: '8px',
              }}
            >
              <span>Agent: {action.agentId}</span>
              <span>Tab: {action.serviceId}</span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => handleDecide(action.id, 'approved')}
                disabled={isDeciding}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fff',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isDeciding ? 'wait' : 'pointer',
                }}
              >
                Approve
              </button>
              <button
                onClick={() => handleDecide(action.id, 'denied')}
                disabled={isDeciding}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fca5a5',
                  background: '#7f1d1d',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isDeciding ? 'wait' : 'pointer',
                }}
              >
                Deny
              </button>
              <button
                onClick={() => handleDecide(action.id, 'approved', true)}
                disabled={isDeciding}
                title="Approve and always allow this action type for this agent+service"
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#a78bfa',
                  background: '#2e1065',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isDeciding ? 'wait' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Always
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
