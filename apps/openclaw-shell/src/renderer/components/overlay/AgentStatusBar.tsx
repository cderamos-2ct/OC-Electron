import React, { useState } from 'react';
import { useShellStore } from '../../stores/shell-store';

export function AgentStatusBar() {
  const activeServiceId = useShellStore((s) => s.activeServiceId);
  const services = useShellStore((s) => s.services);
  const pendingActionCount = useShellStore((s) => s.pendingActionCount);
  const [expanded, setExpanded] = useState(false);

  const activeService = services.find((s) => s.id === activeServiceId);
  const agentId = activeService?.agentId;

  if (!agentId) return null;

  // Agent display names (matches binding registry)
  const AGENT_NAMES: Record<string, string> = {
    cd: 'CD',
    karoline: 'Karoline',
    calendar: 'Kronos',
    build: 'Vulcan',
    notes: 'Ada',
    ops: 'Argus',
    research: 'Hypatia',
    finance: 'Marcus',
    iris: 'Iris',
    hermes: 'Hermes',
    vesta: 'Vesta',
    socrates: 'Socrates',
    verifier: 'Themis',
    boswell: 'Boswell',
  };

  // Agent avatar letters
  const AGENT_AVATARS: Record<string, string> = {
    cd: 'CD',
    karoline: 'K',
    calendar: 'Kr',
    build: 'V',
    notes: 'A',
    ops: 'Ar',
    research: 'H',
    finance: 'M',
    iris: 'I',
    hermes: 'He',
    vesta: 'Ve',
    socrates: 'So',
    verifier: 'Th',
    boswell: 'Bo',
  };

  const displayName = AGENT_NAMES[agentId] ?? agentId;
  const avatar = AGENT_AVATARS[agentId] ?? agentId.charAt(0).toUpperCase();
  const activityText = `Bound to ${activeService.name}`;
  const actionCount = pendingActionCount;

  return (
    <div
      style={{
        height: expanded ? 'auto' : '48px',
        minHeight: '48px',
        maxHeight: expanded ? '200px' : '48px',
        background: 'rgba(24, 24, 27, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--accent-blue)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => setExpanded((prev) => !prev)}
    >
      {/* Main bar row */}
      <div
        style={{
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '0 14px',
          flexShrink: 0,
        }}
      >
        {/* Agent avatar */}
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
            letterSpacing: '0.02em',
          }}
        >
          {avatar}
        </div>

        {/* Agent name */}
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {displayName}
        </span>

        {/* Activity text */}
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          {activityText}
        </span>

        {/* Pending action count badge */}
        {actionCount > 0 && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: '#fff',
              background: 'var(--accent-orange)',
              borderRadius: '10px',
              padding: '2px 8px',
              flexShrink: 0,
              lineHeight: '14px',
            }}
          >
            {actionCount}
          </span>
        )}

        {/* Expand chevron */}
        <span
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            flexShrink: 0,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        >
          &#9650;
        </span>
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <div
          style={{
            padding: '4px 14px 12px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px',
              fontSize: '11px',
            }}
          >
            <div style={{ color: 'var(--text-muted)' }}>Agent</div>
            <div style={{ color: 'var(--text-secondary)' }}>{displayName}</div>
            <div style={{ color: 'var(--text-muted)' }}>Service</div>
            <div style={{ color: 'var(--text-secondary)' }}>{activeService.name}</div>
            <div style={{ color: 'var(--text-muted)' }}>Agent ID</div>
            <div style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '10px' }}>
              {agentId}
            </div>
            {actionCount > 0 && (
              <>
                <div style={{ color: 'var(--text-muted)' }}>Pending</div>
                <div style={{ color: 'var(--accent-orange)' }}>{actionCount} action{actionCount !== 1 ? 's' : ''}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
