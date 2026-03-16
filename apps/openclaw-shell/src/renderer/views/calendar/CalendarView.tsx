import React, { useState } from 'react';
import { WeekGrid } from './WeekGrid';
import { AgendaSidebar } from './AgendaSidebar';
import { EventDetailPanel } from './EventDetailPanel';
import type { CalendarEvent } from '../../../shared/types.js';

// ─── Mock Data ─────────────────────────────────────────────────────────────────

function getThisWeekEvents(): CalendarEvent[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  monday.setHours(0, 0, 0, 0);

  const d = (dayOffset: number, hour: number, minute = 0) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + dayOffset);
    dt.setHours(hour, minute, 0, 0);
    return dt.toISOString();
  };

  return [
    {
      id: 'ev-1',
      summary: 'Team Standup',
      description: 'Daily standup with the engineering team',
      start: d(0, 9, 30),
      end: d(0, 10, 0),
      status: 'confirmed',
      htmlLink: '#',
      attendees: [
        { email: 'christian@aegilume.ai', responseStatus: 'accepted' },
        { email: 'lynn@alphagraphics.com', responseStatus: 'accepted' },
      ],
    },
    {
      id: 'ev-2',
      summary: 'Design Review',
      description: 'Review new shell UI designs with the product team',
      start: d(0, 14, 0),
      end: d(0, 15, 0),
      status: 'confirmed',
      htmlLink: '#',
      attendees: [
        { email: 'christian@aegilume.ai', responseStatus: 'accepted' },
        { email: 'design@aegilume.ai', responseStatus: 'accepted' },
      ],
    },
    {
      id: 'ev-3',
      summary: '1:1 with Lynn',
      description: 'Weekly check-in',
      start: d(1, 10, 0),
      end: d(1, 10, 30),
      status: 'confirmed',
      htmlLink: '#',
      attendees: [
        { email: 'christian@aegilume.ai', responseStatus: 'accepted' },
        { email: 'lynn@alphagraphics.com', responseStatus: 'accepted' },
      ],
    },
    {
      id: 'ev-4',
      summary: 'Sprint Planning',
      description: 'Plan the upcoming sprint with the engineering team',
      start: d(1, 13, 0),
      end: d(1, 15, 0),
      status: 'confirmed',
      htmlLink: '#',
      attendees: [
        { email: 'christian@aegilume.ai', responseStatus: 'accepted' },
        { email: 'eng@aegilume.ai', responseStatus: 'accepted' },
      ],
    },
    {
      id: 'ev-5',
      summary: 'Focus: Shell Architecture',
      description: 'Deep work session on Electron shell architecture',
      start: d(2, 9, 0),
      end: d(2, 12, 0),
      status: 'confirmed',
      htmlLink: '#',
    },
    {
      id: 'ev-6',
      summary: 'Agent Team Sync',
      description: 'Sync with the AI agent team on model routing',
      start: d(2, 14, 0),
      end: d(2, 15, 0),
      status: 'confirmed',
      htmlLink: '#',
      attendees: [
        { email: 'christian@aegilume.ai', responseStatus: 'accepted' },
        { email: 'agents@aegilume.ai', responseStatus: 'accepted' },
      ],
    },
    {
      id: 'ev-7',
      summary: 'Team Standup',
      description: 'Daily standup with the engineering team',
      start: d(3, 9, 30),
      end: d(3, 10, 0),
      status: 'confirmed',
      htmlLink: '#',
      attendees: [
        { email: 'christian@aegilume.ai', responseStatus: 'accepted' },
      ],
    },
    {
      id: 'ev-8',
      summary: 'Lunch with Investors',
      description: 'Casual lunch with seed investors',
      start: d(3, 12, 0),
      end: d(3, 13, 30),
      status: 'confirmed',
      htmlLink: '#',
      attendees: [
        { email: 'christian@aegilume.ai', responseStatus: 'accepted' },
        { email: 'investor@fund.vc', responseStatus: 'accepted' },
      ],
    },
    {
      id: 'ev-9',
      summary: 'Focus: API Integration',
      description: 'Deep work on GitHub + Calendar API integrations',
      start: d(4, 10, 0),
      end: d(4, 13, 0),
      status: 'confirmed',
      htmlLink: '#',
    },
    {
      id: 'ev-10',
      summary: 'Demo Prep',
      description: 'Prepare demo for Friday all-hands',
      start: d(4, 15, 0),
      end: d(4, 16, 0),
      status: 'confirmed',
      htmlLink: '#',
      attendees: [
        { email: 'christian@aegilume.ai', responseStatus: 'accepted' },
        { email: 'design@aegilume.ai', responseStatus: 'accepted' },
      ],
    },
  ];
}

// ─── CalendarView ──────────────────────────────────────────────────────────────

export function CalendarView() {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const events = getThisWeekEvents();

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Main week grid */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <WeekGrid
          events={events}
          onEventClick={setSelectedEvent}
          selectedEventId={selectedEvent?.id}
        />
      </div>

      {/* Right rail: agenda sidebar */}
      <AgendaSidebar events={events} onEventClick={setSelectedEvent} />

      {/* Event detail panel (overlay) */}
      {selectedEvent && (
        <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}
