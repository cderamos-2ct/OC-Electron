import React from 'react';

export type ChannelFilter = 'all' | 'email' | 'imessage' | 'slack' | 'social' | 'phone';

const TABS: { id: ChannelFilter; label: string; icon?: string; count?: number }[] = [
  { id: 'all', label: 'All' },
  { id: 'email', label: 'Email', icon: '✉️', count: 12 },
  { id: 'imessage', label: 'iMessage', icon: '💬', count: 3 },
  { id: 'slack', label: 'Slack', icon: '🔷', count: 8 },
  { id: 'social', label: 'Social', icon: '🌐' },
  { id: 'phone', label: 'Phone', icon: '📞', count: 1 },
];

interface SubtabBarProps {
  activeTab: ChannelFilter;
  onTabChange: (tab: ChannelFilter) => void;
}

export function SubtabBar({ activeTab, onTabChange }: SubtabBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      borderBottom: '1px solid #1e1e28',
      background: '#0e0e12',
      padding: '0 12px',
      overflowX: 'auto',
      flexShrink: 0,
    }}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              color: isActive ? '#ffb86b' : '#6e6e88',
              fontSize: 12,
              fontWeight: isActive ? 500 : 400,
              padding: '10px 10px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                background: isActive ? 'rgba(163,134,42,0.25)' : '#1e1e28',
                color: isActive ? '#ffb86b' : '#555568',
                borderRadius: 8,
                padding: '1px 5px',
                lineHeight: 1.4,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
