import React from 'react';
import type { BrowserTab } from '@openclaw/core';
import { useBrowserStore } from '../../stores/browser-store';

// Electron drag-region type extension
type ElectronStyle = React.CSSProperties & { WebkitAppRegion?: string };

interface TabItemProps {
  tab: BrowserTab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}

function TabItem({ tab, isActive, onActivate, onClose }: TabItemProps) {
  return (
    <div
      onClick={onActivate}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '0 10px 0 12px',
        minWidth: '120px',
        maxWidth: '200px',
        height: '100%',
        cursor: 'pointer',
        borderRight: '1px solid var(--border)',
        background: isActive ? 'var(--bg-card)' : 'transparent',
        boxShadow: isActive ? 'inset 0 -2px 0 var(--accent)' : 'none',
        flexShrink: 0,
        position: 'relative',
        WebkitAppRegion: 'no-drag',
      } as ElectronStyle}
    >
      {/* Favicon */}
      {tab.favicon ? (
        <img
          src={tab.favicon}
          alt=""
          style={{ width: '14px', height: '14px', flexShrink: 0, borderRadius: '2px' }}
        />
      ) : (
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            background: 'var(--border)',
            flexShrink: 0,
          }}
        />
      )}

      {/* Title */}
      <span
        style={{
          fontSize: '12px',
          color: isActive ? 'var(--text)' : 'var(--muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        {tab.title || tab.url}
      </span>

      {/* Loading indicator */}
      {tab.state === 'loading' && (
        <div
          style={{
            width: '10px',
            height: '10px',
            border: '1.5px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            flexShrink: 0,
            animation: 'spin 0.7s linear infinite',
          }}
        />
      )}

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
          borderRadius: '3px',
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          fontSize: '12px',
          lineHeight: 1,
          fontFamily: 'inherit',
          WebkitAppRegion: 'no-drag',
        } as ElectronStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--border)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
        }}
      >
        ×
      </button>
    </div>
  );
}

interface BrowserTabBarProps {
  onNewTab?: () => void;
}

export function BrowserTabBar({ onNewTab }: BrowserTabBarProps) {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const setActiveTab = useBrowserStore((s) => s.setActiveTab);
  const closeTab = useBrowserStore((s) => s.closeTab);

  return (
    <div
      style={{
        height: 'var(--tabbar-h)',
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--bg-mid)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        flexShrink: 0,
        WebkitAppRegion: 'no-drag',
      } as ElectronStyle}
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onActivate={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}

      {/* New tab button */}
      <button
        onClick={onNewTab}
        title="New tab"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '100%',
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: '18px',
          flexShrink: 0,
          fontFamily: 'inherit',
          WebkitAppRegion: 'no-drag',
        } as ElectronStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
        }}
      >
        +
      </button>
    </div>
  );
}
