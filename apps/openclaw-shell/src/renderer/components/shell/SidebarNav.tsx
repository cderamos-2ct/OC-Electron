import React, { useState } from 'react';
import { useViewStore, ViewId } from '../../stores/view-store';

interface NavItem {
  id: ViewId;
  icon: string;
  label: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'tasks', icon: '✅', label: 'Tasks' },
  { id: 'draft-review', icon: '✉️', label: 'Drafts' },
  { id: 'agents', icon: '🤖', label: 'Agents' },
  { id: 'comms', icon: '💬', label: 'Comms' },
  { id: 'calendar', icon: '📅', label: 'Calendar' },
  { id: 'github', icon: '🐙', label: 'GitHub' },
  { id: 'browser', icon: '🌐', label: 'Browser' },
  { id: 'vault', icon: '🔐', label: 'Vault' },
];

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 200;

interface SidebarNavProps {
  badges?: Partial<Record<ViewId, number>>;
}

export function SidebarNav({ badges = {} }: SidebarNavProps) {
  const [collapsed, setCollapsed] = useState(true);
  const activeView = useViewStore((s) => s.activeView);
  const setActiveView = useViewStore((s) => s.setActiveView);

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <div
      style={{
        width,
        minWidth: width,
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.15s ease, min-width 0.15s ease',
        userSelect: 'none',
      }}
    >
      {/* Toggle collapse button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{
          width: '100%',
          height: 40,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-end',
          padding: collapsed ? 0 : '0 12px',
          color: 'var(--text-muted)',
          fontSize: '14px',
          flexShrink: 0,
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          const badge = badges[item.id] ?? item.badge;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%',
                height: 44,
                border: 'none',
                background: isActive ? 'var(--accent-bg, rgba(99,102,241,0.12))' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '0' : '0 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: '0',
                position: 'relative',
                transition: 'background 0.1s',
              }}
            >
              {/* Active indicator bar */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    height: '60%',
                    width: 3,
                    borderRadius: '0 2px 2px 0',
                    background: 'var(--accent, #6366f1)',
                  }}
                />
              )}

              {/* Icon */}
              <span
                style={{
                  fontSize: '18px',
                  lineHeight: 1,
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {item.icon}
                {badge !== undefined && badge > 0 && collapsed && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -6,
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: '8px',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 4px',
                      lineHeight: 1.2,
                    }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>

              {/* Label (only when expanded) */}
              {!collapsed && (
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    textAlign: 'left',
                  }}
                >
                  {item.label}
                </span>
              )}

              {/* Badge (expanded) */}
              {!collapsed && badge !== undefined && badge > 0 && (
                <span
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    lineHeight: 1.4,
                    flexShrink: 0,
                  }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
