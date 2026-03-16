import React, { useState } from 'react';

export interface Blocker {
  id: string;
  text: string;
  agent: string;
  actionLabel?: string;
}

interface BlockerCardProps {
  blocker: Blocker;
}

export function BlockerCard({ blocker }: BlockerCardProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      style={{
        backgroundColor: '#2d1520',
        border: '1px solid #5e1f2d',
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '10px',
      }}
    >
      {/* ID badge */}
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#f87171',
          backgroundColor: '#5e1f2d',
          padding: '2px 8px',
          borderRadius: '4px',
          flexShrink: 0,
          letterSpacing: '0.04em',
          marginTop: '1px',
        }}
      >
        {blocker.id}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: '12px',
            color: '#fca5a5',
            margin: '0 0 8px 0',
            lineHeight: '1.5',
          }}
        >
          {blocker.text}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '10px',
              color: '#f87171',
              backgroundColor: '#3d1520',
              padding: '1px 8px',
              borderRadius: '999px',
            }}
          >
            {blocker.agent}
          </span>
          {blocker.actionLabel && (
            <button
              onClick={() => setDismissed(true)}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#ef4444',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0',
                textDecoration: 'underline',
              }}
            >
              {blocker.actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
