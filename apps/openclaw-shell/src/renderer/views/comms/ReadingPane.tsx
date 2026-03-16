import React, { useState } from 'react';
import { Message, ChannelType, MOCK_IMESSAGES, MOCK_VOICEMAIL } from './mock-data';
import { BubbleThread } from './BubbleThread';
import { VoicemailPlayer } from './VoicemailPlayer';
import { AgentOverlayToolbar } from './AgentOverlayToolbar';
import { ConfirmSendModal } from './ConfirmSendModal';

const CHANNEL_BADGE: Record<ChannelType, { label: string; color: string; bg: string }> = {
  email: { label: 'Email', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  imessage: { label: 'iMessage', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  slack: { label: 'Slack', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  social: { label: 'Social', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' },
  phone: { label: 'Voicemail', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
};

interface ReadingPaneProps {
  message: Message | null;
}

export function ReadingPane({ message }: ReadingPaneProps) {
  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!message) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#444460',
        gap: 8,
      }}>
        <span style={{ fontSize: 40 }}>📬</span>
        <span style={{ fontSize: 14 }}>Select a message to read</span>
      </div>
    );
  }

  const badge = CHANNEL_BADGE[message.channel];

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflowY: 'auto',
    }}>
      <div style={{ padding: '20px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Channel badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: badge.color,
            background: badge.bg,
            borderRadius: 6,
            padding: '3px 10px',
          }}>
            {badge.label}
          </span>
          {message.isUnread && (
            <span style={{
              fontSize: 10,
              color: '#555568',
              background: '#1e1e28',
              borderRadius: 6,
              padding: '2px 8px',
            }}>
              Unread
            </span>
          )}
        </div>

        {/* iMessage channel */}
        {message.channel === 'imessage' ? (
          <div style={{ flex: 1 }}>
            <BubbleThread
              messages={MOCK_IMESSAGES}
              contactName={message.sender}
              contactInitials={message.senderInitials}
            />
          </div>
        ) : message.channel === 'phone' ? (
          /* Voicemail channel */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e8e8f0' }}>
              Voicemail from {message.sender}
            </h2>
            <VoicemailPlayer voicemail={MOCK_VOICEMAIL} />
          </div>
        ) : (
          /* Email / Slack / Social */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Subject */}
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e8e8f0', lineHeight: 1.3 }}>
              {message.subject || message.snippet}
            </h2>

            {/* Sender meta */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                {message.senderInitials}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#c8c8d8' }}>{message.sender}</div>
                <div style={{ fontSize: 11, color: '#555568' }}>to me · {message.timestamp}</div>
              </div>
              {/* Action buttons */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {['↩ Reply', '→ Forward', '⭐ Star'].map((label) => (
                  <button
                    key={label}
                    style={{
                      background: 'transparent',
                      border: '1px solid #1e1e28',
                      borderRadius: 6,
                      color: '#6e6e88',
                      fontSize: 11,
                      padding: '4px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div style={{
              fontSize: 13,
              color: '#b0b0c8',
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              borderTop: '1px solid #1a1a22',
              paddingTop: 16,
            }}>
              {message.body || message.snippet}
            </div>

            {/* Karoline annotation */}
            <div style={{
              background: '#1e1218',
              border: '1px solid #4d1f2d',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#3d1228',
                border: '1px solid #7d2040',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: '#e060a0',
                flexShrink: 0,
              }}>
                K
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#e060a0', marginBottom: 4 }}>
                  Karoline · Comms Agent
                </div>
                <div style={{ fontSize: 12, color: '#c090a0', lineHeight: 1.6 }}>
                  I've drafted a reply for your review. The tone is professional and concise.
                  Estimated reading time for recipient: 30 seconds.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    onClick={() => setShowDraftPanel(true)}
                    style={{
                      background: 'rgba(224,96,160,0.1)',
                      border: '1px solid rgba(224,96,160,0.3)',
                      borderRadius: 6,
                      color: '#e060a0',
                      fontSize: 11,
                      padding: '4px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    Review Draft
                  </button>
                  <button
                    onClick={() => setShowConfirm(true)}
                    style={{
                      background: 'rgba(194,112,58,0.1)',
                      border: '1px solid rgba(194,112,58,0.3)',
                      borderRadius: 6,
                      color: '#c2703a',
                      fontSize: 11,
                      padding: '4px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    Send Now
                  </button>
                </div>
              </div>
            </div>

            {/* Draft review panel popover */}
            {showDraftPanel && (
              <div style={{
                background: '#18181f',
                border: '1px solid #2a2a38',
                borderRadius: 10,
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#c8c8d8' }}>Draft Reply</span>
                  <button
                    onClick={() => setShowDraftPanel(false)}
                    style={{ background: 'none', border: 'none', color: '#555568', cursor: 'pointer', fontSize: 16 }}
                  >
                    ×
                  </button>
                </div>
                <textarea
                  style={{
                    background: '#0e0e12',
                    border: '1px solid #1e1e28',
                    borderRadius: 8,
                    color: '#c8c8d8',
                    fontSize: 12,
                    lineHeight: 1.7,
                    padding: '10px 14px',
                    resize: 'vertical',
                    minHeight: 120,
                    outline: 'none',
                  }}
                  defaultValue={`Hi Sarah,\n\nThanks for sharing the design review — the updates look great overall. The warmer accent palette is a nice evolution, and the reduced card density feels much cleaner.\n\nI'll share more detailed notes in the Figma comments by EOD.\n\nBest,\nChristian`}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowDraftPanel(false)}
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
                    onClick={() => { setShowDraftPanel(false); setShowConfirm(true); }}
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
                    Approve & Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agent Overlay Toolbar */}
      <AgentOverlayToolbar
        onReviewDraft={() => setShowDraftPanel(true)}
        onSend={() => setShowConfirm(true)}
      />

      {/* Confirm send modal */}
      <ConfirmSendModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={() => {}}
        recipient={message.sender}
        subject={message.subject}
        channel={CHANNEL_BADGE[message.channel].label}
      />
    </div>
  );
}
