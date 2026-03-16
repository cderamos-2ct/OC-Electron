import React from 'react';
import type { CalendarEvent } from '../../../shared/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventDetailPanelProps {
  event: CalendarEvent;
  onClose: () => void;
}

// ─── EventDetailPanel ─────────────────────────────────────────────────────────

export function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 100,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380,
          background: 'var(--bg-card, #131d33)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          zIndex: 101,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>

        {/* Title */}
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 12, paddingRight: 24 }}>
          {event.summary}
        </div>

        {/* Time */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>Start:</span> {formatDateTime(event.start)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>End:</span> {formatDateTime(event.end)}
        </div>

        {/* Description */}
        {event.description && (
          <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 16, lineHeight: 1.5 }}>
            {event.description}
          </div>
        )}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Attendees
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {event.attendees.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: a.responseStatus === 'accepted' ? '#6bffa0' : '#ffb86b',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>{a.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
