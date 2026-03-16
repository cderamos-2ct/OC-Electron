import React from 'react';

interface ConfirmSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recipient?: string;
  subject?: string;
  channel?: string;
}

export function ConfirmSendModal({
  isOpen,
  onClose,
  onConfirm,
  recipient = 'Sarah Chen',
  subject = 'Q1 Design Review — Feedback Needed',
  channel = 'Email',
}: ConfirmSendModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#18181f',
          border: '1px solid #2a2a38',
          borderRadius: 12,
          maxWidth: 440,
          width: '90%',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📤</span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e8e8f0' }}>
            Confirm Send
          </h3>
        </div>

        {/* Details */}
        <div style={{
          background: '#0e0e12',
          border: '1px solid #1e1e28',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {[
            { label: 'To', value: recipient },
            { label: 'Subject', value: subject },
            { label: 'Via', value: channel },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <span style={{ color: '#555568', minWidth: 52 }}>{label}</span>
              <span style={{ color: '#c8c8d8', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Agent note */}
        <div style={{
          background: '#1e1218',
          border: '1px solid #4d1f2d',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
          color: '#c090a0',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 14 }}>🤖</span>
          <span>
            <strong style={{ color: '#e060a0' }}>Karoline</strong> drafted this reply. Tone: professional, concise.
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #2a2a38',
              borderRadius: 8,
              color: '#9898b0',
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 18px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            style={{
              background: '#3c1e17',
              border: '1px solid #c2703a',
              borderRadius: 8,
              color: '#ffb86b',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 18px',
              cursor: 'pointer',
            }}
          >
            Send Now
          </button>
        </div>
      </div>
    </div>
  );
}
