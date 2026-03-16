import React from 'react';
import type { CalendarEvent } from '../../../shared/types.js';

// ─── Event color map ──────────────────────────────────────────────────────────

function getEventColor(summary: string): { border: string; bg: string; text: string } {
  const lower = summary.toLowerCase();
  if (lower.includes('standup') || lower.includes('sync')) {
    return { border: '#1f5e3d', bg: 'rgba(31,94,61,0.18)', text: '#6bffa0' };
  }
  if (lower.includes('focus')) {
    return { border: '#3d1f5e', bg: 'rgba(61,31,94,0.18)', text: '#c99bff' };
  }
  if (lower.includes('lunch') || lower.includes('social') || lower.includes('coffee')) {
    return { border: '#5e3d1f', bg: 'rgba(94,61,31,0.18)', text: '#ffb86b' };
  }
  // Default: meetings (blue)
  return { border: '#1f3d5e', bg: 'rgba(31,61,94,0.18)', text: '#6bb8ff' };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m === 0 ? `${hour}${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventBlockProps {
  event: CalendarEvent;
  onClick: () => void;
  isSelected?: boolean;
}

// ─── EventBlock ───────────────────────────────────────────────────────────────

export function EventBlock({ event, onClick, isSelected }: EventBlockProps) {
  const color = getEventColor(event.summary);
  const attendeeCount = event.attendees?.length ?? 0;

  return (
    <div
      onClick={onClick}
      style={{
        height: '100%',
        background: color.bg,
        borderLeft: `3px solid ${color.border}`,
        borderRadius: 6,
        padding: '3px 6px',
        cursor: 'pointer',
        overflow: 'hidden',
        outline: isSelected ? `1.5px solid ${color.border}` : undefined,
        transition: 'opacity 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: color.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: '14px',
        }}
      >
        {event.summary}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          marginTop: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {formatTime(event.start)} – {formatTime(event.end)}
        {attendeeCount > 0 && ` · ${attendeeCount} attendee${attendeeCount > 1 ? 's' : ''}`}
      </div>
    </div>
  );
}
