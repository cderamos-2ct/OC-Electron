import React, { useEffect, useState } from 'react';
import { useAgents } from '../../hooks/use-agents';
import { invoke } from '../../lib/ipc-client';
import { AgentStatusGrid, AgentStat } from './AgentStatusGrid';
import { BriefCard, AgentBrief } from './BriefCard';
import { TodaySummary, TodayItem } from './TodaySummary';
import type { GmailMessage, CalendarEvent, GitHubNotification, TaskDocument } from '../../../shared/types';

// ---- Greeting helpers -------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---- Skeleton pulse ---------------------------------------------------------

function SkeletonLine({ width = '100%', height = '14px' }: { width?: string; height?: string }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '4px',
        backgroundColor: 'var(--border)',
        opacity: 0.6,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ---- HomeView ---------------------------------------------------------------

interface HomeViewProps {
  userName?: string;
  agentBriefs?: AgentBrief[];
}

interface LiveCounts {
  unreadEmails: number | null;
  calendarEvents: number | null;
  githubNotifications: number | null;
  pendingTasks: number | null;
}

export function HomeView({ userName = 'there', agentBriefs = [] }: HomeViewProps) {
  const { agents } = useAgents();
  const isLoading = agents.length === 0;

  const [counts, setCounts] = useState<LiveCounts>({
    unreadEmails: null,
    calendarEvents: null,
    githubNotifications: null,
    pendingTasks: null,
  });

  useEffect(() => {
    const today = new Date();
    const timeMin = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const timeMax = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const fetchCounts = async () => {
      const [emailResult, calendarResult, githubResult, taskResult] = await Promise.allSettled([
        invoke('api.gmail.list', 'comms', 'in:inbox is:unread', 100),
        invoke('api.calendar.list', 'calendar', timeMin, timeMax),
        invoke('api.github.notifications', 'build', false),
        invoke('task:list'),
      ]);

      setCounts({
        unreadEmails:
          emailResult.status === 'fulfilled'
            ? (emailResult.value as GmailMessage[]).length
            : null,
        calendarEvents:
          calendarResult.status === 'fulfilled'
            ? (calendarResult.value as CalendarEvent[]).length
            : null,
        githubNotifications:
          githubResult.status === 'fulfilled'
            ? (githubResult.value as GitHubNotification[]).length
            : null,
        pendingTasks:
          taskResult.status === 'fulfilled'
            ? (taskResult.value as TaskDocument[]).length
            : null,
      });
    };

    fetchCounts();
  }, []);

  const summaryItems: TodayItem[] = [
    ...(counts.unreadEmails != null && counts.unreadEmails > 0
      ? [{ text: `${counts.unreadEmails} unread email${counts.unreadEmails === 1 ? '' : 's'} waiting for triage` }]
      : []),
    ...(counts.calendarEvents != null && counts.calendarEvents > 0
      ? [{ text: `${counts.calendarEvents} meeting${counts.calendarEvents === 1 ? '' : 's'} today` }]
      : []),
    ...(counts.githubNotifications != null && counts.githubNotifications > 0
      ? [{ text: `${counts.githubNotifications} GitHub notification${counts.githubNotifications === 1 ? '' : 's'}` }]
      : []),
    ...(counts.pendingTasks != null && counts.pendingTasks > 0
      ? [{ text: `${counts.pendingTasks} task${counts.pendingTasks === 1 ? '' : 's'} pending review` }]
      : []),
  ];

  const agentStats: AgentStat[] = [
    {
      emoji: '\u{1F6E1}\uFE0F',
      count: counts.unreadEmails != null ? counts.unreadEmails : '—',
      label: 'Emails triaged',
      agent: 'Karoline',
    },
    {
      emoji: '\u{1F525}',
      count: counts.githubNotifications != null && counts.githubNotifications > 0
        ? counts.githubNotifications
        : '—',
      label: 'PRs merged',
      agent: 'Vulcan',
    },
    {
      emoji: '\u23F3',
      count: counts.calendarEvents != null ? counts.calendarEvents : '—',
      label: 'Invites handled',
      agent: 'Kronos',
    },
    { emoji: '\u{1F52E}', count: '—', label: 'Recaps processed', agent: 'Ada' },
    { emoji: '\u{1F4E1}', count: '—', label: 'Risks flagged', agent: 'Hermes' },
  ];

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '40px 56px',
        minWidth: 0,
        backgroundColor: 'var(--bg)',
      }}
    >
      {/* Greeting */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 300,
            fontFamily: 'sans-serif',
            color: 'var(--text)',
            margin: '0 0 6px 0',
            letterSpacing: '-0.5px',
          }}
        >
          {getGreeting()}, {userName}.
        </h1>
        <p
          style={{
            fontSize: '15px',
            color: 'var(--muted)',
            margin: 0,
          }}
        >
          {formatDate()}
        </p>
      </div>

      {/* Today summary bullets */}
      <TodaySummary items={summaryItems} />

      {/* Overnight Agent Activity */}
      <div style={{ marginBottom: '32px' }}>
        <p
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            margin: '0 0 14px 0',
          }}
        >
          Overnight Agent Activity
        </p>

        {/* Stat cards grid */}
        <AgentStatusGrid stats={agentStats} />

        {/* Agent briefs */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '16px 18px',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--border)',
                    flexShrink: 0,
                    opacity: 0.6,
                  }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <SkeletonLine width="40%" height="13px" />
                  <SkeletonLine width="90%" height="12px" />
                  <SkeletonLine width="75%" height="12px" />
                </div>
              </div>
            ))}
          </div>
        ) : agentBriefs.length === 0 ? (
          <p
            style={{
              fontSize: '14px',
              color: 'var(--muted)',
              margin: 0,
              padding: '16px 0',
            }}
          >
            No agent activity yet.
          </p>
        ) : (
          agentBriefs.map((brief) => (
            <BriefCard key={brief.id} brief={brief} />
          ))
        )}
      </div>
    </div>
  );
}
