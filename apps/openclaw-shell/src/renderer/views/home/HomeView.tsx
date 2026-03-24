import React, { useEffect, useMemo, useState } from 'react';
import { useAgents } from '../../hooks/use-agents';
import { useGateway } from '../../hooks/use-gateway';
import { invoke } from '../../lib/ipc-client';
import { AgentStatusGrid, AgentStat } from './AgentStatusGrid';
import { BriefCard, AgentBrief } from './BriefCard';
import { TodaySummary, TodayItem } from './TodaySummary';

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

type MetricLoadState = 'loading' | 'ready' | 'error' | 'disconnected';

interface DashboardMetric {
  status: MetricLoadState;
  count?: number;
  message?: string;
}

interface DashboardMetrics {
  unreadEmails: DashboardMetric;
  calendarEvents: DashboardMetric;
  githubNotifications: DashboardMetric;
  pendingTasks: DashboardMetric;
}

const DISCONNECTED_MESSAGE = 'Gateway disconnected';
const LOADING_MESSAGE = 'Loading...';

function makeLoadingMetrics(): DashboardMetrics {
  return {
    unreadEmails: { status: 'loading', message: LOADING_MESSAGE },
    calendarEvents: { status: 'loading', message: LOADING_MESSAGE },
    githubNotifications: { status: 'loading', message: LOADING_MESSAGE },
    pendingTasks: { status: 'loading', message: LOADING_MESSAGE },
  };
}

function makeDisconnectedMetrics(): DashboardMetrics {
  return {
    unreadEmails: { status: 'disconnected', message: DISCONNECTED_MESSAGE },
    calendarEvents: { status: 'disconnected', message: DISCONNECTED_MESSAGE },
    githubNotifications: { status: 'disconnected', message: DISCONNECTED_MESSAGE },
    pendingTasks: { status: 'disconnected', message: DISCONNECTED_MESSAGE },
  };
}

function normalizeMetricPayload(
  payload: unknown,
  fallbackMessage: string,
): DashboardMetric {
  if (Array.isArray(payload)) {
    return { status: 'ready', count: payload.length };
  }

  if (payload && typeof payload === 'object' && 'error' in payload) {
    const err = payload as { error?: unknown };
    if (typeof err.error === 'string' && err.error.length > 0) {
      return { status: 'error', message: err.error };
    }
  }

  return { status: 'error', message: fallbackMessage };
}

function metricDisplayValue(metric: DashboardMetric): string | number {
  if (metric.status === 'ready') {
    return metric.count ?? 0;
  }

  return metric.message ?? 'Unavailable';
}

function normalizeErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return 'Backend request failed';
}

export function HomeView({ userName = 'there', agentBriefs = [] }: HomeViewProps) {
  const { agents } = useAgents();
  const { isConnected } = useGateway();
  const isAgentLoading = agents.length === 0;

  const [counts, setCounts] = useState<DashboardMetrics>(makeLoadingMetrics());

  useEffect(() => {
    const today = new Date();
    const timeMin = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const timeMax = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    if (!isConnected) {
      setCounts(makeDisconnectedMetrics());
      return;
    }

    let cancelled = false;

    const fetchCounts = async () => {
      setCounts(makeLoadingMetrics());

      const [unreadEmails, calendarEvents, githubNotifications, pendingTasks] = await Promise.all([
        invoke('api.gmail.list', 'comms', 'in:inbox is:unread', 100)
          .then((result) => normalizeMetricPayload(result, 'Failed to load unread emails'))
          .catch((error) => ({ status: 'error', message: normalizeErrorMessage(error) }) as DashboardMetric),
        invoke('api.calendar.list', 'calendar', timeMin, timeMax)
          .then((result) => normalizeMetricPayload(result, "Failed to load today's events"))
          .catch((error) => ({ status: 'error', message: normalizeErrorMessage(error) }) as DashboardMetric),
        invoke('api.github.notifications', 'build', false)
          .then((result) => normalizeMetricPayload(result, 'Failed to load GitHub notifications'))
          .catch((error) => ({ status: 'error', message: normalizeErrorMessage(error) }) as DashboardMetric),
        invoke('task:list')
          .then((result) => normalizeMetricPayload(result, 'Failed to load pending tasks'))
          .catch((error) => ({ status: 'error', message: normalizeErrorMessage(error) }) as DashboardMetric),
      ]);

      if (cancelled) {
        return;
      }

      setCounts({
        unreadEmails,
        calendarEvents,
        githubNotifications,
        pendingTasks,
      });
    };

    void fetchCounts();

    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  const hasLoading = Object.values(counts).some((metric) => metric.status === 'loading');
  const hasExplicitUnavailable = Object.values(counts).some(
    (metric) => metric.status === 'error' || metric.status === 'disconnected',
  );

  const summaryItems: TodayItem[] = useMemo(() => {
    const lines: TodayItem[] = [];

    if (counts.unreadEmails.status === 'ready') {
      const count = counts.unreadEmails.count ?? 0;
      if (count > 0) {
        lines.push({ text: `${count} unread email${count === 1 ? '' : 's'} waiting for triage` });
      }
    }

    if (counts.calendarEvents.status === 'ready') {
      const count = counts.calendarEvents.count ?? 0;
      if (count > 0) {
        lines.push({ text: `${count} meeting${count === 1 ? '' : 's'} today` });
      }
    }

    if (counts.githubNotifications.status === 'ready') {
      const count = counts.githubNotifications.count ?? 0;
      if (count > 0) {
        lines.push({ text: `${count} GitHub notification${count === 1 ? '' : 's'}` });
      }
    }

    if (counts.pendingTasks.status === 'ready') {
      const count = counts.pendingTasks.count ?? 0;
      if (count > 0) {
        lines.push({ text: `${count} task${count === 1 ? '' : 's'} pending review` });
      }
    }

    return lines;
  }, [counts]);

  const agentStats: AgentStat[] = useMemo(
    () => [
      {
        emoji: '\u{1F4E7}',
        count: metricDisplayValue(counts.unreadEmails),
        label: 'Unread emails',
        agent: 'Comms',
      },
      {
        emoji: '\u{1F4C5}',
        count: metricDisplayValue(counts.calendarEvents),
        label: 'Calendar events today',
        agent: 'Calendar',
      },
      {
        emoji: '\u{1F5A5}',
        count: metricDisplayValue(counts.githubNotifications),
        label: 'GitHub notifications',
        agent: 'Build',
      },
      {
        emoji: '\u{1F4CB}',
        count: metricDisplayValue(counts.pendingTasks),
        label: 'Pending tasks',
        agent: 'Tasks',
      },
    ],
    [counts],
  );

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

      {/* Dashboard metrics */}
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
          Home metrics
        </p>

        {hasLoading ? (
          <p
            style={{
              fontSize: '14px',
              color: 'var(--muted)',
              margin: '0 0 14px 0',
            }}
          >
            Loading live metrics...
          </p>
        ) : null}

        {hasExplicitUnavailable ? (
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-2)',
              margin: '0 0 14px 0',
            }}
          >
            Some dashboard metrics are unavailable.
          </p>
        ) : null}

        {/* Stat cards grid */}
        <AgentStatusGrid stats={agentStats} />

        {/* Agent briefs */}
        {isAgentLoading ? (
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
          agentBriefs.map((brief) => <BriefCard key={brief.id} brief={brief} />)
        )}
      </div>
    </div>
  );
}
