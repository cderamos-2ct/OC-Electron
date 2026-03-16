import React, { useState } from 'react';

export interface ApprovalRequest {
  id: string;
  agent: string;
  agentColor: string;
  agentInitial: string;
  action: string;
  detail: string;
  risk: 'low' | 'medium' | 'high';
}

interface ApprovalFlowProps {
  request: ApprovalRequest;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function riskColor(risk: ApprovalRequest['risk']): string {
  return risk === 'high' ? '#ef4444' : risk === 'medium' ? '#f59e0b' : '#22c55e';
}

export function ApprovalFlow({ request, onApprove, onReject }: ApprovalFlowProps) {
  const [acting, setActing] = useState(false);
  const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

  const handle = async (action: 'approved' | 'rejected') => {
    setActing(true);
    setDecided(action);
    if (action === 'approved') onApprove(request.id);
    else onReject(request.id);
    setActing(false);
  };

  return (
    <div
      style={{
        backgroundColor: '#1e1a00',
        border: '1px solid #3a3000',
        borderLeft: '3px solid #f5c842',
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '10px',
        opacity: decided ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        {/* Avatar */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '7px',
            backgroundColor: request.agentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {request.agentInitial}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {request.agent}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              requests approval
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: riskColor(request.risk),
                backgroundColor: `${riskColor(request.risk)}22`,
                padding: '1px 6px',
                borderRadius: '4px',
                marginLeft: 'auto',
              }}
            >
              {request.risk.toUpperCase()} RISK
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#f5c842', margin: '4px 0 0 0', fontWeight: 600 }}>
            {request.action}
          </p>
        </div>
      </div>

      <p
        style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          margin: '0 0 12px 0',
          lineHeight: '1.5',
        }}
      >
        {request.detail}
      </p>

      {decided ? (
        <p
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: decided === 'approved' ? '#22c55e' : '#ef4444',
          }}
        >
          {decided === 'approved' ? 'Approved' : 'Rejected'}
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handle('approved')}
            disabled={acting}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#059669',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Approve
          </button>
          <button
            onClick={() => handle('rejected')}
            disabled={acting}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
