import React from 'react';
import { useBrowserStore, PinnedApp } from '../../stores/browser-store';
import type { AddAppConfig } from '@openclaw/core';

interface PinnedAppTileProps {
  app: PinnedApp;
  onOpen: (app: PinnedApp) => void;
  onUnpin: (localId: string) => void;
}

function PinnedAppTile({ app, onOpen, onUnpin }: PinnedAppTileProps) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
    >
      <button
        onClick={() => onOpen(app)}
        title={app.name}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          cursor: 'pointer',
          fontSize: '24px',
          transition: 'border-color 0.12s, background 0.12s',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-mid)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)';
        }}
      >
        {app.iconUrl ? (
          <img src={app.iconUrl} alt={app.name} style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
        ) : (
          <span style={{ fontSize: '20px' }}>🌐</span>
        )}
      </button>

      <span
        style={{
          fontSize: '11px',
          color: 'var(--muted)',
          textAlign: 'center',
          maxWidth: '64px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {app.name}
      </span>

      {/* Unpin button — appears on hover */}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnpin(app.localId);
          }}
          title="Unpin"
          style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: 'none',
            background: 'var(--bg-mid)',
            color: 'var(--muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            padding: 0,
            fontFamily: 'inherit',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

interface PinnedAppGridProps {
  onOpenApp: (app: PinnedApp) => void;
  onShowAddModal: () => void;
}

export function PinnedAppGrid({ onOpenApp, onShowAddModal }: PinnedAppGridProps) {
  const pinnedApps = useBrowserStore((s) => s.pinnedApps);
  const removePinnedApp = useBrowserStore((s) => s.removePinnedApp);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: '48px',
        padding: '40px',
        overflow: 'auto',
      }}
    >
      {pinnedApps.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, 72px)',
            gap: '24px',
            justifyContent: 'center',
            maxWidth: '480px',
          }}
        >
          {pinnedApps.map((app) => (
            <PinnedAppTile
              key={app.localId}
              app={app}
              onOpen={onOpenApp}
              onUnpin={removePinnedApp}
            />
          ))}
        </div>
      )}

      {/* Add App button */}
      <button
        onClick={onShowAddModal}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: '13px',
          fontFamily: 'inherit',
          transition: 'border-color 0.12s, color 0.12s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
        }}
      >
        <span style={{ fontSize: '16px' }}>+</span>
        Add App
      </button>
    </div>
  );
}
