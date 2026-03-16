import { useState } from 'react';
import type { ViewId } from '../shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MobileNavBadges {
  tasks?: number;
  comms?: number;
  calendar?: number;
  agents?: number;
  'draft-review'?: number;
  github?: number;
}

interface MobileNavProps {
  activeView: ViewId;
  onSelect: (view: ViewId) => void;
  badges?: MobileNavBadges;
}

// ─── Nav config ───────────────────────────────────────────────────────────────

const PRIMARY_TABS: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'tasks', icon: '✅', label: 'Tasks' },
  { id: 'comms', icon: '💬', label: 'Comms' },
  { id: 'calendar', icon: '📅', label: 'Calendar' },
];

const MORE_ITEMS: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: 'agents', icon: '🤖', label: 'Agents' },
  { id: 'draft-review', icon: '✉️', label: 'Drafts' },
  { id: 'github', icon: '🐙', label: 'GitHub' },
  { id: 'browser', icon: '🌐', label: 'Browser' },
  { id: 'vault', icon: '🔐', label: 'Vault' },
];

// ─── More Drawer ──────────────────────────────────────────────────────────────

interface MoreDrawerProps {
  activeView: ViewId;
  badges: MobileNavBadges;
  onSelect: (view: ViewId) => void;
  onClose: () => void;
}

function MoreDrawer({ activeView, badges, onSelect, onClose }: MoreDrawerProps) {
  return (
    <div
      className="more-drawer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="More navigation options"
    >
      <div className="more-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="more-drawer__handle" />
        <div className="more-drawer__grid">
          {MORE_ITEMS.map(({ id, icon, label }) => {
            const isActive = activeView === id;
            const badge = badges[id as keyof MobileNavBadges];
            return (
              <button
                key={id}
                className="more-drawer__item"
                onClick={() => {
                  onSelect(id);
                  onClose();
                }}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className="more-drawer__item-icon"
                  style={{ position: 'relative', display: 'inline-block' }}
                >
                  {icon}
                  {badge !== undefined && badge > 0 && (
                    <span className="badge">{badge > 99 ? '99+' : badge}</span>
                  )}
                </span>
                <span
                  className="more-drawer__item-label"
                  style={{ color: isActive ? 'var(--accent)' : undefined }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MobileNav ────────────────────────────────────────────────────────────────

export function MobileNav({ activeView, onSelect, badges = {} }: MobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  // Determine if the active view is in the "More" group
  const isMoreActive = MORE_ITEMS.some((item) => item.id === activeView);

  const handleTabSelect = (view: ViewId) => {
    setMoreOpen(false);
    onSelect(view);
  };

  return (
    <>
      {moreOpen && (
        <MoreDrawer
          activeView={activeView}
          badges={badges}
          onSelect={handleTabSelect}
          onClose={() => setMoreOpen(false)}
        />
      )}

      <nav className="mobile-bottom-nav" aria-label="Main navigation">
        {PRIMARY_TABS.map(({ id, icon, label }) => {
          const isActive = activeView === id;
          const badge = badges[id as keyof MobileNavBadges];
          return (
            <button
              key={id}
              className={`mobile-bottom-nav__tab${isActive ? ' mobile-bottom-nav__tab--active' : ''}`}
              onClick={() => handleTabSelect(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="mobile-bottom-nav__icon">
                {icon}
                {badge !== undefined && badge > 0 && (
                  <span className="badge">{badge > 99 ? '99+' : badge}</span>
                )}
              </span>
              <span className="mobile-bottom-nav__label">{label}</span>
            </button>
          );
        })}

        {/* More tab */}
        <button
          className={`mobile-bottom-nav__tab${isMoreActive || moreOpen ? ' mobile-bottom-nav__tab--active' : ''}`}
          onClick={() => setMoreOpen((o) => !o)}
          aria-label="More"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
        >
          <span className="mobile-bottom-nav__icon">⋯</span>
          <span className="mobile-bottom-nav__label">More</span>
        </button>
      </nav>
    </>
  );
}
