import { useState, useEffect, useRef } from 'react';
import type { MobileGatewayClient } from '../lib/mobile-gateway';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

interface CDChatProps {
  gateway: MobileGatewayClient;
}

export function CDChat({ gateway }: CDChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Subscribe to gateway chat events to receive actual responses
  useEffect(() => {
    const unsub = gateway.on('chat', (payload) => {
      const chatEvent = payload as { runId: string; state: string; message?: { content?: string }; errorMessage?: string };
      if (!chatEvent) return;
      const { runId, state, message } = chatEvent;
      const content = typeof message?.content === 'string' ? message.content : '';

      if (state === 'delta') {
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === runId);
          if (existing) {
            return prev.map((m) =>
              m.id === runId ? { ...m, text: (m.text === '...' ? '' : m.text) + content } : m,
            );
          }
          return prev;
        });
      } else if (state === 'final') {
        if (content) {
          setMessages((prev) =>
            prev.map((m) => (m.id === runId ? { ...m, text: content } : m)),
          );
        }
      } else if (state === 'error') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === runId ? { ...m, text: `Error: ${chatEvent.errorMessage ?? 'unknown error'}` } : m,
          ),
        );
      }
    });
    return unsub;
  }, [gateway]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !gateway.isConnected) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const result = await gateway.request<{ runId: string }>('chat.send', {
        message: { role: 'user', content: text },
        timeoutMs: 120_000,
      });
      // Optimistic: show a placeholder until the event arrives
      const assistantMsg: Message = {
        id: result.runId,
        role: 'assistant',
        text: '...',
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: `Error: ${err instanceof Error ? err.message : 'send failed'}`,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Message list */}
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#52525b', padding: '48px 0', fontSize: '15px' }}>
            Chat with CD
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        borderTop: '1px solid #3f3f46',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
        background: '#18181b',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={gateway.isConnected ? 'Message...' : 'Connecting...'}
          disabled={!gateway.isConnected || sending}
          rows={1}
          style={{
            flex: 1,
            minHeight: '44px',
            maxHeight: '120px',
            resize: 'none',
            background: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: '12px',
            padding: '10px 14px',
            color: '#f4f4f5',
            fontSize: '15px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || sending || !gateway.isConnected}
          style={{
            minWidth: '44px',
            minHeight: '44px',
            background: input.trim() && gateway.isConnected ? '#2563eb' : '#3f3f46',
            border: 'none',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {sending ? '...' : '^'}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '80%',
        background: isUser ? '#2563eb' : '#27272a',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '10px 14px',
        fontSize: '15px',
        color: '#f4f4f5',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.text}
      </div>
    </div>
  );
}
