import React from 'react';
import type { TaskDocument } from '../../../shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function countByAgent(tasks: TaskDocument[]): Array<{ agent: string; count: number }> {
  const map: Record<string, number> = {};
  for (const t of tasks) {
    const agent = t.owner_agent || 'system';
    map[agent] = (map[agent] ?? 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([agent, count]) => ({ agent, count }));
}

// ─── Row components ───────────────────────────────────────────────────────────

interface BriefRowProps {
  label: string;
  value: string | number;
  accent?: string;
}

function BriefRow({ label, value, accent }: BriefRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' }}>
      <span style={{ fontSize: '11px', color: '#71717a', minWidth: '120px' }}>{label}</span>
      <span style={{ fontSize: '12px', color: accent ?? '#f4f4f5', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  );
}

interface SectionBlockProps {
  title: string;
  children: React.ReactNode;
}

function SectionBlock({ title, children }: SectionBlockProps) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <p
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#52525b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: '0 0 10px 0',
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── MorningBrief ─────────────────────────────────────────────────────────────

export interface MorningBriefProps {
  tasks: TaskDocument[];
  onDismiss: () => void;
}

export function MorningBrief({ tasks, onDismiss }: MorningBriefProps) {
  const activeTasks = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'cancelled',
  );

  const handledOvernight = tasks.filter(
    (t) => t.status === 'done' || t.status === 'cancelled',
  );

  const needsDecision = activeTasks.filter(
    (t) =>
      (t.priority === 'critical' || t.priority === 'high') &&
      t.status !== 'in_progress',
  );

  const blocked = activeTasks.filter((t) => t.status === 'blocked');

  const calendarTasks = activeTasks.filter(
    (t) => t.tags?.includes('calendar') || t.owner_agent === 'calendar',
  );

  const prTasks = activeTasks.filter(
    (t) =>
      t.tags?.includes('pr') ||
      t.tags?.includes('build') ||
      t.owner_agent === 'build',
  );

  const agentActivity = countByAgent(handledOvernight);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: '12px',
          padding: '28px 32px',
          width: '480px',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#f4f4f5',
              margin: '0 0 4px 0',
            }}
          >
            Good morning, Christian.
          </h2>
          <p style={{ fontSize: '12px', color: '#71717a', margin: 0 }}>{formatDate()}</p>
        </div>

        {/* TODAY */}
        <SectionBlock title="Today">
          <BriefRow
            label="Tasks needing a call"
            value={needsDecision.length}
            accent={needsDecision.length > 0 ? '#f59e0b' : '#10b981'}
          />
          <BriefRow
            label="Meetings"
            value={calendarTasks.length > 0 ? calendarTasks.length : '—'}
          />
          <BriefRow
            label="PRs / builds"
            value={prTasks.length > 0 ? prTasks.length : '—'}
          />
          <BriefRow
            label="In progress"
            value={activeTasks.filter((t) => t.status === 'in_progress').length}
          />
        </SectionBlock>

        {/* OVERNIGHT */}
        {handledOvernight.length > 0 && (
          <SectionBlock title="Overnight">
            <BriefRow
              label="Handled by agents"
              value={handledOvernight.length}
              accent="#10b981"
            />
            {agentActivity.slice(0, 4).map(({ agent, count }) => (
              <div
                key={agent}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: '#a1a1aa',
                    backgroundColor: '#3f3f46',
                    padding: '1px 8px',
                    borderRadius: '999px',
                  }}
                >
                  {agent}
                </span>
                <span style={{ fontSize: '11px', color: '#71717a' }}>
                  {count} task{count > 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </SectionBlock>
        )}

        {/* BLOCKERS */}
        {blocked.length > 0 && (
          <SectionBlock title="Blockers">
            {blocked.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '6px',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: '#a1a1aa',
                    backgroundColor: '#3f3f46',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                >
                  {t.id}
                </span>
                <span style={{ fontSize: '11px', color: '#f87171' }}>{t.title}</span>
              </div>
            ))}
          </SectionBlock>
        )}

        {/* Start Day */}
        <button
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            color: '#fff',
            backgroundColor: '#2563eb',
            marginTop: '8px',
            transition: 'background-color 0.15s',
          }}
        >
          Start Day
        </button>
      </div>
    </div>
  );
}
