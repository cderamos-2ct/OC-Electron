import React from 'react';
import type { ViewId } from '../../stores/view-store';
import { useViewStore } from '../../stores/view-store';

const VIEW_LABELS: Record<ViewId, string> = {
  home: 'Home',
  tasks: 'Tasks',
  'draft-review': 'Draft Review',
  agents: 'Agents',
  comms: 'Comms',
  calendar: 'Calendar',
  github: 'GitHub',
  browser: 'Browser',
  vault: 'Vault',
};

interface Props {
  viewId: ViewId;
  error: Error;
  onReset: () => void;
}

export function ViewErrorFallback({ viewId, error, onReset }: Props) {
  const label = VIEW_LABELS[viewId] ?? viewId;

  const handleReload = () => {
    useViewStore.getState().setActiveView('home');
    onReset();
  };

  const handleCopyError = () => {
    const text = `[${label}] ${error?.message ?? 'Unknown error'}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '12px',
        padding: '32px',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          background: 'var(--dimmer)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '28px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '360px',
          width: '100%',
        }}
      >
        <p
          style={{
            color: 'var(--text-3)',
            fontSize: '13px',
            margin: 0,
            textAlign: 'center',
          }}
        >
          The <strong style={{ color: 'var(--accent)' }}>{label}</strong> view
          encountered an error.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={handleReload}
            style={{
              padding: '7px 16px',
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Reload {label}
          </button>
          <button
            onClick={handleCopyError}
            style={{
              padding: '7px 14px',
              background: 'transparent',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Copy Error
          </button>
        </div>
      </div>
    </div>
  );
}
