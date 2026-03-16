import React from 'react';
import type { PendingVaultApproval } from '../../../shared/types.js';

interface GatekeeperPromptProps {
  approval: PendingVaultApproval;
  onApprove: () => void;
  onDeny: () => void;
  onClose: () => void;
}

export function GatekeeperPrompt({ approval, onApprove, onDeny, onClose }: GatekeeperPromptProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid #ef444460',
          borderRadius: '14px',
          padding: '32px',
          width: '440px',
          maxWidth: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: '#ef444420',
              border: '1px solid #ef444440',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            🛡️
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Themis — Gatekeeper
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              High-risk secret access approval required
            </div>
          </div>
        </div>

        {/* Details */}
        <div
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Agent</span>
            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
              {approval.agentId}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Secret</span>
            <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
              {approval.secretName}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Purpose</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              {approval.purpose}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Requested</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {new Date(approval.requestedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Warning */}
        <div
          style={{
            background: '#ef444412',
            border: '1px solid #ef444430',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '24px',
            fontSize: '12px',
            color: '#ef4444',
          }}
        >
          This request requires explicit approval due to policy constraints. Approving grants immediate access.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-muted)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
          <button
            onClick={onDeny}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #ef444460',
              background: '#ef444420',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Deny
          </button>
          <button
            onClick={onApprove}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#22c55e',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
