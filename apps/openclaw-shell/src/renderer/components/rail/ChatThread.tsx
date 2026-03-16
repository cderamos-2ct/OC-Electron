import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../hooks/use-chat';

// ─── Relative timestamp ───────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Simple markdown renderer (Phase 1) ──────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  return text.split('\n').map((line, i) => (
    <React.Fragment key={i}>
      {line}
      {i < text.split('\n').length - 1 && <br />}
    </React.Fragment>
  ));
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: '2px',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 10px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          backgroundColor: isUser ? '#2563eb' : '#27272a',
          color: isUser ? '#fff' : '#f4f4f5',
          fontSize: '13px',
          lineHeight: '1.5',
          wordBreak: 'break-word',
          opacity: message.pending ? 0.7 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {renderMarkdown(message.content)}
      </div>
      <span
        style={{
          fontSize: '10px',
          color: '#71717a',
          paddingLeft: isUser ? 0 : '4px',
          paddingRight: isUser ? '4px' : 0,
        }}
      >
        {relativeTime(message.timestamp)}
      </span>
    </div>
  );
}

// ─── Loading indicator ────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '4px',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderRadius: '12px 12px 12px 2px',
          backgroundColor: '#27272a',
          display: 'flex',
          gap: '4px',
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#71717a',
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

// ─── ChatThread ───────────────────────────────────────────────────────────────

interface ChatThreadProps {
  messages: ChatMessage[];
  loading: boolean;
}

export function ChatThread({ messages, loading }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {messages.length === 0 && !loading && (
        <div
          style={{
            color: '#71717a',
            fontSize: '12px',
            textAlign: 'center',
            padding: '24px 12px',
            lineHeight: '1.6',
          }}
        >
          Start a conversation with CD.
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {loading && <TypingIndicator />}

      <div ref={bottomRef} />
    </div>
  );
}
