import React, { useState } from 'react';
import { ChannelSidebar } from './ChannelSidebar';
import { SubtabBar, ChannelFilter } from './SubtabBar';
import { MessageList } from './MessageList';
import { ReadingPane } from './ReadingPane';
import { MOCK_MESSAGES, Message } from './mock-data';

export function CommsView() {
  const [activeNav, setActiveNav] = useState('inbox');
  const [activeTab, setActiveTab] = useState<ChannelFilter>('all');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(MOCK_MESSAGES[0]);
  const [isComposing, setIsComposing] = useState(false);

  const filteredMessages = activeTab === 'all'
    ? MOCK_MESSAGES
    : MOCK_MESSAGES.filter((m) => m.channel === activeTab);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      width: '100%',
      background: '#0f172a',
      overflow: 'hidden',
    }}>
      {/* Channel Sidebar */}
      <ChannelSidebar
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onCompose={() => setIsComposing(true)}
      />

      {/* Main content area */}
      <div className="gmail-main" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* List pane */}
        <div className="gmail-list-pane" style={{
          width: 380,
          minWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #1e1e28',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {/* SubtabBar */}
          <SubtabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* List header */}
          <div style={{
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #13131a',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, color: '#555568', fontWeight: 600 }}>
              {filteredMessages.length} messages
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={{
                background: 'transparent',
                border: 'none',
                color: '#555568',
                fontSize: 12,
                cursor: 'pointer',
                padding: '2px 6px',
              }}>
                Sort ↕
              </button>
              <button style={{
                background: 'transparent',
                border: 'none',
                color: '#555568',
                fontSize: 12,
                cursor: 'pointer',
                padding: '2px 6px',
              }}>
                Filter
              </button>
            </div>
          </div>

          {/* Message list */}
          <MessageList
            messages={filteredMessages}
            selectedId={selectedMessage?.id ?? null}
            onSelect={setSelectedMessage}
          />
        </div>

        {/* Reading pane */}
        <ReadingPane message={selectedMessage} />
      </div>

      {/* Compose modal */}
      {isComposing && (
        <div
          onClick={() => setIsComposing(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 900,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#18181f',
              border: '1px solid #2a2a38',
              borderRadius: 12,
              width: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{
              background: '#1e1e28',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#c8c8d8' }}>New Message</span>
              <button
                onClick={() => setIsComposing(false)}
                style={{ background: 'none', border: 'none', color: '#555568', fontSize: 18, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            {[
              { label: 'To', placeholder: 'Recipients' },
              { label: 'Subject', placeholder: 'Subject' },
            ].map(({ label, placeholder }) => (
              <div key={label} style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #1e1e28',
                padding: '8px 16px',
                gap: 10,
              }}>
                <span style={{ fontSize: 12, color: '#555568', minWidth: 48 }}>{label}</span>
                <input
                  placeholder={placeholder}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    fontSize: 13,
                    color: '#c8c8d8',
                  }}
                />
              </div>
            ))}
            <textarea
              placeholder="Write your message..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: '#c8c8d8',
                padding: '14px 16px',
                minHeight: 160,
                resize: 'none',
                lineHeight: 1.7,
              }}
            />
            <div style={{
              padding: '10px 16px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              borderTop: '1px solid #1e1e28',
            }}>
              <button
                onClick={() => setIsComposing(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #2a2a38',
                  borderRadius: 8,
                  color: '#9898b0',
                  fontSize: 12,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
              <button
                style={{
                  background: '#3c1e17',
                  border: '1px solid #c2703a',
                  borderRadius: 8,
                  color: '#ffb86b',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 14px',
                  cursor: 'pointer',
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
