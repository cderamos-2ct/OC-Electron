import React from 'react';
import type { VaultConnectionState, VaultStatus } from '../../../shared/types.js';

interface VaultStatusBarProps {
  status: VaultStatus;
}

function connectionColor(state: VaultConnectionState): string {
  switch (state) {
    case 'unlocked': return '#22c55e';
    case 'locked': return '#eab308';
    case 'error': return '#ef4444';
    case 'disconnected': return '#6b7280';
    default: return '#6b7280';
  }
}

function connectionLabel(state: VaultConnectionState): string {
  switch (state) {
    case 'unlocked': return 'Unlocked';
    case 'locked': return 'Locked';
    case 'error': return 'Error';
    case 'disconnected': return 'Disconnected';
    default: return 'Unknown';
  }
}

export function VaultStatusBar({ status }: VaultStatusBarProps) {
  const color = connectionColor(status.state);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        padding: '10px 40px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        fontSize: '12px',
        color: 'var(--text-muted)',
      }}
    >
      {/* Connection indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
        <span style={{ color, fontWeight: 600 }}>{connectionLabel(status.state)}</span>
      </div>

      <div style={{ width: 1, height: 14, background: 'var(--border-default)' }} />

      <span>{status.serverUrl}</span>

      <div style={{ width: 1, height: 14, background: 'var(--border-default)' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{status.secretCount}</span>
        <span>secrets</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{status.activeLeases}</span>
        <span>active leases</span>
      </div>

      {status.pendingApprovals > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{status.pendingApprovals}</span>
          <span>pending</span>
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>Last sync:</span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString() : 'Never'}
        </span>
      </div>
    </div>
  );
}
