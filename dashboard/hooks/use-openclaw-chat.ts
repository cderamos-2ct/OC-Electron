"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import type { ChatEvent, ChatSendParams, LoopbackEvent } from "@/lib/types";

export type ChatMessageRole = "user" | "assistant";
export type ChatMessageProvenance = "default" | "proactive";

export type ChatMessagePart =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool-call"; name: string; args?: string }
  | { type: "tool-result"; name: string; text?: string };

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  parts: ChatMessagePart[];
  timestamp: number;
  state?: "delta" | "final" | "aborted" | "error";
  runId?: string;
  provenance?: ChatMessageProvenance;
  provider?: string;
  model?: string;
  api?: string;
}

interface UseOpenClawChatOptions {
  sessionKey?: string;
}

type OutboundAttachment = {
  name: string;
  content: string;
  encoding?: "utf8" | "base64";
  mimeType?: string;
};

const DEFAULT_SESSION_KEY = "dashboard-chat";

export function useOpenClawChat(options: UseOpenClawChatOptions = {}) {
  const { rpc, subscribe, isConnected } = useOpenClaw();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const historyLoadedForSessionRef = useRef<string | null>(null);
  const [sessionKey, setSessionKey] = useState(() => {
    return normalizeSessionKey(options.sessionKey);
  });

  useEffect(() => {
    const nextSessionKey = normalizeSessionKey(options.sessionKey);
    setSessionKey((current) => {
      return current === nextSessionKey ? current : nextSessionKey;
    });
  }, [options.sessionKey]);

  useEffect(() => {
    currentRunIdRef.current = null;
    historyLoadedForSessionRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    setError(null);
  }, [sessionKey]);

  // Subscribe to chat events for streaming
  // Gateway prefixes sessionKey with "agent:<agentId>:" so we match by suffix
  useEffect(() => {
    if (!isConnected) return;

    return subscribe("chat", (event: ChatEvent) => {
      // Gateway resolves "foo" -> "agent:main:foo", so match by suffix
      if (!event.sessionKey?.endsWith(sessionKey)) return;

      if (event.state === "delta") {
        setIsStreaming(true);
        currentRunIdRef.current = event.runId;

        // Chat delta events contain the FULL accumulated text, so REPLACE not append
        const normalized = normalizeMessage(event.message);

        setMessages((prev) => {
          const existing = prev.find(
            (m) => m.runId === event.runId && m.role === "assistant"
          );
          if (existing) {
            return prev.map((m) =>
              m.runId === event.runId && m.role === "assistant"
                ? {
                    ...m,
                    content: normalized.text,
                    parts: normalized.parts,
                    state: "delta" as const,
                  }
                : m
            );
          }
          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              content: normalized.text,
              parts: normalized.parts,
              timestamp: Date.now(),
              state: "delta" as const,
              runId: event.runId,
            },
          ];
        });
      } else if (event.state === "final") {
        // Final event also carries the complete message
        const normalized = normalizeMessage(event.message);
        const isProactiveInject = isInjectedRunId(event.runId);
        setMessages((prev) => {
          const existing = prev.find(
            (m) => m.runId === event.runId && m.role === "assistant"
          );
          if (existing) {
            return prev.map((m) =>
              m.runId === event.runId && m.role === "assistant"
                ? {
                    ...m,
                    content: normalized.text || m.content,
                    parts: normalized.parts.length > 0 ? normalized.parts : m.parts,
                    state: "final" as const,
                    provenance: isProactiveInject ? "proactive" : m.provenance,
                    provider: isProactiveInject ? "openclaw" : m.provider,
                    model: isProactiveInject ? "gateway-injected" : m.model,
                  }
                : m
            );
          }

          return [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              content: normalized.text,
              parts: normalized.parts,
              timestamp: Date.now(),
              state: "final" as const,
              runId: event.runId,
              provenance: isProactiveInject ? "proactive" : "default",
              provider: isProactiveInject ? "openclaw" : undefined,
              model: isProactiveInject ? "gateway-injected" : undefined,
            },
          ];
        });
        if (currentRunIdRef.current === event.runId) {
          setIsStreaming(false);
          currentRunIdRef.current = null;
        }
      } else if (event.state === "aborted" || event.state === "error") {
        if (currentRunIdRef.current === event.runId) {
          setIsStreaming(false);
          currentRunIdRef.current = null;
        }
        if (event.errorMessage) setError(event.errorMessage);
        setMessages((prev) =>
          prev.map((m) =>
            m.runId === event.runId && m.role === "assistant"
              ? { ...m, state: event.state }
              : m
          )
        );
      }
    });
  }, [isConnected, sessionKey, subscribe]);

  useEffect(() => {
    if (!isConnected) return;

    return subscribe("loopback", (event: LoopbackEvent) => {
      if (!event.sessionKey?.endsWith(sessionKey)) return;

      const normalized = normalizeMessage(event.message);
      if (!normalized.text && normalized.parts.length === 0) return;

      setMessages((prev) => {
        const nextRunId = event.runId || `loopback:${sessionKey}`;
        const existing = prev.find(
          (m) => m.runId === nextRunId && m.role === "assistant"
        );
        if (existing) {
          return prev.map((m) =>
            m.runId === nextRunId && m.role === "assistant"
              ? {
                  ...m,
                  content: normalized.text,
                  parts: normalized.parts,
                  state: "final" as const,
                  timestamp: Date.now(),
                  provenance: "proactive" as const,
                  provider: "openclaw",
                  model: "gateway-injected",
                }
              : m
          );
        }

        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: normalized.text,
            parts: normalized.parts,
            timestamp: Date.now(),
            state: "final" as const,
            runId: nextRunId,
            provenance: "proactive" as const,
            provider: "openclaw",
            model: "gateway-injected",
          },
        ];
      });
    });
  }, [isConnected, sessionKey, subscribe]);

  // Send a message
  const sendMessage = useCallback(
    async (text: string, attachments?: OutboundAttachment[]) => {
      if (!text.trim() && (!attachments || attachments.length === 0)) return;

      setError(null);

      // Add user message
      const attachmentSummary =
        attachments && attachments.length > 0
          ? attachments
              .map((attachment) => `[Attached ${attachment.mimeType?.startsWith("image/") ? "image" : "file"}: ${attachment.name}]`)
              .join("\n")
          : "";
      const renderedText = [attachmentSummary, text].filter(Boolean).join("\n\n").trim();
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: renderedText,
        parts: renderedText ? [{ type: "text", text: renderedText }] : [],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        await rpc("chat.send", {
          sessionKey,
          message: text,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
          timeoutMs: 120_000,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        // Classify the error for the UI — prefix with ⚠ so the rail never suppresses send failures
        if (/timeout/i.test(raw)) {
          setError("⚠ Agent didn't respond in time — the model provider may be slow or unreachable.");
        } else if (/not connected|not initialized/i.test(raw)) {
          setError("⚠ Message not sent — gateway is reconnecting. Try again in a moment.");
        } else {
          setError(`⚠ ${raw}`);
        }
      }
    },
    [rpc, sessionKey]
  );

  // Abort current stream
  const abort = useCallback(async () => {
    if (!currentRunIdRef.current) return;
    try {
      await rpc("chat.abort", {
        sessionKey,
        runId: currentRunIdRef.current,
      });
    } catch (err) {
      console.warn("[openclaw-chat]", err);
    }
    setIsStreaming(false);
  }, [rpc, sessionKey]);

  // Load history
  const loadHistory = useCallback(async (options: { force?: boolean } = {}) => {
    if (!options.force && historyLoadedForSessionRef.current === sessionKey) {
      return;
    }

    const doFetch = async () => {
      const result = await rpc("chat.history", {
        sessionKey,
        limit: 50,
      }) as any;
      // Response: { sessionKey, sessionId, messages: [...], thinkingLevel }
      const history = result?.messages ?? (Array.isArray(result) ? result : []);
      if (Array.isArray(history) && history.length > 0) {
        const mapped = normalizeHistoryMessages(history);
        setMessages((prev) => {
          if (!options.force && prev.length > 0) {
            return prev;
          }
          return mapped;
        });
      }
      historyLoadedForSessionRef.current = sessionKey;
    };

    try {
      await doFetch();
    } catch (err) {
      console.warn("[openclaw-chat] loadHistory failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (/not connected|not initialized/i.test(msg)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          await doFetch();
        } catch (retryErr) {
          console.warn("[openclaw-chat] loadHistory retry failed:", retryErr);
        }
      }
    }
  }, [rpc, sessionKey]);

  return {
    sessionKey,
    messages,
    isStreaming,
    error,
    sendMessage,
    abort,
    loadHistory,
    setSessionKey,
  };
}

function normalizeSessionKey(value?: string) {
  const next = value?.trim();
  return next || DEFAULT_SESSION_KEY;
}

function normalizeHistoryMessages(history: any[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let pendingAssistant: ChatMessage | null = null;

  const flushAssistant = () => {
    if (!pendingAssistant) {
      return;
    }

    pendingAssistant.parts = mergeAdjacentTextParts(pendingAssistant.parts);
    pendingAssistant.content = pendingAssistant.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n")
      .trim();
    messages.push(pendingAssistant);
    pendingAssistant = null;
  };

  for (const entry of history) {
    const rawRole = typeof entry?.role === "string" ? entry.role.toLowerCase() : "assistant";
    const isProactive = isGatewayInjectedAuditEntry(entry);
    const isUser = rawRole === "user" && !isProactive;

    if (isUser) {
      flushAssistant();
      const normalized = normalizeMessage(entry);
      messages.push({
        id: entry?.id ?? crypto.randomUUID(),
        role: "user",
        content: normalized.text,
        parts: normalized.parts,
        timestamp: entry?.timestamp ?? Date.now(),
        state: "final",
        runId: entry?.runId,
        provider: typeof entry?.provider === "string" ? entry.provider : undefined,
        model: typeof entry?.model === "string" ? entry.model : undefined,
        api: typeof entry?.api === "string" ? entry.api : undefined,
      });
      continue;
    }

    const normalized = normalizeHistoryAssistantEntry(entry);
    const canAppendToPending =
      Boolean(pendingAssistant) &&
      (rawRole === "toolresult" ||
        rawRole === "tool_result" ||
        (typeof entry?.runId === "string" &&
          entry.runId.length > 0 &&
          entry.runId === pendingAssistant?.runId));

    if (!pendingAssistant) {
      pendingAssistant = {
        id: entry?.id ?? crypto.randomUUID(),
        role: "assistant",
        content: normalized.text,
        parts: normalized.parts,
        timestamp: entry?.timestamp ?? Date.now(),
        state: "final",
        runId: entry?.runId,
        provenance: isProactive ? "proactive" : "default",
        provider: typeof entry?.provider === "string" ? entry.provider : undefined,
        model: typeof entry?.model === "string" ? entry.model : undefined,
        api: typeof entry?.api === "string" ? entry.api : undefined,
      };
      continue;
    }

    if (canAppendToPending) {
      pendingAssistant.parts.push(...normalized.parts);
      pendingAssistant.timestamp = entry?.timestamp ?? pendingAssistant.timestamp;
      pendingAssistant.runId = entry?.runId ?? pendingAssistant.runId;
      if (isProactive) {
        pendingAssistant.provenance = "proactive";
      }
      pendingAssistant.provider =
        typeof entry?.provider === "string" ? entry.provider : pendingAssistant.provider;
      pendingAssistant.model = typeof entry?.model === "string" ? entry.model : pendingAssistant.model;
      pendingAssistant.api = typeof entry?.api === "string" ? entry.api : pendingAssistant.api;
      continue;
    }

    flushAssistant();
    pendingAssistant = {
      id: entry?.id ?? crypto.randomUUID(),
      role: "assistant",
      content: normalized.text,
      parts: normalized.parts,
      timestamp: entry?.timestamp ?? Date.now(),
      state: "final",
      runId: entry?.runId,
      provenance: isProactive ? "proactive" : "default",
      provider: typeof entry?.provider === "string" ? entry.provider : undefined,
      model: typeof entry?.model === "string" ? entry.model : undefined,
      api: typeof entry?.api === "string" ? entry.api : undefined,
    };
  }

  flushAssistant();
  return messages;
}

function normalizeHistoryAssistantEntry(message: any): { text: string; parts: ChatMessagePart[] } {
  const rawRole = typeof message?.role === "string" ? message.role.toLowerCase() : "";

  if (rawRole === "toolresult" || rawRole === "tool_result") {
    return {
      text: "",
      parts: [
        {
          type: "tool-result",
          name: message?.toolName ?? message?.tool_name ?? "tool",
          text: extractInlineText(message) || undefined,
        },
      ],
    };
  }

  return normalizeMessage(message);
}

function isGatewayInjectedAuditEntry(message: any): boolean {
  return (
    typeof message?.provider === "string" &&
    message.provider === "openclaw" &&
    typeof message?.model === "string" &&
    message.model === "gateway-injected"
  );
}

function isInjectedRunId(runId?: string): boolean {
  return typeof runId === "string" && runId.startsWith("inject-");
}

function normalizeMessage(message: unknown): { text: string; parts: ChatMessagePart[] } {
  const parts = extractParts(message);
  return {
    text: parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n")
      .trim(),
    parts,
  };
}

function extractParts(message: unknown): ChatMessagePart[] {
  if (typeof message === "string") {
    return extractPartsFromText(message);
  }

  if (!message || typeof message !== "object") {
    return [];
  }

  const nextParts: ChatMessagePart[] = [];
  const value = message as any;

  if (Array.isArray(value.content)) {
    for (const item of value.content) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const type = typeof item.type === "string" ? item.type.toLowerCase() : "text";

      if (type === "thinking" && typeof item.thinking === "string") {
        pushThinkingPart(nextParts, item.thinking);
        continue;
      }

      if (
        ["toolcall", "tool_call", "tooluse", "tool_use"].includes(type) ||
        (typeof item.name === "string" && (item.arguments != null || item.args != null))
      ) {
        nextParts.push({
          type: "tool-call",
          name: item.name ?? "tool",
          args: stringifyToolArgs(item.arguments ?? item.args),
        });
        continue;
      }

      if (["toolresult", "tool_result"].includes(type)) {
        nextParts.push({
          type: "tool-result",
          name: item.name ?? "tool",
          text: extractInlineText(item),
        });
        continue;
      }

      if (typeof item.text === "string") {
        nextParts.push(...extractPartsFromText(item.text));
      }
    }
  }

  if (nextParts.length === 0) {
    if (typeof value.content === "string") {
      nextParts.push(...extractPartsFromText(value.content));
    } else if (typeof value.text === "string") {
      nextParts.push(...extractPartsFromText(value.text));
    } else if (typeof value.delta === "string") {
      nextParts.push(...extractPartsFromText(value.delta));
    }
  }

  const normalizedRole = typeof value.role === "string" ? value.role.toLowerCase() : "";
  if (
    (normalizedRole === "toolresult" || normalizedRole === "tool_result") &&
    !nextParts.some((part) => part.type === "tool-result")
  ) {
    nextParts.push({
      type: "tool-result",
      name: value.toolName ?? value.tool_name ?? "tool",
      text: extractInlineText(value) || undefined,
    });
  }

  return mergeAdjacentTextParts(nextParts);
}

function extractPartsFromText(text: string): ChatMessagePart[] {
  const nextParts: ChatMessagePart[] = [];
  const thinkingMatches = [...text.matchAll(/<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);

  for (const thinking of thinkingMatches) {
    pushThinkingPart(nextParts, thinking);
  }

  const visibleText = text
    .replace(/<\s*think(?:ing)?\s*>[\s\S]*?<\s*\/\s*think(?:ing)?\s*>/gi, "")
    .trim();

  if (visibleText) {
    nextParts.push({ type: "text", text: visibleText });
  }

  return nextParts;
}

function pushThinkingPart(parts: ChatMessagePart[], text: string) {
  const normalized = text.trim();
  if (!normalized) {
    return;
  }

  parts.push({ type: "thinking", text: normalized });
}

function extractInlineText(value: any): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  if (typeof value.text === "string") {
    return value.text.trim();
  }

  if (typeof value.content === "string") {
    return value.content.trim();
  }

  if (Array.isArray(value.content)) {
    return value.content
      .map((item: any) => {
        if (!item || typeof item !== "object") {
          return "";
        }

        if (typeof item.text === "string") {
          return item.text;
        }

        if (typeof item.content === "string") {
          return item.content;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function stringifyToolArgs(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    console.warn("[openclaw-chat]", err);
    return String(value);
  }
}

function mergeAdjacentTextParts(parts: ChatMessagePart[]): ChatMessagePart[] {
  return parts.reduce<ChatMessagePart[]>((acc, part) => {
    const previous = acc.at(-1);
    if (part.type === "text" && previous?.type === "text") {
      previous.text = `${previous.text}\n\n${part.text}`.trim();
      return acc;
    }

    if (part.type === "thinking" && previous?.type === "thinking") {
      previous.text = `${previous.text}\n${part.text}`.trim();
      return acc;
    }

    acc.push(part);
    return acc;
  }, []);
}
