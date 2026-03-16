import React from 'react';
import { EventBlock } from './EventBlock';
import { TimeIndicator } from './TimeIndicator';
import type { CalendarEvent } from '../../../shared/types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_START = 7;
const HOUR_END = 19;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 64; // px per hour
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDates(): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getEventTopPct(start: Date): number {
  const hours = start.getHours() + start.getMinutes() / 60;
  return ((hours - HOUR_START) / TOTAL_HOURS) * 100;
}

function getEventHeightPct(start: Date, end: Date): number {
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return (durationHours / TOTAL_HOURS) * 100;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WeekGridProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  selectedEventId?: string;
}

// ─── WeekGrid ─────────────────────────────────────────────────────────────────

export function WeekGrid({ events, onEventClick, selectedEventId }: WeekGridProps) {
  const weekDates = getWeekDates();
  const today = new Date();

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '52px repeat(7, 1fr)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        {/* Corner spacer */}
        <div style={{ borderRight: '1px solid var(--border)' }} />

        {/* Day headers */}
        {weekDates.map((date, i) => {
          const isToday = isSameDay(date, today);
          return (
            <div
              key={i}
              style={{
                padding: '10px 8px',
                textAlign: 'center',
                borderRight: i < 6 ? '1px solid var(--border)' : undefined,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 4,
                }}
              >
                {DAY_NAMES[i]}
              </div>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto',
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text)',
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                }}
              >
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid body */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '52px repeat(7, 1fr)',
            height: TOTAL_HEIGHT,
            position: 'relative',
          }}
        >
          {/* Time gutter */}
          <div
            style={{
              borderRight: '1px solid var(--border)',
              position: 'relative',
            }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                style={{
                  position: 'absolute',
                  top: (hour - HOUR_START) * HOUR_HEIGHT - 8,
                  left: 0,
                  right: 0,
                  textAlign: 'right',
                  paddingRight: 8,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  userSelect: 'none',
                }}
              >
                {hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIndex) => {
            const dayEvents = events.filter((ev) => isSameDay(new Date(ev.start), date));

            return (
              <div
                key={dayIndex}
                style={{
                  borderRight: dayIndex < 6 ? '1px solid var(--border)' : undefined,
                  position: 'relative',
                }}
              >
                {/* Hour lines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    style={{
                      position: 'absolute',
                      top: (hour - HOUR_START) * HOUR_HEIGHT,
                      left: 0,
                      right: 0,
                      borderTop: '1px solid var(--border)',
                      opacity: 0.5,
                    }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const start = new Date(ev.start);
                  const end = new Date(ev.end);
                  const topPct = getEventTopPct(start);
                  const heightPct = getEventHeightPct(start, end);

                  return (
                    <div
                      key={ev.id}
                      style={{
                        position: 'absolute',
                        top: `${topPct}%`,
                        left: 3,
                        right: 3,
                        height: `${Math.max(heightPct, 2)}%`,
                        zIndex: 1,
                      }}
                    >
                      <EventBlock
                        event={ev}
                        onClick={() => onEventClick(ev)}
                        isSelected={ev.id === selectedEventId}
                      />
                    </div>
                  );
                })}

                {/* Time indicator — only on today's column */}
                {isSameDay(date, today) && (
                  <TimeIndicator hourStart={HOUR_START} totalHours={TOTAL_HOURS} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
