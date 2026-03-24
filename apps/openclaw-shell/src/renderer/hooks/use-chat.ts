import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke, on } from '../lib/ipc-client';
import { createRendererLogger } from '../lib/logger';
import { enqueueAction } from '../../shared/offline-queue';
import { useGateway } from './use-gateway';
import type { ChatEvent } from '../../shared/types';

const log = createRendererLogger('use-chat');

export interface ChatMessage {
  id: string;
  role: 'user' | 'cd';
  content: string;
  timestamp: number;
  pending?: boolean;
  queued?: boolean;
}

// Session key for the main CD chat session
const MAIN_SESSION_KEY = 'main';

function extractMessageText(message: unknown): string {
  if (typeof message === 'string') return message;
  if (!message || typeof message !== 'object') return '';

  const record = message as Record<string, unknown>;
  const content = record.content;

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== 'object') return '';
        const obj = part as Record<string, unknown>;
        return obj.type === 'text' && typeof obj.text === 'string' ? obj.text : '';
      })
      .filter(Boolean)
      .join('');
  }

  return '';
}

function formatHistoryItem(item: unknown): ChatMessage | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  const role = obj.role === 'user' ? 'user' : 'cd';
  const content = extractMessageText(obj);
  const ts = typeof obj.timestamp === 'number' ? obj.timestamp : Date.now();
  const id = typeof obj.id === 'string' ? obj.id : `hist-${ts}-${Math.random()}`;
  return { id, role, content, timestamp: ts };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track in-progress streaming message by runId
  const streamingRunId = useRef<string | null>(null);
  const { isConnected } = useGateway();

  // Load history on mount
  useEffect(() => {
    let cancelled = false;
    invoke('gateway:rpc', 'chat.history', { sessionKey: MAIN_SESSION_KEY, limit: 50 })
      .then((result) => {
        if (cancelled) return;
        const history =
          result && typeof result === 'object' && Array.isArray((result as { messages?: unknown[] }).messages)
            ? (result as { messages: unknown[] }).messages
            : Array.isArray(result)
            ? result
            : [];
        const parsed = history.map(formatHistoryItem).filter(Boolean) as ChatMessage[];
        setMessages(parsed);
      })
      .catch((err) => {
        if (cancelled) return;
        log.warn('Failed to load history:', err);
        // Non-fatal — start with empty messages
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for incoming gateway chat events (CD responses)
  useEffect(() => {
    const handler = (raw: unknown) => {
      const evt = raw as { event?: string; payload?: unknown };
      if (evt.event !== 'chat') return;
      const chatEvent = evt.payload as ChatEvent;
      if (!chatEvent) return;

      const { runId, state, message } = chatEvent;

      if (state === 'delta') {
        const delta = extractMessageText(message);

        if (streamingRunId.current !== runId) {
          // New streaming message from CD
          streamingRunId.current = runId;
          setLoading(false);
        }

        setMessages((prev) => {
          if (prev.some((m) => m.id === `run-${runId}`)) {
            // Append to existing streaming message
            return prev.map((m) =>
              m.id === `run-${runId}` ? { ...m, content: m.content + delta } : m,
            );
          }
          // First delta — create the message
          const newMsg: ChatMessage = {
            id: `run-${runId}`,
            role: 'cd',
            content: delta,
            timestamp: Date.now(),
          };
          return [...prev, newMsg];
        });
      } else if (state === 'final') {
        streamingRunId.current = null;
        setLoading(false);
        const finalContent = extractMessageText(message);
        if (finalContent !== null) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === `run-${runId}` ? { ...m, content: finalContent, pending: false } : m,
            ),
          );
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === `run-${runId}` ? { ...m, pending: false } : m)),
          );
        }
      } else if (state === 'error' || state === 'aborted') {
        streamingRunId.current = null;
        setLoading(false);
        if (state === 'error') {
          setError(chatEvent.errorMessage ?? 'CD response error');
        }
      }
    };

    const unsub = on('gateway:event', handler);
    return () => {
      unsub();
    };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const optimisticId = `user-${Date.now()}-${Math.random()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setError(null);

    // When disconnected, enqueue the message for replay on reconnect
    if (!isConnected) {
      enqueueAction('chat.send', {
        sessionKey: MAIN_SESSION_KEY,
        idempotencyKey: crypto.randomUUID(),
        message: text.trim(),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, queued: true } : m)),
      );
      return;
    }

    setLoading(true);

    try {
      await invoke('gateway:rpc', 'chat.send', {
        sessionKey: MAIN_SESSION_KEY,
        idempotencyKey: crypto.randomUUID(),
        message: text.trim(),
      });
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [isConnected]);

  return { messages, loading, error, sendMessage };
}
