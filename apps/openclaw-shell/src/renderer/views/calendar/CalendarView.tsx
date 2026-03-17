import React, { useState, useEffect } from 'react';
import { invoke } from '../../lib/ipc-client';
import type { CalendarEvent } from '../../../shared/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type EventType = 'meeting' | 'focus' | 'personal' | 'travel';

interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  day: number; // 0–6 index into the current week
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  agent?: string;
  conflict?: boolean;
  conflictRight?: boolean;
  zoomLink?: string;
  attendees?: { name: string; initials: string; color: string }[];
  location?: string;
  description?: string;
}

// ─── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:       '#0f172a',
  bgMid:    '#131d33',
  bgCard:   '#131d33',
  border:   'rgba(241,245,249,0.14)',
  border2:  'rgba(241,245,249,0.08)',
  text:     '#f1f5f9',
  text2:    '#cbd5e1',
  muted:    '#94a3b8',
  accent:   '#a3862a',
  accentBg: 'rgba(163,134,42,0.2)',
  green:    '#2ecc71',
  yellow:   '#e0c875',
  red:      '#e74c3c',
};

// ─── Event colour maps ──────────────────────────────────────────────────────────

function evColors(type: EventType) {
  switch (type) {
    case 'meeting': return { bg: 'rgba(163,134,42,0.18)',  border: '#a3862a', label: '#e0c875' };
    case 'focus':   return { bg: 'rgba(31,94,61,0.38)',    border: '#2ecc71', label: '#2ecc71' };
    case 'personal':return { bg: 'rgba(31,45,94,0.48)',    border: '#4a80d4', label: '#7eb3f5' };
    case 'travel':  return { bg: 'rgba(61,31,94,0.48)',    border: '#9b59b6', label: '#c39bd3' };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function guessEventType(title: string): EventType {
  const t = title.toLowerCase();
  if (t.includes('focus') || t.includes('deep work') || t.includes('heads down')) return 'focus';
  if (t.includes('travel') || t.includes('flight') || t.includes('drive')) return 'travel';
  if (t.includes('dentist') || t.includes('doctor') || t.includes('gym') || t.includes('personal') || t.includes('family')) return 'personal';
  return 'meeting';
}

function parseISO(iso: string): Date {
  return new Date(iso);
}

function weekStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  const day = s.getDay(); // 0=Sun
  s.setDate(s.getDate() - day);
  return s;
}

function isoWeekBounds(refDate: Date): { timeMin: string; timeMax: string; weekDates: Date[] } {
  const ws = weekStart(refDate);
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(ws.getDate() + i);
    weekDates.push(d);
  }
  const timeMin = ws.toISOString();
  const end = new Date(ws);
  end.setDate(ws.getDate() + 7);
  const timeMax = end.toISOString();
  return { timeMin, timeMax, weekDates };
}

function toCalEvent(raw: CalendarEvent, weekDates: Date[]): CalEvent | null {
  const start = parseISO(raw.start);
  const end   = parseISO(raw.end);

  // Find which day of the week this falls on
  const dayIdx = weekDates.findIndex(d =>
    d.getFullYear() === start.getFullYear() &&
    d.getMonth()    === start.getMonth() &&
    d.getDate()     === start.getDate()
  );
  if (dayIdx === -1) return null;

  const ev: CalEvent = {
    id:        raw.id,
    title:     raw.summary,
    type:      guessEventType(raw.summary),
    day:       dayIdx,
    startHour: start.getHours(),
    startMin:  start.getMinutes(),
    endHour:   end.getHours(),
    endMin:    end.getMinutes(),
    description: raw.description,
    location:    raw.location,
  };

  // Extract zoom link from description/location
  const zoomRe = /https:\/\/[^\s"]+zoom\.us\/j\/[^\s"<]*/i;
  const zoomSrc = [raw.description ?? '', raw.location ?? ''].join(' ');
  const zm = zoomSrc.match(zoomRe);
  if (zm) ev.zoomLink = zm[0];

  // Build attendee list from raw attendees
  if (raw.attendees && raw.attendees.length > 0) {
    const COLORS = ['#a3862a', '#4a80d4', '#2ecc71', '#e74c3c', '#9b59b6', '#e0c875'];
    ev.attendees = raw.attendees.slice(0, 6).map((a: { email: string }, i: number) => {
      const parts = a.email.split('@')[0].split(/[._-]/);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : a.email.slice(0, 2).toUpperCase();
      return { name: a.email, initials, color: COLORS[i % COLORS.length] };
    });
  }

  return ev;
}

function buildAgendaSections(events: CalEvent[], weekDates: Date[], today: Date) {
  const todayIdx  = weekDates.findIndex(d => d.toDateString() === today.toDateString());
  const tomorrowIdx = todayIdx + 1;

  const sections: { label: string; items: CalEvent[] }[] = [];

  for (let i = 0; i < 7; i++) {
    const dayEvs = events.filter(e => e.day === i).sort((a, b) =>
      (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin)
    );
    if (dayEvs.length === 0) continue;

    const d = weekDates[i];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const prefix = i === todayIdx ? 'Today — ' : i === tomorrowIdx ? 'Tomorrow — ' : '';
    sections.push({ label: prefix + dayName, items: dayEvs });
  }
  return sections;
}

const HOURS      = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const PX_PER_HR  = 60;
const GRID_START = 8;

function hrLabel(h: number) {
  if (h === 12) return '12 pm';
  return h > 12 ? `${h - 12} pm` : `${h} am`;
}
function fmtTime(h: number, m: number) {
  const ampm = h >= 12 ? 'pm' : 'am';
  const hr   = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const mn   = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
  return `${hr}${mn} ${ampm}`;
}
function evTop(sh: number, sm: number) {
  return (sh - GRID_START) * PX_PER_HR + (sm / 60) * PX_PER_HR;
}
function evHeight(sh: number, sm: number, eh: number, em: number) {
  return Math.max(((eh * 60 + em - sh * 60 - sm) / 60) * PX_PER_HR, 20);
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ top, height, left, right }: { top: number; height: number; left: string; right: string }) {
  return (
    <div style={{
      position: 'absolute',
      top, left, right, height,
      background: 'rgba(241,245,249,0.05)',
      borderLeft: '3px solid rgba(241,245,249,0.1)',
      borderRadius: '0 4px 4px 0',
      animation: 'calSkeletonPulse 1.6s ease-in-out infinite',
    }} />
  );
}

// ─── CalendarView ───────────────────────────────────────────────────────────────

const AGENT_ID = 'primary';

export function CalendarView() {
  const today = new Date();
  const [refDate, setRefDate]   = useState<Date>(today);
  const [events, setEvents]     = useState<CalEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selected, setSelected] = useState<CalEvent | null>(null);

  const { timeMin, timeMax, weekDates } = isoWeekBounds(refDate);

  const monthLabel = weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Day header labels derived from real week dates
  const DAY_LABELS = weekDates.map(d => ({
    short: d.toLocaleDateString('en-US', { weekday: 'short' }),
    num:   String(d.getDate()),
  }));

  const todayIdx = weekDates.findIndex(d => d.toDateString() === today.toDateString());

  // Load events when week changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(null);

    invoke('api.calendar.list', AGENT_ID, timeMin, timeMax)
      .then((raw) => {
        if (cancelled) return;
        const list = Array.isArray(raw) ? (raw as CalendarEvent[]) : [];
        const parsed = list
          .map(e => toCalEvent(e, weekDates))
          .filter((e): e is CalEvent => e !== null);
        setEvents(parsed);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(String(err));
        setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeMin]);

  const agendaSections = buildAgendaSections(events, weekDates, today);
  const pick = (ev: CalEvent) => setSelected(p => (p?.id === ev.id ? null : ev));

  const totalH = HOURS.length * PX_PER_HR;

  const btnReset: React.CSSProperties = {
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
  };

  const prevWeek = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 7);
    setRefDate(d);
  };
  const nextWeek = () => {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 7);
    setRefDate(d);
  };

  return (
    <>
      <style>{`
        @keyframes calSkeletonPulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, color: C.text, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, overflow: 'hidden' }}>

        {/* ══ TOP NAV BAR ══════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, minHeight: 48, padding: '0 16px', borderBottom: `1px solid ${C.border}`, background: C.bgMid, flexShrink: 0 }}>

          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={prevWeek} style={{ ...btnReset, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text2, fontSize: 15 }}>‹</button>
            <button onClick={nextWeek} style={{ ...btnReset, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text2, fontSize: 15 }}>›</button>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text, marginLeft: 4 }}>{monthLabel}</span>
            <button onClick={() => setRefDate(new Date())} style={{ ...btnReset, marginLeft: 6, padding: '3px 10px', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text2, fontSize: 12 }}>Today</button>
          </div>

          {/* Right: view toggle (display only) */}
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', background: C.bg }}>
            {(['Day','Week','Month'] as const).map((v, i) => (
              <button
                key={v}
                style={{
                  ...btnReset,
                  padding: '5px 14px',
                  fontSize: 12,
                  fontWeight: v === 'Week' ? 600 : 400,
                  color: v === 'Week' ? C.yellow : C.muted,
                  background: v === 'Week' ? C.accentBg : 'transparent',
                  borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* ══ BODY ════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── AGENDA SIDEBAR ─────────────────────────────────────────────────── */}
          <div style={{ width: 220, minWidth: 220, borderRight: `1px solid ${C.border}`, background: C.bgMid, overflowY: 'auto', flexShrink: 0 }}>
            {loading && (
              <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[80, 60, 70, 55, 65].map((w, i) => (
                  <div key={i} style={{ height: 12, borderRadius: 4, background: 'rgba(241,245,249,0.07)', width: `${w}%`, animation: 'calSkeletonPulse 1.6s ease-in-out infinite' }} />
                ))}
              </div>
            )}
            {!loading && agendaSections.length === 0 && !error && (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: C.muted, fontSize: 12 }}>
                No events this week
              </div>
            )}
            {!loading && error && (
              <div style={{ padding: '12px', fontSize: 11, color: C.red }}>
                Failed to load
              </div>
            )}
            {!loading && agendaSections.map((section, si) => (
              <div key={si}>
                <div style={{ padding: '10px 12px 6px', fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid ${C.border2}` }}>
                  {section.label}
                </div>
                {section.items.map(item => {
                  const col = evColors(item.type);
                  const isActive = selected?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => pick(item)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 12px', cursor: 'pointer', borderBottom: `1px solid ${C.border2}`, background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent' }}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.border, marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: C.muted, marginBottom: 1 }}>{fmtTime(item.startHour, item.startMin)}</div>
                        <div style={{ fontSize: 12, color: C.text2, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* ── WEEK GRID ──────────────────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Day header row */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.bgMid, flexShrink: 0 }}>
              <div style={{ width: 52, minWidth: 52, flexShrink: 0 }} />
              {DAY_LABELS.map((d, di) => {
                const isToday = di === todayIdx;
                return (
                  <div key={di} style={{ flex: 1, textAlign: 'center', padding: '7px 4px', borderLeft: `1px solid ${C.border2}` }}>
                    <div style={{ fontSize: 10, color: isToday ? C.yellow : C.muted, fontWeight: isToday ? 700 : 400, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.short}</div>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: isToday ? C.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0', fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? '#fff' : C.text2 }}>{d.num}</div>
                  </div>
                );
              })}
            </div>

            {/* Scrollable time + events */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', height: totalH, position: 'relative' }}>

                {/* Time gutter */}
                <div style={{ width: 52, minWidth: 52, flexShrink: 0, position: 'relative' }}>
                  {HOURS.map(h => (
                    <div key={h} style={{ position: 'absolute', top: (h - GRID_START) * PX_PER_HR - 7, right: 8, fontSize: 10, color: C.muted, whiteSpace: 'nowrap' }}>
                      {hrLabel(h)}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {DAY_LABELS.map((_, di) => {
                  const dayEvs = events.filter(e => e.day === di);
                  return (
                    <div key={di} style={{ flex: 1, borderLeft: `1px solid ${C.border2}`, position: 'relative', minWidth: 0 }}>
                      {/* Hour lines */}
                      {HOURS.map(h => (
                        <div key={h} style={{ position: 'absolute', top: (h - GRID_START) * PX_PER_HR, left: 0, right: 0, height: 1, background: C.border2 }} />
                      ))}

                      {/* Loading skeletons */}
                      {loading && di < 5 && (
                        <>
                          <SkeletonBlock top={30 + di * 20} height={40} left="2px" right="1px" />
                          <SkeletonBlock top={140 + di * 15} height={60} left="2px" right="1px" />
                        </>
                      )}

                      {/* Events */}
                      {!loading && dayEvs.map(ev => {
                        const col   = evColors(ev.type);
                        const top   = evTop(ev.startHour, ev.startMin);
                        const ht    = evHeight(ev.startHour, ev.startMin, ev.endHour, ev.endMin);
                        const isSel = selected?.id === ev.id;

                        const leftPct  = ev.conflict && ev.conflictRight  ? '50%' : '2px';
                        const rightPct = ev.conflict && !ev.conflictRight ? '50%' : '1px';

                        return (
                          <div
                            key={ev.id}
                            onClick={() => pick(ev)}
                            style={{
                              position: 'absolute',
                              top,
                              left: leftPct,
                              right: rightPct,
                              height: ht,
                              background: col.bg,
                              borderLeft: `3px solid ${col.border}`,
                              borderRadius: '0 4px 4px 0',
                              padding: '3px 5px',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              boxSizing: 'border-box',
                              outline: isSel ? `1px solid ${col.border}` : 'none',
                              filter: isSel ? 'brightness(1.25)' : 'none',
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 600, color: col.label, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ev.title}
                            </div>
                            {ht >= 30 && (
                              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                                {fmtTime(ev.startHour, ev.startMin)}–{fmtTime(ev.endHour, ev.endMin)}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Empty state per day — only show when loaded and no events */}
                      {!loading && dayEvs.length === 0 && events.length === 0 && di === 0 && (
                        <div style={{ position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: C.border, pointerEvents: 'none' }}>
                          No events
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── DETAIL PANEL ───────────────────────────────────────────────────── */}
          {selected && (
            <div style={{ width: 300, minWidth: 300, borderLeft: `1px solid ${C.border}`, background: C.bgCard, display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>

              {/* Header row: badge + close */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  background: evColors(selected.type).bg,
                  color: evColors(selected.type).label,
                  border: `1px solid ${evColors(selected.type).border}`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {selected.type}
                </span>
                <button onClick={() => setSelected(null)} style={{ ...btnReset, color: C.muted, fontSize: 20, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>

              {/* Title + meta */}
              <div style={{ padding: '14px 14px 0' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 10 }}>{selected.title}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.muted, marginBottom: 5 }}>
                  <span>📅</span>
                  <span>{weekDates[selected.day]?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) ?? ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.muted, marginBottom: selected.zoomLink ? 5 : 14 }}>
                  <span>🕐</span><span>{fmtTime(selected.startHour, selected.startMin)} – {fmtTime(selected.endHour, selected.endMin)}</span>
                </div>
                {selected.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: C.muted, marginBottom: 5 }}>
                    <span>📍</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.location}</span>
                  </div>
                )}
                {selected.zoomLink && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, marginBottom: 14 }}>
                    <span>🔗</span>
                    <a href={selected.zoomLink} style={{ color: '#4a80d4', textDecoration: 'none' }}>Zoom link</a>
                  </div>
                )}
                {selected.description && (
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {selected.description.slice(0, 280)}{selected.description.length > 280 ? '…' : ''}
                  </div>
                )}
              </div>

              {/* Attendees */}
              {selected.attendees && selected.attendees.length > 0 && (
                <div style={{ padding: '0 14px 14px', borderBottom: `1px solid ${C.border2}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Attendees</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.attendees.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{a.initials}</div>
                        <span style={{ fontSize: 12, color: C.text2 }}>{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selected.zoomLink && (
                  <button
                    onClick={() => window.open(selected.zoomLink, '_blank')}
                    style={{ ...btnReset, padding: '7px 0', width: '100%', background: C.accentBg, border: `1px solid ${C.accent}`, borderRadius: 6, color: C.yellow, fontSize: 12, fontWeight: 600 }}
                  >
                    Join Zoom
                  </button>
                )}
                <button style={{ ...btnReset, padding: '7px 0', width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text2, fontSize: 12 }}>
                  Reschedule
                </button>
                <button style={{ ...btnReset, padding: '7px 0', width: '100%', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 6, color: C.text2, fontSize: 12 }}>
                  Add Notes
                </button>
              </div>
            </div>
          )}

          {/* Empty state overlay when no events and not loading */}
          {!loading && events.length === 0 && !error && !selected && (
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text2, marginBottom: 6 }}>No events this week</div>
              <div style={{ fontSize: 12, color: C.muted }}>Connect Google Calendar to see your schedule</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
