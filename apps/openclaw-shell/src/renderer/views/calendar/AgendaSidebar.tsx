import React from 'react';
import type { CalendarEvent } from '../../../shared/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getAgentBadge(summary: string): string | null {
  const lower = summary.toLowerCase();
  if (lower.includes('standup') || lower.includes('sync')) return 'Cal';
  if (lower.includes('design')) return 'Des';
  if (lower.includes('sprint') || lower.includes('planning')) return 'PM';
  if (lower.includes('1:1') || lower.includes('lunch')) return 'Comms';
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgendaSidebarProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

// ─── AgendaSidebar ────────────────────────────────────────────────────────────

export function AgendaSidebar({ events, onEventClick }: AgendaSidebarProps) {
  const now = new Date();
  const upcoming = [...events]
    .filter((ev) => new Date(ev.end) >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 8);

  return (
    <div
      style={{
        width: 240,
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg-secondary, var(--bg))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 16px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Upcoming
        </div>
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {upcoming.length === 0 && (
          <div style={{ padding: '24px 16px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            No upcoming events
          </div>
        )}
        {upcoming.map((ev) => {
          const badge = getAgentBadge(ev.summary);
          const isPast = new Date(ev.end) < now;
          const isNow = new Date(ev.start) <= now && new Date(ev.end) >= now;

          return (
            <div
              key={ev.id}
              onClick={() => onEventClick(ev)}
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                opacity: isPast ? 0.5 : 1,
                borderLeft: isNow ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.04))')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ev.summary}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatDate(ev.start)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {formatTime(ev.start)} – {formatTime(ev.end)}
                  </div>
                </div>
                {badge && (
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      background: 'var(--border)',
                      borderRadius: 4,
                      padding: '1px 5px',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {badge}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
