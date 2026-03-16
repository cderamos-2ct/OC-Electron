import React from 'react';

// Electron adds WebkitAppRegion to CSSProperties but it's not in the standard types
type ElectronStyle = React.CSSProperties & { WebkitAppRegion?: string };

export interface Tab {
  id: string;
  label: string;
  emoji?: string;
  badge?: number;
}

export interface TabBarProps {
  tabs: Tab[];
  active?: string;
  onChange?: (id: string) => void;
  style?: React.CSSProperties;
}

export function TabBar({ tabs, active, onChange, style }: TabBarProps) {
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
        ...style,
      } as ElectronStyle}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange?.(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0 16px',
              fontSize: '13px',
              color: isActive ? 'var(--text)' : 'var(--muted)',
              cursor: 'pointer',
              borderRight: '1px solid var(--border)',
              borderTop: 'none',
              borderBottom: 'none',
              borderLeft: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              background: isActive ? 'var(--border-2)' : 'transparent',
              boxShadow: isActive ? 'inset 0 -2px 0 var(--accent)' : 'none',
              transition: 'color 0.12s, background 0.12s',
              fontFamily: 'inherit',
              WebkitAppRegion: 'no-drag',
            } as ElectronStyle}
          >
            {tab.emoji && <span>{tab.emoji}</span>}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span
                style={{
                  background: 'var(--red)',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '1px 5px',
                  borderRadius: '8px',
                  fontWeight: 600,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
