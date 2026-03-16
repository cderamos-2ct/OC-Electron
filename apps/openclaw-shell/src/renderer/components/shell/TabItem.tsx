import React from 'react';
import { ServiceConfig, ServiceState } from '../../../shared/types';

// ─── Agent Color Map ──────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  cd: '#737373',       // gray
  karoline: '#3b82f6', // blue — comms
  iris: '#8b5cf6',     // purple — intel
  hermes: '#ec4899',   // pink — people graph
  vesta: '#10b981',    // emerald — calendar observe
  marcus: '#f59e0b',   // amber — finance
  ada: '#06b6d4',      // cyan — notes/meetings
  kronos: '#22c55e',   // green — calendar ops
  argus: '#6366f1',    // indigo — ops
  vulcan: '#ef4444',   // red — build/engineering
  hypatia: '#f97316',  // orange — research
  socrates: '#a855f7', // violet — strategy
  themis: '#14b8a6',   // teal — verification
};

function getAgentColor(agentId?: string): string {
  if (!agentId) return '#737373';
  return AGENT_COLORS[agentId] ?? '#737373';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TabItemProps {
  service: ServiceConfig;
  isActive: boolean;
  badgeCount: number;
  serviceState?: ServiceState;
  onClick: () => void;
  onMiddleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TabItem({
  service,
  isActive,
  badgeCount,
  serviceState,
  onClick,
  onMiddleClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: TabItemProps) {
  const agentColor = getAgentColor(service.agentId);
  const isHibernated = serviceState === 'hibernated';
  const hasUnread = badgeCount > 0;

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Middle click (button 1) to close
    if (e.button === 1) {
      e.preventDefault();
      onMiddleClick?.();
    }
  };

  return (
    <button
      onClick={onClick}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
      title={service.name}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 12px',
        height: '36px',
        border: 'none',
        borderBottom: isActive
          ? '2px solid var(--accent-blue)'
          : '2px solid transparent',
        background: isActive ? 'var(--bg-tertiary)' : 'transparent',
        color: isActive
          ? 'var(--text-primary)'
          : isHibernated
          ? 'var(--text-secondary)'
          : 'var(--text-secondary)',
        opacity: isHibernated ? 0.5 : 1,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontSize: '13px',
        fontWeight: isActive ? 500 : 400,
        transition: 'background 0.1s, color 0.1s, opacity 0.1s',
        flexShrink: 0,
        position: 'relative',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = isHibernated
            ? 'var(--text-secondary)'
            : 'var(--text-secondary)';
        }
      }}
    >
      {/* Favicon or fallback initial */}
      {service.icon ? (
        <img
          src={service.icon}
          alt=""
          style={{ width: '14px', height: '14px', borderRadius: '2px', flexShrink: 0 }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span
          title={service.agentId ? `Agent: ${service.agentId}` : 'No agent'}
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            backgroundColor: agentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {service.name.charAt(0).toUpperCase()}
        </span>
      )}

      {/* Service name */}
      <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {service.name}
      </span>

      {/* Unread badge */}
      {hasUnread && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '16px',
            height: '16px',
            padding: '0 4px',
            borderRadius: '8px',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}

      {/* Pinned indicator */}
      {service.pinned && (
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'var(--text-secondary)',
            opacity: 0.5,
            flexShrink: 0,
          }}
        />
      )}
    </button>
  );
}
