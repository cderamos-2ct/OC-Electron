"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Loader2, MessageSquareMore, Send, Sparkles, X } from "lucide-react";
import { useShellCommandContext } from "@/components/ShellCommandContext";
import { useOpenClawChat, type ChatMessage } from "@/hooks/use-openclaw-chat";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import { useAgentOps } from "@/hooks/use-agent-ops";
import { useOpenClawSessions } from "@/hooks/use-openclaw-sessions";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import { buildCommandChatView } from "@/lib/command-chat-view";
import type { AgentTaskSummary, OpsTaskLike } from "@/lib/types";

export function ShellAssistantRail({
  mode,
  open,
  onClose,
}: {
  mode: "persistent" | "drawer";
  open: boolean;
  onClose: () => void;
}) {
  const { activeContext, effectiveContext, clearActiveContext } = useShellCommandContext();
  const [draft, setDraft] = useState("");
  const [disconnectedLong, setDisconnectedLong] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const { hello, isConnected: gwConnected } = useOpenClaw();
  const { managerAudit, loading: agentsLoading, error: agentsError } = useOpenClawAgents();
  const { visibility, loading: opsLoading, error: opsError, refresh } = useAgentOps();
  const { sessions } = useOpenClawSessions({
    limit: 50,
    includeDerivedTitles: true,
    includeLastMessage: true,
  });

  const latestWebchatCommandSessionKey = useMemo(() => {
    const candidates = sessions
      .filter((session) => {
        const key = session.key.toLowerCase();
        if (!key.startsWith("agent:main:")) return false;
        if (key.includes(":cron:") || key.includes(":subagent:")) return false;
        const surface = String(session.origin?.surface ?? session.channel ?? "").toLowerCase();
        return surface === "webchat" || key.includes("dashboard-chat");
      })
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));

    return candidates[0]?.key;
  }, [sessions]);

  const defaultMainSessionKey = hello?.snapshot?.sessionDefaults?.mainSessionKey?.trim();
  const visibilityTasks = useMemo<OpsTaskLike[]>(
    () =>
      (visibility?.tasks ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.ownerAgent,
        updatedAt: task.updatedAt,
      })),
    [visibility?.tasks],
  );

  // Always route chat through the stable "dashboard-chat" session.
  // The gateway resolves "dashboard-chat" → "agent:main:dashboard-chat".
  // Don't use discovered webchat sessions (agent:main:main, etc.) — they're
  // transient and cause session loss on refresh.
  const sessionKey = useMemo(() => {
    return defaultMainSessionKey || "dashboard-chat";
  }, [defaultMainSessionKey]);

  const targetLabel = "CD";

  const contextLabel = activeContext
    ? `${activeContext.title}`
    : effectiveContext?.title ?? "No pinned context";
  const showContextPanel = Boolean(
    effectiveContext &&
      (effectiveContext.taskId ||
        effectiveContext.agentId ||
        effectiveContext.kind !== "view"),
  );
  const commandChatView = useMemo(() => {
    return buildCommandChatView({
      sessions: visibility?.sessions ?? sessions,
      agents: visibility?.agents ?? [],
      tasks: visibilityTasks,
      activeSessionKey: sessionKey,
      commandSession: {
        key: latestWebchatCommandSessionKey || defaultMainSessionKey || "dashboard-chat",
        displayName: "Command",
        label: "Chief of Staff",
        agentId: "main",
      },
      needsChristianItems: visibility?.needsChristian ?? [],
      rollups: visibility?.rollups ?? [],
      taskState: visibility?.taskState ?? [],
    });
  }, [defaultMainSessionKey, latestWebchatCommandSessionKey, sessionKey, sessions, visibility?.agents, visibility?.needsChristian, visibility?.rollups, visibility?.sessions, visibility?.taskState, visibilityTasks]);
  const focusedNeed = useMemo(
    () =>
      commandChatView.needsChristian.find((item) => item.id === effectiveContext?.taskId || item.id === effectiveContext?.routeBackTo?.taskId) ??
      null,
    [commandChatView.needsChristian, effectiveContext?.routeBackTo?.taskId, effectiveContext?.taskId],
  );
  const focusedRollup = useMemo(
    () =>
      commandChatView.rollups.find((item) => item.id === effectiveContext?.id || item.taskId === effectiveContext?.taskId || item.taskId === effectiveContext?.routeBackTo?.taskId) ??
      null,
    [commandChatView.rollups, effectiveContext?.id, effectiveContext?.routeBackTo?.taskId, effectiveContext?.taskId],
  );
  const focusedCurrentTask = useMemo(() => {
    const current = commandChatView.taskState.find((bucket) => bucket.key === "current")?.tasks ?? [];
    return current.find((task) => task.id === effectiveContext?.taskId || task.id === effectiveContext?.routeBackTo?.taskId) ?? null;
  }, [commandChatView.taskState, effectiveContext?.routeBackTo?.taskId, effectiveContext?.taskId]);
  const needsReplyItems = useMemo(() => {
    if (focusedNeed) {
      return [focusedNeed];
    }
    return commandChatView.needsChristian.slice(0, 3);
  }, [commandChatView.needsChristian, focusedNeed]);
  const runningItems = useMemo(() => {
    const currentTasks = commandChatView.taskState.find((bucket) => bucket.key === "current")?.tasks ?? [];
    return currentTasks.slice(0, 3);
  }, [commandChatView.taskState]);
  const {
    messages,
    isStreaming,
    error: chatError,
    sendMessage,
    abort,
    loadHistory,
  } = useOpenClawChat({ sessionKey });

  // Load history when rail opens AND gateway is connected.
  // On refresh, the WS may not be ready when `open` first becomes true,
  // so we also re-trigger when gwConnected flips to true.
  // Debounce by 300ms to avoid racing a freshly-established WS connection.
  useEffect(() => {
    if (!open || !gwConnected) return;
    const timer = setTimeout(() => {
      void loadHistory({ force: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [loadHistory, open, sessionKey, gwConnected]);

  useEffect(() => {
    if (gwConnected) {
      setDisconnectedLong(false);
      return;
    }
    const timer = setTimeout(() => setDisconnectedLong(true), 10_000);
    return () => clearTimeout(timer);
  }, [gwConnected]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft(""); // Clear immediately — message already shown optimistically by chat hook
    // Prepend task context so the main agent knows what's being discussed
    const ctx = effectiveContext?.routeBackTo?.taskId ?? effectiveContext?.taskId;
    const contextualText = ctx ? `[Re: ${ctx}] ${text}` : text;
    try {
      await sendMessage(contextualText);
    } catch {
      // Timeout/error handled by chat hook's error state — don't block the UI
    }
  };

  const runningCount = managerAudit?.rosterSummary.busy ?? 0;
  const managedCount = visibility?.summary.agentCount ?? managerAudit?.rosterSummary.totalAgents ?? 0;
  const needsCount = visibility?.needsChristian.length ?? 0;
  // Suppress only low-level reconnection noise — show actionable chat errors
  const isReconnectNoise = chatError && /^Gateway disconnected|not connected|not initialized/i.test(chatError);
  const combinedError = (isReconnectNoise ? null : chatError) || agentsError || opsError;
  const visibleMessages = useMemo(() => messages.slice(-6), [messages]);
  const contextTaskId = effectiveContext?.routeBackTo?.taskId ?? effectiveContext?.taskId ?? null;
  const contextAgentId = effectiveContext?.agentId ?? focusedNeed?.ownerAgentId ?? focusedRollup?.agentId ?? focusedCurrentTask?.ownerAgent ?? null;
  const contextStatus = effectiveContext?.status ?? focusedNeed?.status ?? focusedCurrentTask?.status ?? null;
  const contextPriority = effectiveContext?.priority ?? focusedNeed?.priority ?? focusedRollup?.priority ?? focusedCurrentTask?.priority ?? null;
  const contextNextStep = effectiveContext?.nextStep ?? focusedNeed?.nextStep ?? focusedCurrentTask?.nextStep ?? null;
  const contextSummary = focusedNeed?.reason ?? focusedRollup?.summary ?? effectiveContext?.description ?? focusedCurrentTask?.latestActivity ?? null;
  const contextBlockedBy = focusedNeed?.blockedBy ?? focusedCurrentTask?.blockedBy ?? [];
  const contextSuggestedReplies = effectiveContext?.suggestedReplies?.length
    ? effectiveContext.suggestedReplies
    : focusedNeed?.suggestedReplies ?? focusedRollup?.suggestedReplies ?? [];

  const queueSuggestedReply = (_label: string, text: string) => {
    const prefix = buildRoutePrefix(effectiveContext?.routeBackTo);
    const next = [prefix, text].filter(Boolean).join(" ").trim();
    setDraft(next);
  };

  return (
    <>
      {mode === "drawer" && open ? (
        <div className="fixed inset-0 z-[60] bg-[rgba(3,7,10,0.72)] backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      ) : null}
      <aside
        className={[
          "shell-command-rail",
          mode === "persistent" ? "is-persistent" : "is-drawer",
          open ? "is-open" : "is-closed",
        ].join(" ")}
      >
        <div className="shell-command-header">
          <div className="min-w-0">
            <div className="shell-command-kicker">Chief of Staff</div>
            <div className="shell-command-title" style={{ marginTop: 0 }}>{targetLabel}</div>
            <div className="shell-command-copy">
              {showContextPanel ? `Pinned: ${contextLabel}` : "Global chat rail for routed work, questions, and follow-ups."}
            </div>
          </div>
          {mode === "drawer" ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border p-2"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              aria-label="Close command rail"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="shell-command-body">
          {combinedError ? (
            <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: "rgba(248,113,113,0.24)", background: "rgba(248,113,113,0.08)", color: "#fca5a5" }}>
              {combinedError}
            </div>
          ) : null}

          {showContextPanel ? (
            <section className="rounded-[20px] border px-3 py-3" style={{ borderColor: "rgba(255,122,26,0.2)", background: "rgba(255,122,26,0.07)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--primary)" }}>
                    Pinned work context
                  </div>
                  <div className="mt-1 text-sm font-semibold leading-6" style={{ color: "var(--text-primary)" }}>
                    {contextLabel}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {effectiveContext?.sourceLabel ? <span>{effectiveContext.sourceLabel}</span> : null}
                    {contextTaskId ? <span>{contextTaskId}</span> : null}
                    {contextAgentId ? <span>{contextAgentId}</span> : null}
                  </div>
                </div>
                {activeContext ? (
                  <button
                    type="button"
                    onClick={clearActiveContext}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/5"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <RailMetric label="Task" value={contextTaskId ?? "Context"} tone={contextTaskId ? "orange" : "slate"} />
                <RailMetric label="State" value={contextStatus ?? "Pinned"} tone={toneToRailMetric(contextStatus)} />
                <RailMetric label="Priority" value={contextPriority ?? (contextAgentId ? "Lane" : "View")} tone={contextPriority === "high" ? "orange" : "slate"} />
              </div>

              {contextSummary ? (
                <div className="mt-3 rounded-[16px] border px-3 py-2.5 text-sm leading-6" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)" }}>
                  {contextSummary}
                </div>
              ) : null}

              {contextNextStep ? (
                <div className="mt-3 rounded-[16px] border px-3 py-2.5" style={{ borderColor: "rgba(99,211,189,0.22)", background: "rgba(99,211,189,0.06)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#8de7d6" }}>
                    Next step
                  </div>
                  <div className="mt-1 text-sm leading-6" style={{ color: "var(--text-primary)" }}>
                    {contextNextStep}
                  </div>
                </div>
              ) : null}

              {contextBlockedBy.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {contextBlockedBy.slice(0, 3).map((item) => (
                    <span key={item} className="rounded-full border px-2 py-1 text-[11px]" style={{ borderColor: "rgba(251,191,36,0.28)", color: "#fbbf24" }}>
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}

              {contextSuggestedReplies.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {contextSuggestedReplies.slice(0, 3).map((reply) => (
                    <button
                      key={`${reply.label}:${reply.text}`}
                      type="button"
                      onClick={() => queueSuggestedReply(reply.label, reply.text)}
                      className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5"
                      style={{ borderColor: "rgba(255,255,255,0.1)", color: "var(--text-primary)" }}
                    >
                      {reply.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : (
            <section className="rounded-[20px] border px-3 py-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.03)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                No pinned context
              </div>
              <div className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                Pin a task or lane from the main workspace and CD will carry that exact context into chat.
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <RailMetric label="Managed" value={String(managedCount)} />
                <RailMetric label="Running" value={String(runningCount)} tone={runningCount ? "green" : "slate"} />
                <RailMetric label="Needs you" value={String(needsCount)} tone={needsCount ? "orange" : "slate"} />
              </div>
              <div className="mt-3 space-y-2">
                {needsReplyItems.length ? (
                  needsReplyItems.slice(0, 2).map((item) => (
                    <div key={item.id} className="rounded-[16px] border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                        {item.id} · {item.title}
                      </div>
                      <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                        {item.reason}
                      </div>
                    </div>
                  ))
                ) : (
                  runningItems.slice(0, 2).map((item) => (
                    <div key={item.id} className="rounded-[16px] border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
                        {item.id} · {item.title}
                      </div>
                      <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                        {item.status} · {item.priority}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
            Recent chat
          </div>
          <div ref={messagesRef} className="shell-command-messages" style={{ maxHeight: "none", flex: 1, minWidth: 0, overflow: "hidden auto" }}>
            {visibleMessages.length ? (
              visibleMessages.map((message) => <RailMessage key={message.id} message={message} />)
            ) : disconnectedLong ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium" style={{ borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.08)", color: "#fbbf24" }}>
                <span>⚠</span>
                <span>Reconnecting to gateway…</span>
              </div>
            ) : (
              <div className="py-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                No messages yet.
              </div>
            )}
            {isStreaming ? (
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for reply…
              </div>
            ) : null}
          </div>
        </div>

        <div className="shell-command-composer">
          <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            <Sparkles className="h-3.5 w-3.5" />
            <span>{targetLabel}</span>
          </div>
          <div className="rounded-[18px] border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.03)" }}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              rows={4}
              placeholder="Message CD with the current view or pinned object as context…"
              className="w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-[color:var(--text-muted)]"
              style={{ color: "var(--text-primary)" }}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {effectiveContext?.routeBackTo?.taskId ? `Replying about ${effectiveContext.routeBackTo.taskId}` : `Session: ${sessionKey}`}
              </div>
              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={() => void abort()}
                    className="rounded-full border px-3 py-2 text-sm font-medium"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    Stop
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!draft.trim() || !gwConnected}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "var(--primary)", color: "var(--text-on-primary)" }}
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function RailMetric({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "green" | "orange" | "slate";
}) {
  return (
    <div className="rounded-[16px] border px-3 py-2" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 text-base font-semibold" style={{ color: tone === "green" ? "#6ee7b7" : tone === "orange" ? "#fbbf24" : "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}

function toneToRailMetric(value?: string | null): "green" | "orange" | "slate" {
  const tone = String(value ?? "").trim().toLowerCase();
  if (["healthy", "active", "live", "done", "complete"].includes(tone)) return "green";
  if (["blocked", "failed", "error", "needs_now", "high"].includes(tone)) return "orange";
  return "slate";
}

function RailMessage({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const condensedContent = compactMessageContent(message.content);
  return (
    <div className="rounded-[18px] border px-3 py-3" style={{ borderColor: isUser ? "rgba(255,122,26,0.24)" : "var(--border)", background: isUser ? "rgba(255,122,26,0.10)" : "rgba(255,255,255,0.02)" }}>
      <div className="mb-1 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {isUser ? <MessageSquareMore className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        <span>{isUser ? "You via CD" : "CD / agent"}</span>
      </div>
      {condensedContent ? (
        isUser ? (
          <div className="whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--text-primary)" }}>
            {condensedContent}
          </div>
        ) : (
          <div className="prose prose-invert max-w-none text-sm leading-6 [&>*]:my-1 [&_p]:line-clamp-4 [&_ul]:my-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{condensedContent}</ReactMarkdown>
          </div>
        )
      ) : (
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Empty message payload.
        </div>
      )}
    </div>
  );
}

function compactMessageContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";
  const withoutEmptyPayload = trimmed
    .split("\n")
    .filter((line) => line.trim() !== "Empty message payload.")
    .join("\n")
    .trim();
  if (!withoutEmptyPayload) return "";
  if (withoutEmptyPayload.length <= 520) return withoutEmptyPayload;
  return `${withoutEmptyPayload.slice(0, 520).trimEnd()}…`;
}

function buildRoutePrefix(
  route:
    | {
        kind: "task" | "needs_christian" | "rollup";
        taskId: string;
        agentId?: string | null;
        sessionKey?: string | null;
      }
    | null
    | undefined,
) {
  if (!route?.taskId) return "";
  return `[Route task=${route.taskId}${route.agentId ? ` agent=${route.agentId}` : ""}${route.kind ? ` kind=${route.kind}` : ""}]`;
}
