import React from 'react';

interface AgentOverlayToolbarProps {
  onReviewDraft: () => void;
  onSend: () => void;
}

export function AgentOverlayToolbar({ onReviewDraft, onSend }: AgentOverlayToolbarProps) {
  return (
    <div style={{
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      height: 52,
      background: 'rgba(14,14,18,0.88)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid #1e1e28',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 12,
      flexShrink: 0,
    }}>
      {/* Agent identity — dual stacked avatars */}
      <div style={{ position: 'relative', width: 36, height: 28, flexShrink: 0 }}>
        {/* Back avatar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 8,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#1e1e28',
          border: '1px solid #3d2060',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 700,
          color: '#a078e8',
        }}>
          O
        </div>
        {/* Front avatar */}
        <div style={{
          position: 'absolute',
          top: 4,
          left: 0,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: '#3d1228',
          border: '1px solid #7d2040',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 700,
          color: '#e060a0',
        }}>
          K
        </div>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: '#1e1e28' }} />

      {/* Summary text */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9898b0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: '#e060a0' }}>Karoline</span> drafted a reply · triaged by <span style={{ color: '#a078e8' }}>Ops</span>
        </div>
        <div style={{ fontSize: 10, color: '#555568' }}>2 actions pending · last updated 3m ago</div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onReviewDraft}
          style={{
            background: 'rgba(224,96,160,0.1)',
            border: '1px solid rgba(224,96,160,0.3)',
            borderRadius: 8,
            color: '#e060a0',
            fontSize: 11,
            fontWeight: 500,
            padding: '5px 12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Review Draft
        </button>
        <button
          onClick={onSend}
          style={{
            background: 'rgba(194,112,58,0.15)',
            border: '1px solid rgba(194,112,58,0.4)',
            borderRadius: 8,
            color: '#ffb86b',
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Send Now
        </button>
        <button
          style={{
            background: 'transparent',
            border: '1px solid #1e1e28',
            borderRadius: 8,
            color: '#555568',
            fontSize: 11,
            padding: '5px 10px',
            cursor: 'pointer',
          }}
        >
          ···
        </button>
      </div>
    </div>
  );
}
