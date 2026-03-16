import React from 'react';
import type { PendingVaultApproval } from '../../../shared/types.js';

interface PendingApprovalCardProps {
  approval: PendingVaultApproval;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}

const AGENT_AVATARS: Record<string, string> = {
  default: '🤖',
  finance: '💰',
  comms: '📡',
  research: '🔬',
  ops: '⚙️',
  build: '🔨',
};

function agentAvatar(agentId: string): string {
  for (const [key, avatar] of Object.entries(AGENT_AVATARS)) {
    if (agentId.toLowerCase().includes(key)) return avatar;
  }
  return AGENT_AVATARS.default;
}

export function PendingApprovalCard({ approval, onApprove, onDeny }: PendingApprovalCardProps) {
  const requestedAgo = Math.floor(
    (Date.now() - new Date(approval.requestedAt).getTime()) / 1000
  );
  const agoLabel =
    requestedAgo < 60
      ? `${requestedAgo}s ago`
      : requestedAgo < 3600
      ? `${Math.floor(requestedAgo / 60)}m ago`
      : `${Math.floor(requestedAgo / 3600)}h ago`;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card, var(--bg-tertiary))',
        border: '1px solid #f59e0b40',
        borderRadius: '10px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}
    >
      {/* Agent avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          flexShrink: 0,
          border: '1px solid var(--border-default)',
        }}
      >
        {agentAvatar(approval.agentId)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {approval.agentId}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginTop: '2px',
          }}
        >
          Requesting: <span style={{ color: '#f59e0b', fontWeight: 500 }}>{approval.secretName}</span>
        </div>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '3px',
            fontStyle: 'italic',
          }}
        >
          {approval.purpose}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {agoLabel}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={() => onDeny(approval.id)}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid var(--border-default)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Deny
        </button>
        <button
          onClick={() => onApprove(approval.id)}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            border: 'none',
            background: '#22c55e',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
