import React from 'react';
import { useGateway } from '../../hooks/use-gateway';
import { useUpdater } from '../../hooks/use-updater';

export function AgentStatusBar() {
  const { connectionState } = useGateway();
  const { status: updateStatus, installNow } = useUpdater();

  const dotColor =
    connectionState === 'connected'
      ? '#4ade80'
      : connectionState === 'connecting' || connectionState === 'authenticating'
        ? 'var(--accent, #d4a843)'
        : '#f87171';

  const label =
    connectionState === 'connected'
      ? 'Connected'
      : connectionState === 'connecting' || connectionState === 'authenticating'
        ? 'Connecting'
        : 'Disconnected';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: '5px',
        background: 'var(--dimmer, rgba(0,0,0,0.3))',
        borderTop: '1px solid var(--border, rgba(255,255,255,0.06))',
        zIndex: 20,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: '10px',
          color: 'var(--muted, #555)',
          letterSpacing: '0.3px',
        }}
      >
        {label}
      </span>
    </div>
  );
}
