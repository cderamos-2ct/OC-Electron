import React, { useState } from 'react';
import { useTasks } from '../../hooks/use-tasks';
import type { TaskDocument } from '../../../shared/types';

// ─── Types ──────────────────────────────────────────────────────────────────

type CardVariant = 'approval' | 'urgent' | 'running' | 'queued' | 'done';
type BadgeVariant = 'approval' | 'blocked' | 'running' | 'queued' | 'done';

interface AgentTag {
  emoji: string;
  name: string;
}

interface TaskCardData {
  id: string;
  variant: CardVariant;
  avatarEmoji: string;
  avatarBg: string;
  taskId: string;
  badgeVariant: BadgeVariant;
  badgeLabel: string;
  title: string;
  description: string;
  agents: AgentTag[];
  agentSeparator?: 'arrow' | 'verified';
  time: string;
  actions?: Array<{ label: string; variant: 'primary' | 'secondary' | 'danger' }>;
}

// ─── Agent registry ──────────────────────────────────────────────────────────
// Maps known agent identifiers to display data

const AGENT_DISPLAY: Record<string, { emoji: string; avatarBg: string; name: string }> = {
  karoline:  { emoji: '🛡️', avatarBg: '#5e1f2d', name: 'Karoline' },
  marcus:    { emoji: '🏛️', avatarBg: '#1f3d5e', name: 'Marcus' },
  vulcan:    { emoji: '🔥', avatarBg: '#5e2d1f', name: 'Vulcan' },
  kronos:    { emoji: '⏳', avatarBg: '#5e4e1f', name: 'Kronos' },
  ada:       { emoji: '🔮', avatarBg: '#3d1f5e', name: 'Ada' },
  vesta:     { emoji: '🏠', avatarBg: '#5e3d1f', name: 'Vesta' },
  hermes:    { emoji: '📡', avatarBg: '#1f4e5e', name: 'Hermes' },
  argus:     { emoji: '👁️', avatarBg: '#2d2d5e', name: 'Argus' },
  iris:      { emoji: '🌈', avatarBg: '#3d1f5e', name: 'Iris' },
};

const FALLBACK_AGENT = { emoji: '🤖', avatarBg: '#2d2d2d', name: 'Agent' };

function agentDisplay(ownerAgent: string) {
  const key = ownerAgent.toLowerCase();
  return AGENT_DISPLAY[key] ?? { ...FALLBACK_AGENT, name: ownerAgent };
}

// ─── Mapping TaskDocument → TaskCardData ─────────────────────────────────────

function relativeTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function toCardVariant(task: TaskDocument): CardVariant {
  if (task.status === 'done' || task.status === 'cancelled') return 'done';
  if (task.status === 'blocked') return 'urgent';
  if (task.status === 'needs_christian') return 'approval';
  if (task.status === 'in_progress') return 'running';
  return 'queued';
}

function toBadge(task: TaskDocument): { variant: BadgeVariant; label: string } {
  switch (task.status) {
    case 'done':        return { variant: 'done', label: 'Done' };
    case 'cancelled':   return { variant: 'done', label: 'Cancelled' };
    case 'blocked':     return { variant: 'blocked', label: 'Blocked' };
    case 'needs_christian': return { variant: 'approval', label: 'Needs You' };
    case 'in_progress': return { variant: 'running', label: 'Running' };
    default:            return { variant: 'queued', label: 'Queued' };
  }
}

function toCardActions(task: TaskDocument): TaskCardData['actions'] {
  if (task.status === 'needs_christian') {
    return [
      { label: 'Approve', variant: 'primary' },
      { label: 'Defer', variant: 'secondary' },
    ];
  }
  if (task.status === 'blocked') {
    return [
      { label: 'Review', variant: 'primary' },
      { label: 'Defer', variant: 'secondary' },
    ];
  }
  return undefined;
}

function taskDocToCardData(task: TaskDocument): TaskCardData {
  const agent = agentDisplay(task.owner_agent || 'agent');
  const badge = toBadge(task);
  return {
    id: task.id,
    variant: toCardVariant(task),
    avatarEmoji: agent.emoji,
    avatarBg: agent.avatarBg,
    taskId: task.id.toUpperCase(),
    badgeVariant: badge.variant,
    badgeLabel: badge.label,
    title: task.title,
    description: task.description || task.currentState || '',
    agents: [{ emoji: agent.emoji, name: agent.name }],
    time: relativeTime(task.updated_at),
    actions: toCardActions(task),
  };
}

// ─── Badge styles ────────────────────────────────────────────────────────────

function badgeStyle(variant: BadgeVariant): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
  switch (variant) {
    case 'running':  return { ...base, background: '#2d1a1a', color: '#ff7b5b' };
    case 'approval': return { ...base, background: '#5e4e1f', color: '#f5c842' };
    case 'blocked':  return { ...base, background: '#5e1f1f', color: '#ff6b6b' };
    case 'queued':   return { ...base, background: 'rgba(241,245,249,0.14)', color: '#94a3b8' };
    case 'done':     return { ...base, background: '#1f5e2d', color: '#6bffb0' };
  }
}

function cardBorderLeft(variant: CardVariant): string {
  switch (variant) {
    case 'urgent':   return '3px solid #e74c3c';
    case 'approval': return '3px solid #e0c875';
    case 'running':  return '3px solid #a3862a';
    case 'queued':   return '3px solid #4a4a4a';
    case 'done':     return '3px solid #2ecc71';
  }
}

function actionBtnStyle(variant: 'primary' | 'secondary' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  };
  switch (variant) {
    case 'primary':   return { ...base, background: '#a3862a', color: '#fff' };
    case 'secondary': return { ...base, background: 'rgba(241,245,249,0.14)', color: '#cbd5e1' };
    case 'danger':    return { ...base, background: '#5e1f1f', color: '#ff8888' };
  }
}

// ─── TaskCard ────────────────────────────────────────────────────────────────

function TaskCard({ card }: { card: TaskCardData }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: cardBorderLeft(card.variant),
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        opacity: card.variant === 'done' ? 0.7 : 1,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: card.avatarBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0,
        }}
      >
        {card.avatarEmoji}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#a3862a',
              fontFamily: "'SF Mono', 'Menlo', monospace",
            }}
          >
            {card.taskId}
          </span>
          <span style={badgeStyle(card.badgeVariant)}>{card.badgeLabel}</span>
        </div>

        {/* Title */}
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#fff' }}>
          {card.title}
        </div>

        {/* Description */}
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
          {card.description}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {card.agents.map((agent, i) => (
            <React.Fragment key={agent.name + i}>
              {i > 0 && card.agentSeparator === 'arrow' && (
                <span style={{ color: '#4a4a4a', fontSize: '11px' }}>→</span>
              )}
              {i > 0 && card.agentSeparator === 'verified' && (
                <span style={{ color: '#4a4a4a', fontSize: '11px' }}>verified by</span>
              )}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: '12px' }}>{agent.emoji}</span>
                <span style={{ color: '#cbd5e1', fontWeight: 500 }}>{agent.name}</span>
              </div>
            </React.Fragment>
          ))}
          <span style={{ fontSize: '11px', color: '#4a4a5a', marginLeft: 'auto' }}>{card.time}</span>
        </div>
      </div>

      {/* Actions */}
      {card.actions && card.actions.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto', flexShrink: 0, alignSelf: 'center', flexWrap: 'wrap' }}>
          {card.actions.map((action) => (
            <button key={action.label} style={actionBtnStyle(action.variant)}>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid #4a4a4a',
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        opacity: 0.5,
      }}
    >
      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(241,245,249,0.1)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ height: '10px', width: '80px', borderRadius: '4px', background: 'rgba(241,245,249,0.1)' }} />
        <div style={{ height: '14px', width: '60%', borderRadius: '4px', background: 'rgba(241,245,249,0.1)' }} />
        <div style={{ height: '12px', width: '90%', borderRadius: '4px', background: 'rgba(241,245,249,0.08)' }} />
      </div>
    </div>
  );
}

// ─── Filter pills ─────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Needs Me', 'Running', 'Blocked', 'By Agent'];

// ─── TasksView ────────────────────────────────────────────────────────────────

export function TasksView() {
  const [activeFilter, setActiveFilter] = useState('All');
  const {
    tasks,
    loading,
    needsChristianTasks,
    inProgressTasks,
    queuedTasks,
    blockedTasks,
    handledTasks,
  } = useTasks();

  // Apply filter
  const filteredTasks: TaskDocument[] = (() => {
    switch (activeFilter) {
      case 'Needs Me': return needsChristianTasks;
      case 'Running':  return inProgressTasks;
      case 'Blocked':  return blockedTasks;
      default:         return [...needsChristianTasks, ...blockedTasks, ...inProgressTasks, ...queuedTasks, ...handledTasks];
    }
  })();

  const cards = filteredTasks.map(taskDocToCardData);

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        background: '#0f172a',
      }}
    >
      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 40px',
          minWidth: 0,
        }}
      >
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 600,
                color: '#fff',
                margin: 0,
              }}
            >
              Operator Overview
            </h1>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '2px' }}>
              Phase 1 — Command Center
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
              const isActive = activeFilter === f;
              return (
                <div
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: isActive
                      ? '1px solid #a3862a'
                      : '1px solid rgba(241,245,249,0.14)',
                    background: isActive ? 'rgba(163,134,42,0.2)' : 'transparent',
                    color: isActive ? 'var(--yellow)' : '#94a3b8',
                    userSelect: 'none',
                  }}
                >
                  {f}
                </div>
              );
            })}
          </div>
        </div>

        {/* Task grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : cards.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: '#4a4a5a',
                fontSize: '14px',
              }}
            >
              No active tasks
            </div>
          ) : (
            cards.map((card) => (
              <TaskCard key={card.id} card={card} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
