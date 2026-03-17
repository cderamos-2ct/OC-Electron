import React from 'react';

type NavSection = {
  label?: string;
  items: { id: string; icon: string; label: string; count?: number }[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: 'inbox', icon: '📥', label: 'Inbox', count: 24 },
      { id: 'starred', icon: '⭐', label: 'Starred', count: 3 },
      { id: 'sent', icon: '📤', label: 'Sent' },
      { id: 'drafts', icon: '📝', label: 'Drafts', count: 2 },
    ],
  },
  {
    label: 'organize',
    items: [
      { id: 'archive', icon: '🗄️', label: 'Archive' },
    ],
  },
];

interface ChannelSidebarProps {
  activeNav: string;
  onNavChange: (id: string) => void;
  onCompose: () => void;
}

export function ChannelSidebar({ activeNav, onNavChange, onCompose }: ChannelSidebarProps) {
  return (
    <div style={{
      width: 200,
      minWidth: 200,
      background: '#0e0e12',
      borderRight: '1px solid #1e1e28',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 8px',
      gap: 4,
      flexShrink: 0,
    }}>
      {/* Compose Button */}
      <button
        onClick={onCompose}
        style={{
          background: '#3c1e17',
          border: '1px solid var(--accent)',
          borderRadius: 20,
          color: '#ffb86b',
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 16px',
          cursor: 'pointer',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ fontSize: 14 }}>✏️</span>
        Compose
      </button>

      {/* Nav Sections */}
      {NAV_SECTIONS.map((section, si) => (
        <div key={si} style={{ marginBottom: 8 }}>
          {section.label && (
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#555568',
              padding: '4px 10px 2px',
              marginBottom: 2,
            }}>
              {section.label}
            </div>
          )}
          {section.items.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavChange(item.id)}
                style={{
                  width: '100%',
                  background: isActive ? 'rgba(163,134,42,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: '0 20px 20px 0',
                  color: isActive ? '#ffb86b' : '#9898b0',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  padding: '7px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 14, minWidth: 18 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.count !== undefined && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: isActive ? '#ffb86b' : '#555568',
                    background: isActive ? 'rgba(163,134,42,0.2)' : '#1e1e28',
                    borderRadius: 8,
                    padding: '1px 6px',
                  }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
