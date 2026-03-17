import React from 'react';
import { useAgents } from '../../hooks/use-agents';
import { AgentStatusGrid } from './AgentStatusGrid';
import { BriefCard, AgentBrief } from './BriefCard';
import { TodaySummary } from './TodaySummary';

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

export function HomeView({ userName = 'there', agentBriefs = [] }: HomeViewProps) {
  const { agents } = useAgents();
  const isLoading = agents.length === 0;

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
      <TodaySummary items={[]} />

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
        <AgentStatusGrid />

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
