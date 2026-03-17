import React, { useState } from 'react';
import { IMessage } from './types';

const CHANNEL_COLORS: Record<string, string> = {
  imessage: '#2a5a3c',
  slack: '#4f3b8c',
  email: '#1e3a5f',
};

interface BubbleThreadProps {
  messages: IMessage[];
  contactName: string;
  contactInitials: string;
}

export function BubbleThread({ messages, contactName, contactInitials }: BubbleThreadProps) {
  const [replyText, setReplyText] = useState('');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: 0,
    }}>
      {/* Contact header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 0 16px 0',
        borderBottom: '1px solid #1e1e28',
        marginBottom: 16,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#1e1e28',
          border: '1px solid #2a2a38',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          color: '#9898b0',
        }}>
          {contactInitials}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0' }}>{contactName}</div>
          <div style={{ fontSize: 11, color: '#4ade80' }}>iMessage · Active now</div>
        </div>
      </div>

      {/* Bubbles */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        paddingBottom: 12,
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: msg.fromMe ? 'row-reverse' : 'row',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            {!msg.fromMe && (
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: '#1e1e28',
                border: '1px solid #2a2a38',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#9898b0',
                flexShrink: 0,
              }}>
                {contactInitials}
              </div>
            )}
            <div style={{
              maxWidth: '70%',
              background: msg.fromMe ? '#1a3d28' : '#1e1e24',
              border: msg.fromMe ? '1px solid #2a5a3c' : '1px solid #2a2a38',
              borderRadius: msg.fromMe
                ? '12px 12px 4px 12px'
                : '12px 12px 12px 4px',
              padding: '8px 12px',
            }}>
              <div style={{ fontSize: 13, color: '#d8d8e8', lineHeight: 1.5 }}>
                {msg.content}
              </div>
              <div style={{
                fontSize: 10,
                color: '#555568',
                marginTop: 4,
                textAlign: msg.fromMe ? 'right' : 'left',
              }}>
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply bar */}
      <div style={{
        background: '#141418',
        borderRadius: 10,
        border: '1px solid #1e1e28',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        marginTop: 8,
      }}>
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="iMessage"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 13,
            color: '#d8d8e8',
          }}
        />
        <button
          onClick={() => setReplyText('')}
          style={{
            background: 'rgba(194,112,58,0.2)',
            border: '1px solid rgba(194,112,58,0.4)',
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 13,
            color: '#ffb86b',
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
