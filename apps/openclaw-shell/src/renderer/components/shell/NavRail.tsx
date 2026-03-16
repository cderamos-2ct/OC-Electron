import React from 'react';

export type NativeViewId =
  | 'home'
  | 'tasks'
  | 'comms'
  | 'agents'
  | 'draft-review'
  | 'calendar'
  | 'github'
  | 'browser'
  | 'vault';

interface NavItem {
  id: NativeViewId;
  icon: string;
  label: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'tasks', icon: '✅', label: 'Tasks' },
  { id: 'comms', icon: '✉️', label: 'Comms' },
  { id: 'calendar', icon: '📅', label: 'Calendar' },
  { id: 'github', icon: '🐙', label: 'GitHub' },
  { id: 'agents', icon: '🤖', label: 'Agents' },
  { id: 'draft-review', icon: '📝', label: 'Drafts' },
  { id: 'browser', icon: '🌐', label: 'Browser' },
  { id: 'vault', icon: '🔐', label: 'Vault' },
];

interface NavRailProps {
  activeView: NativeViewId;
  onViewChange: (id: NativeViewId) => void;
  badges?: Partial<Record<NativeViewId, number>>;
}

export function NavRail({ activeView, onViewChange, badges = {} }: NavRailProps) {
  return (
    <div style={{
      width: 56,
      minWidth: 56,
      background: '#09090d',
      borderRight: '1px solid #1a1a24',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0',
      gap: 2,
      flexShrink: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Aegilume logo mark */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: '#3c1e17',
        border: '1px solid #c2703a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        marginBottom: 8,
        flexShrink: 0,
      }}>
        🦞
      </div>

      {/* Divider */}
      <div style={{ width: 28, height: 1, background: '#1a1a24', marginBottom: 6 }} />

      {/* Nav items */}
      {NAV_ITEMS.map((item) => {
        const isActive = activeView === item.id;
        const badge = badges[item.id];
        return (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            title={item.label}
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: 10,
              border: isActive ? '1px solid rgba(194,112,58,0.5)' : '1px solid transparent',
              background: isActive ? 'rgba(194,112,58,0.15)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            {item.icon}
            {/* Active indicator */}
            {isActive && (
              <div style={{
                position: 'absolute',
                left: -8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 3,
                height: 20,
                borderRadius: '0 2px 2px 0',
                background: '#c2703a',
              }} />
            )}
            {/* Badge */}
            {badge !== undefined && badge > 0 && (
              <div style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#c2703a',
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {badge > 9 ? '9+' : badge}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
