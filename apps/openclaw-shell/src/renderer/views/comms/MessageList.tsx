import React from 'react';
import { Message, AgentBadge, ChannelType } from './mock-data';

const CHANNEL_ICONS: Record<ChannelType, string> = {
  email: '✉️',
  imessage: '💬',
  slack: '🔷',
  social: '🌐',
  phone: '📞',
};

const AGENT_BADGE_STYLES: Record<AgentBadge, { bg: string; color: string; label: string }> = {
  triaged: { bg: 'rgba(34,197,94,0.15)', color: '#4ade80', label: 'triaged' },
  draft: { bg: 'rgba(251,146,60,0.15)', color: '#fb923c', label: 'draft' },
  flagged: { bg: 'rgba(234,179,8,0.15)', color: '#facc15', label: 'flagged' },
  archived: { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', label: 'archived' },
};

interface MessageListProps {
  messages: Message[];
  selectedId: string | null;
  onSelect: (msg: Message) => void;
}

export function MessageList({ messages, selectedId, onSelect }: MessageListProps) {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {messages.map((msg) => {
        const isSelected = selectedId === msg.id;
        const badge = msg.agentBadge ? AGENT_BADGE_STYLES[msg.agentBadge] : null;

        return (
          <div
            key={msg.id}
            onClick={() => onSelect(msg)}
            style={{
              padding: '10px 14px',
              cursor: 'pointer',
              background: isSelected
                ? '#1d1a14'
                : msg.isUnread
                ? '#141418'
                : 'transparent',
              borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
              borderBottom: '1px solid #13131a',
              transition: 'background 0.1s',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {/* Row 1: Channel icon + Sender + Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Avatar */}
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: isSelected ? 'rgba(163,134,42,0.15)' : '#1e1e28',
                border: isSelected ? '1px solid var(--accent)' : '1px solid #2a2a38',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: isSelected ? '#ffb86b' : '#9898b0',
                flexShrink: 0,
              }}>
                {msg.senderInitials}
              </div>

              {/* Channel icon */}
              <span style={{ fontSize: 11 }}>{CHANNEL_ICONS[msg.channel]}</span>

              {/* Sender */}
              <span style={{
                fontSize: 12,
                fontWeight: msg.isUnread ? 700 : 500,
                color: msg.isUnread ? '#e8e8f0' : '#9898b0',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {msg.sender}
              </span>

              {/* Unread dot */}
              {msg.isUnread && (
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  flexShrink: 0,
                }} />
              )}

              {/* Time */}
              <span style={{
                fontSize: 10,
                color: '#555568',
                flexShrink: 0,
              }}>
                {msg.timestamp}
              </span>
            </div>

            {/* Row 2: Subject */}
            {msg.subject && (
              <div style={{
                fontSize: 12,
                fontWeight: msg.isUnread ? 600 : 400,
                color: msg.isUnread ? '#c8c8d8' : '#7878a0',
                paddingLeft: 34,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {msg.subject}
              </div>
            )}

            {/* Row 3: Snippet + Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 34,
            }}>
              <span style={{
                fontSize: 11,
                color: '#555568',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {msg.snippet}
              </span>
              {badge && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  background: badge.bg,
                  color: badge.color,
                  borderRadius: 4,
                  padding: '1px 5px',
                  flexShrink: 0,
                }}>
                  {badge.label}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
