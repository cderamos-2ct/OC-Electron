"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useOpenClawChat, type ChatMessage } from "@/hooks/use-openclaw-chat";
import { useOpenClawSessions } from "@/hooks/use-openclaw-sessions";
import { useOpenClawAgents } from "@/hooks/use-openclaw-agents";
import { useAgentOps } from "@/hooks/use-agent-ops";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import { useHeaderActions } from "@/components/HeaderActionsContext";
import {
  VOICE_CHAT_EVENT,
  VOICE_PENDING_MESSAGE_KEY,
  readVoiceAutoSend,
  readSessionTalkMode,
  readSessionVoiceAutoSpeak,
  speakWithBrowserAsync,
  stopBrowserSpeech,
  writeSessionTalkMode,
  writeSessionVoiceAutoSpeak,
} from "@/lib/voice-chat";
import { CoordinationFeedCard } from "@/components/CoordinationFeedCard";
import type {
  AgentRosterCard,
  CommandRollupCard,
  InterAgentCommunication,
  InterAgentCommunicationSummary,
  SessionSummary,
  TaskStateBucket,
} from "@/lib/types";
import { buildAgentRosterCards, buildCommandChatView } from "@/lib/command-chat-view";
import { AgentRosterCardView } from "@/components/AgentRosterCardView";
import {
  AlertCircle,
  Archive,
  Bot,
  ChevronDown,
  ChevronUp,
  Columns3,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  Type,
  User,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { AgentTaskSummary, OpsTaskLike } from "@/lib/types";

const DEFAULT_CHAT_SESSION_KEY = "dashboard-chat";
const MOBILE_SESSION_STORAGE_KEY = "openclaw.chat.last-session";
const CHAT_DRAFT_STORAGE_PREFIX = "openclaw.chat.draft.";
const CHAT_TEXT_SCALE_STORAGE_KEY = "openclaw.chat.text-scale";
const CHAT_MEASURE_STORAGE_KEY = "openclaw.chat.measure";

type ChatTextScale = "compact" | "comfortable";
type ChatMeasure = "narrow" | "wide";
type RailModal = "rollups" | "needs" | "agents" | null;

function isHiddenUtilitySession(session: SessionSummary) {
  if ((session.agentId || "").toLowerCase() === "heartbeat") {
    return true;
  }
  const fields = [
    session.key,
    session.displayName,
    session.label,
    session.origin?.label,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  return fields.some((value) => value === "heartbeat" || value.endsWith(":heartbeat"));
}

function isSubagentSession(session: SessionSummary) {
  return session.key.toLowerCase().includes(":subagent:");
}

function readStoredChatTextScale() {
  if (typeof window === "undefined") return "compact" as ChatTextScale;
  const value = window.localStorage.getItem(CHAT_TEXT_SCALE_STORAGE_KEY);
  return value === "comfortable" ? "comfortable" : "compact";
}

function readStoredChatMeasure() {
  if (typeof window === "undefined") return "narrow" as ChatMeasure;
  const value = window.localStorage.getItem(CHAT_MEASURE_STORAGE_KEY);
  return value === "wide" ? "wide" : "narrow";
}

function sessionTypeLabel(session: SessionSummary) {
  const key = session.key.toLowerCase();
  const labels = [
    session.displayName,
    session.label,
    session.origin?.label,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  if (key.includes(":subagent:")) return "Subagent";
  if (labels.some((value) => value.includes("review")) || key.includes("review")) return "Review";
  if (labels.some((value) => value === "heartbeat") || key === "heartbeat" || key.endsWith(":heartbeat")) return "Utility";
  if (key === "main" || key.endsWith(":main")) return "Main";
  return "Working";
}

type PendingAttachment = {
  name: string;
  content: string;
  mimeType?: string;
  previewUrl?: string | null;
  isImage?: boolean;
};

export default function OpenClawChatPage() {
  return (
    <Suspense fallback={<ChatPageContent requestedSessionKey={undefined} />}>
      <ChatPageWithSearchParams />
    </Suspense>
  );
}

function ChatPageWithSearchParams() {
  const searchParams = useSearchParams();
  return <ChatPageContent requestedSessionKey={searchParams.get("session")?.trim()} />;
}

function ChatPageContent({
  requestedSessionKey,
}: {
  requestedSessionKey?: string;
}) {
  const router = useRouter();
  const setHeaderActions = useHeaderActions();
  const { isConnected, hello, rpc, state: gatewayState } = useOpenClaw();
  const { sessions, loading: sessionsLoading, error: sessionsError, refresh, deleteSession, resetSession, compactSession } =
    useOpenClawSessions();
  const { agents, visibility: agentVisibility } = useOpenClawAgents();
  const { tasks, visibility: opsVisibility } = useAgentOps();
  const serverVisibility = opsVisibility ?? agentVisibility;
  const visibilityAgents = serverVisibility?.agents ?? agents;
  const visibilitySessions = serverVisibility?.sessions ?? sessions;
  const visibilityRosterCards = serverVisibility?.rosterCards ?? null;
  const visibilityNeedsChristian = serverVisibility?.needsChristian ?? null;
  const visibilityRollups = serverVisibility?.rollups ?? null;
  const visibilityTaskState = serverVisibility?.taskState ?? null;
  const visibilityCommunications = serverVisibility?.communications ?? [];
  const visibilityCommunicationSummary: InterAgentCommunicationSummary | null = serverVisibility?.communicationSummary ?? null;
  const visibilityTasks = useMemo<OpsTaskLike[]>(
    () =>
      (serverVisibility?.tasks ?? []).map((task: AgentTaskSummary) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.ownerAgent,
        updatedAt: task.updatedAt,
      })),
    [serverVisibility],
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<PendingAttachment | null>(null);
  const [sessionSpeakReplies, setSessionSpeakReplies] = useState(false);
  const [sessionTalkMode, setSessionTalkMode] = useState(false);
  const [lastAssistantSpokenText, setLastAssistantSpokenText] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 767 : false,
  );
  const [isTablet, setIsTablet] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > 767 && window.innerWidth <= 1180 : false,
  );
  const [mobileSessionPickerOpen, setMobileSessionPickerOpen] = useState(false);
  const [railModal, setRailModal] = useState<RailModal>(null);
  const [chatTextScale, setChatTextScale] = useState<ChatTextScale>(readStoredChatTextScale);
  const [chatMeasure, setChatMeasure] = useState<ChatMeasure>(readStoredChatMeasure);
  const defaultSessionKey = hello?.snapshot?.sessionDefaults?.mainSessionKey;
  const [preferredSessionKey, setPreferredSessionKey] = useState(() => {
    if (typeof window === "undefined") {
      return requestedSessionKey || DEFAULT_CHAT_SESSION_KEY;
    }

    return (
      requestedSessionKey ||
      window.sessionStorage.getItem(MOBILE_SESSION_STORAGE_KEY)?.trim() ||
      DEFAULT_CHAT_SESSION_KEY
    );
  });
  const sessionKey = requestedSessionKey || preferredSessionKey || defaultSessionKey || DEFAULT_CHAT_SESSION_KEY;
  const {
    sessionKey: activeSessionKey,
    messages,
    isStreaming,
    error,
    sendMessage,
    abort,
    loadHistory,
  } = useOpenClawChat({ sessionKey });
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const speakAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenAssistantKeyRef = useRef<string | null>(null);
  const mountedAtRef = useRef(Date.now());
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [activeSpeechMessageKey, setActiveSpeechMessageKey] = useState<string | null>(null);
  const [speechPaused, setSpeechPaused] = useState(false);
  const voiceBaseInputRef = useRef("");
  const workingSessionKey = requestedSessionKey || preferredSessionKey || DEFAULT_CHAT_SESSION_KEY;
  const {
    isListening: isVoiceListening,
    finalTranscript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error: voiceError,
  } = useSpeechToText({
    continuous: true,
    interimResults: true,
  });

  const syntheticMainSession = useMemo<SessionSummary>(() => {
    return {
      key: workingSessionKey,
      kind: "direct",
      displayName: "CD Main",
      channel: "webchat",
      agentId: "main",
      label: "main",
      updatedAt: Date.now(),
      totalTokens: undefined,
      origin: {
        label: "Chief of Staff",
        provider: "dashboard",
        surface: "webchat",
        chatType: "direct",
      },
    };
  }, [workingSessionKey]);

  const visibleSessions = useMemo(
    () => visibilitySessions.filter((session) => !isHiddenUtilitySession(session)),
    [visibilitySessions],
  );

  const commandChatView = useMemo(
    () =>
      buildCommandChatView({
        sessions: visibleSessions,
        agents: visibilityAgents,
        tasks: visibilityTasks.length ? visibilityTasks : tasks,
        activeSessionKey,
        commandSession: syntheticMainSession,
        needsChristianItems: visibilityNeedsChristian ?? undefined,
        rollups: visibilityRollups ?? undefined,
        taskState: visibilityTaskState ?? undefined,
      }),
    [activeSessionKey, syntheticMainSession, tasks, visibilityAgents, visibilityNeedsChristian, visibilityRollups, visibilityTaskState, visibilityTasks, visibleSessions],
  );

  const rosterCards = useMemo<AgentRosterCard[]>(() => {
    const baseCards =
      visibilityRosterCards ??
      buildAgentRosterCards({
        agents: visibilityAgents,
        tasks: visibilityTasks.length ? visibilityTasks : tasks,
        sessions: visibleSessions,
      });
    const needle = sessionSearch.trim().toLowerCase();
    if (!needle) {
      return baseCards;
    }
    return baseCards.filter((card) =>
      [
        card.displayName,
        card.id,
        card.lane,
        card.persona,
        ...card.currentTasks.map((task) => task.title),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [sessionSearch, tasks, visibilityAgents, visibilityRosterCards, visibilityTasks, visibleSessions]);

  const activeSessionLabel = useMemo(() => {
    const activeSession = visibleSessions.find((session) => session.key === activeSessionKey);
    if (activeSessionKey === commandChatView.commandSession.key) {
      return "Command";
    }
    return activeSession?.displayName || activeSession?.origin?.label || activeSession?.key || "Command";
  }, [activeSessionKey, commandChatView.commandSession.key, visibleSessions]);

  const handleRouteReply = useCallback(
    (route: { taskId: string; agentId?: string | null; kind?: string | null } | null | undefined, text: string) => {
      const prefix = route
        ? `[Route task=${route.taskId}${route.agentId ? ` agent=${route.agentId}` : ""}${route.kind ? ` kind=${route.kind}` : ""}]`
        : "";
      const next = [prefix, text].filter(Boolean).join(" ");
      setPreferredSessionKey(commandChatView.commandSession.key);
      if (commandChatView.commandSession.key !== defaultSessionKey) {
        router.replace(`/chat?session=${encodeURIComponent(commandChatView.commandSession.key)}`, { scroll: false });
      } else {
        router.replace("/chat", { scroll: false });
      }
      setInput(next);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(next.length, next.length);
      });
    },
    [commandChatView.commandSession.key, defaultSessionKey, router],
  );

  useEffect(() => {
    setSessionSpeakReplies(readSessionVoiceAutoSpeak(activeSessionKey));
    setSessionTalkMode(readSessionTalkMode(activeSessionKey));
  }, [activeSessionKey]);

  const startNewSession = useCallback(() => {
    const nextSessionKey = `dashboard-chat-${Date.now()}`;
    setPreferredSessionKey(nextSessionKey);
    setMobileSessionPickerOpen(false);
    setSessionSearch("");
    setAttachedFile(null);
    setInput("");
    router.replace(`/chat?session=${encodeURIComponent(nextSessionKey)}`);
  }, [router]);

  useEffect(() => {
    if (requestedSessionKey) {
      setPreferredSessionKey(requestedSessionKey);
      return;
    }

    if (defaultSessionKey && preferredSessionKey === DEFAULT_CHAT_SESSION_KEY) {
      return;
    }

    if (!preferredSessionKey) {
      setPreferredSessionKey(defaultSessionKey || DEFAULT_CHAT_SESSION_KEY);
    }
  }, [defaultSessionKey, preferredSessionKey, requestedSessionKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stableSessionKey = requestedSessionKey || preferredSessionKey || defaultSessionKey || DEFAULT_CHAT_SESSION_KEY;
    window.sessionStorage.setItem(MOBILE_SESSION_STORAGE_KEY, stableSessionKey);
  }, [defaultSessionKey, preferredSessionKey, requestedSessionKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1180px)");
    const sync = () => {
      setIsMobile(mobileQuery.matches);
      setIsTablet(tabletQuery.matches);
      if (!mobileQuery.matches) {
        setMobileSessionPickerOpen(false);
      }
    };

    sync();
    mobileQuery.addEventListener("change", sync);
    tabletQuery.addEventListener("change", sync);

    return () => {
      mobileQuery.removeEventListener("change", sync);
      tabletQuery.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(CHAT_TEXT_SCALE_STORAGE_KEY, chatTextScale);
  }, [chatTextScale]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(CHAT_MEASURE_STORAGE_KEY, chatMeasure);
  }, [chatMeasure]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    setMobileSessionPickerOpen(false);
  }, [activeSessionKey, isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const draftKey = `${CHAT_DRAFT_STORAGE_PREFIX}${sessionKey}`;
    const savedDraft = window.sessionStorage.getItem(draftKey);
    if (savedDraft !== null) {
      setInput(savedDraft);
    } else {
      setInput("");
    }
  }, [sessionKey]);

  useEffect(() => {
    if (!isMobile || !mobileSessionPickerOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobile, mobileSessionPickerOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const draftKey = `${CHAT_DRAFT_STORAGE_PREFIX}${sessionKey}`;
    if (input) {
      window.sessionStorage.setItem(draftKey, input);
    } else {
      window.sessionStorage.removeItem(draftKey);
    }
  }, [input, sessionKey]);

  useEffect(() => {
    if (isConnected) {
      void loadHistory();
    }
  }, [activeSessionKey, isConnected, loadHistory]);

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;
    const endNode = messagesEndRef.current;
    if (endNode) {
      endNode.scrollIntoView({ block: "end", behavior });
      return;
    }

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  useLayoutEffect(() => {
    if (!shouldAutoScrollRef.current && !isStreaming) {
      return;
    }
    scrollChatToBottom(messages.length > 1 ? "smooth" : "auto");
  }, [isStreaming, messages, scrollChatToBottom]);

  useEffect(() => {
    const node = inputRef.current;
    if (!node) {
      return;
    }

    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 192)}px`;
    node.style.overflowY = node.scrollHeight > 192 ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const updateViewportMetrics = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset);
      if (shouldAutoScrollRef.current) {
        window.requestAnimationFrame(() => scrollChatToBottom("auto"));
      }
    };

    updateViewportMetrics();
    viewport.addEventListener("resize", updateViewportMetrics);

    return () => {
      viewport.removeEventListener("resize", updateViewportMetrics);
    };
  }, [scrollChatToBottom]);

  const updateSessionRoute = useCallback(
    (nextSessionKey?: string) => {
      if (nextSessionKey && nextSessionKey !== defaultSessionKey) {
        router.replace(`/chat?session=${encodeURIComponent(nextSessionKey)}`, {
          scroll: false,
        });
        return;
      }

      router.replace("/chat", { scroll: false });
    },
    [defaultSessionKey, router],
  );

  const handleSelectSession = useCallback(
    (nextSessionKey: string) => {
      if (nextSessionKey === activeSessionKey) {
        return;
      }

      setPreferredSessionKey(nextSessionKey);
      updateSessionRoute(nextSessionKey);
    },
    [activeSessionKey, updateSessionRoute],
  );

  const handleSessionAction = useCallback(
    async (session: SessionSummary, action: "delete" | "reset" | "compact") => {
      if (action === "delete" && !confirm("Delete this session and all its messages?")) {
        return;
      }

      setActionLoading(`${session.key}-${action}`);

      try {
        if (action === "delete") {
          await deleteSession(session.key);
          if (session.key === activeSessionKey) {
            setPreferredSessionKey(defaultSessionKey || DEFAULT_CHAT_SESSION_KEY);
            updateSessionRoute(undefined);
          }
          return;
        }

        if (action === "reset") {
          await resetSession(session.key);
          if (session.key === activeSessionKey) {
            void loadHistory({ force: true });
          }
          return;
        }

        await compactSession(session.key);
        await refresh();
      } finally {
        setActionLoading(null);
      }
    },
    [
      activeSessionKey,
      compactSession,
      defaultSessionKey,
      deleteSession,
      loadHistory,
      refresh,
      resetSession,
      updateSessionRoute,
    ],
  );


  const createAttachmentFromFile = useCallback(async (file: File): Promise<PendingAttachment> => {
    const base64 = await fileToBase64(file);
    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : null;

    return {
      name: file.name || (isImage ? "pasted-image.png" : "upload"),
      content: base64,
      mimeType: file.type || "application/octet-stream",
      previewUrl,
      isImage,
    };
  }, []);

  const applyAttachment = useCallback((next: PendingAttachment | null) => {
    setAttachedFile((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return next;
    });
  }, []);

  const handleAttachmentPick = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const attachment = await createAttachmentFromFile(file);
    applyAttachment(attachment);
    event.target.value = "";
  }, [applyAttachment, createAttachmentFromFile]);

  const handlePaste = useCallback(async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const fileItem = items.find((item) => item.kind === "file");
    if (!fileItem) {
      return;
    }

    const file = fileItem.getAsFile();
    if (!file) {
      return;
    }

    event.preventDefault();
    const attachment = await createAttachmentFromFile(file);
    applyAttachment(attachment);
  }, [applyAttachment, createAttachmentFromFile]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && !attachedFile) || isStreaming) {
      return;
    }

    const attachments = attachedFile
      ? [
          {
            name: attachedFile.name,
            content: attachedFile.content,
            encoding: "base64" as const,
            mimeType: attachedFile.mimeType,
          },
        ]
      : undefined;
    void sendMessage(text, attachments);
    setInput("");
    applyAttachment(null);
    window.requestAnimationFrame(() => {
      scrollChatToBottom("smooth");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    });
  }, [applyAttachment, attachedFile, input, isStreaming, scrollChatToBottom, sendMessage]);

  const submitVoiceMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) {
        return;
      }
      void sendMessage(trimmed);
      setInput("");
      applyAttachment(null);
      window.requestAnimationFrame(() => {
        scrollChatToBottom("smooth");
        window.setTimeout(() => inputRef.current?.focus(), 0);
      });
    },
    [applyAttachment, isStreaming, scrollChatToBottom, sendMessage],
  );

  const currentVoiceDraft = [voiceBaseInputRef.current.trim(), finalTranscript.trim(), interimTranscript.trim()]
    .filter(Boolean)
    .join(" ")
    .trim();

  const startComposerVoiceInput = useCallback(() => {
    if (isVoiceListening) {
      return;
    }
    voiceBaseInputRef.current = input.trim();
    resetTranscript();
    startListening();
    inputRef.current?.focus();
  }, [input, isVoiceListening, resetTranscript, startListening]);

  const stopComposerVoiceInput = useCallback(
    (submit: boolean) => {
      stopListening();
      const draft = [voiceBaseInputRef.current.trim(), finalTranscript.trim(), interimTranscript.trim()]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (submit && draft) {
        submitVoiceMessage(draft);
        voiceBaseInputRef.current = "";
        resetTranscript();
        return;
      }
      setInput(draft);
      inputRef.current?.focus();
    },
    [finalTranscript, interimTranscript, resetTranscript, stopListening, submitVoiceMessage],
  );

  const toggleComposerVoiceInput = useCallback(() => {
    if (isVoiceListening) {
      stopComposerVoiceInput(readVoiceAutoSend());
      return;
    }
    startComposerVoiceInput();
  }, [isVoiceListening, startComposerVoiceInput, stopComposerVoiceInput]);

  useEffect(() => {
    if (!isVoiceListening) {
      return;
    }
    setInput(currentVoiceDraft);
  }, [currentVoiceDraft, isVoiceListening]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const consumeVoiceMessage = (text: string, autoSend = true) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      window.sessionStorage.removeItem(VOICE_PENDING_MESSAGE_KEY);
      if (autoSend) {
        submitVoiceMessage(trimmed);
      } else {
        setInput(trimmed);
        inputRef.current?.focus();
      }
    };

    const pending = window.sessionStorage.getItem(VOICE_PENDING_MESSAGE_KEY);
    if (pending) {
      consumeVoiceMessage(pending, true);
    }

    const handleVoiceMessage = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string; autoSend?: boolean; draft?: boolean }>).detail;
      if (!detail?.text) {
        return;
      }
      if (detail.draft) {
        setInput(detail.text);
        return;
      }
      consumeVoiceMessage(detail.text, detail.autoSend !== false);
    };

    window.addEventListener(VOICE_CHAT_EVENT, handleVoiceMessage as EventListener);
    return () => {
      window.removeEventListener(VOICE_CHAT_EVENT, handleVoiceMessage as EventListener);
    };
  }, [submitVoiceMessage]);

  const speakAssistantReply = useCallback(
    async (text: string, messageKey?: string) => {
      const spokenText = toSpokenPlainText(text);
      if (!spokenText) {
        return;
      }

      stopBrowserSpeech();

      if (speakAudioRef.current) {
        speakAudioRef.current.pause();
        speakAudioRef.current.src = "";
      }

      setIsAssistantSpeaking(true);
      setSpeechPaused(false);
      setActiveSpeechMessageKey(messageKey ?? null);
      try {
        const result = (await rpc("tts.convert", { text: spokenText })) as any;
        if (result?.audioPath) {
          const audio = new Audio(`/api/tts-audio?path=${encodeURIComponent(result.audioPath)}`);
          speakAudioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = async () => {
              await speakWithBrowserAsync(spokenText);
              resolve();
            };
            void audio.play().catch(async () => {
              await speakWithBrowserAsync(spokenText);
              resolve();
            });
          });
          setLastAssistantSpokenText(spokenText);
          return;
        }

        if (result?.audio) {
          const audio = new Audio(`data:audio/mp3;base64,${result.audio}`);
          speakAudioRef.current = audio;
          await new Promise<void>((resolve) => {
            audio.onended = () => resolve();
            audio.onerror = async () => {
              await speakWithBrowserAsync(spokenText);
              resolve();
            };
            void audio.play().catch(async () => {
              await speakWithBrowserAsync(spokenText);
              resolve();
            });
          });
          setLastAssistantSpokenText(spokenText);
          return;
        }
      } catch {
        // Fall back to browser TTS below.
      }

      await speakWithBrowserAsync(spokenText);
      setLastAssistantSpokenText(spokenText);
    },
    [rpc],
  );

  const stopActiveSpeech = useCallback(() => {
    if (speakAudioRef.current) {
      speakAudioRef.current.pause();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
    setIsAssistantSpeaking(false);
    setSpeechPaused(true);
  }, []);

  const resumeActiveSpeech = useCallback(async () => {
    if (!activeSpeechMessageKey) {
      return;
    }

    if (speakAudioRef.current?.src) {
      try {
        await speakAudioRef.current.play();
        setIsAssistantSpeaking(true);
        setSpeechPaused(false);
        return;
      } catch {
        // Fall through to browser resume/replay.
      }
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsAssistantSpeaking(true);
      setSpeechPaused(false);
      return;
    }

    if (lastAssistantSpokenText) {
      void speakAssistantReply(lastAssistantSpokenText, activeSpeechMessageKey).finally(() => {
        setIsAssistantSpeaking(false);
      });
    }
  }, [activeSpeechMessageKey, lastAssistantSpokenText, speakAssistantReply]);

  useEffect(() => {
    setHeaderActions(
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setChatTextScale((current) => (current === "compact" ? "comfortable" : "compact"))}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
            background: "rgba(255, 255, 255, 0.03)",
          }}
          title="Toggle chat text size"
        >
          <Type className="h-4 w-4" />
          <span className="hidden sm:inline">{chatTextScale === "compact" ? "Text S" : "Text M"}</span>
        </button>
        {!isMobile ? (
          <button
            type="button"
            onClick={() => setChatMeasure((current) => (current === "narrow" ? "wide" : "narrow"))}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "rgba(255, 255, 255, 0.03)",
            }}
            title="Toggle chat width"
          >
            <Columns3 className="h-4 w-4" />
            <span className="hidden sm:inline">{chatMeasure === "narrow" ? "Width N" : "Width W"}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() =>
            setSessionSpeakReplies((current) => {
              const next = !current;
              writeSessionVoiceAutoSpeak(activeSessionKey, next);
              return next;
            })
          }
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
          style={{
            borderColor: sessionSpeakReplies ? "rgba(96, 165, 250, 0.28)" : "var(--border)",
            color: sessionSpeakReplies ? "#93c5fd" : "var(--text-secondary)",
            background: sessionSpeakReplies ? "rgba(30, 64, 175, 0.14)" : "rgba(255, 255, 255, 0.03)",
          }}
          title={sessionSpeakReplies ? "Disable spoken replies for this session" : "Enable spoken replies for this session"}
        >
          {sessionSpeakReplies ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          <span className="hidden sm:inline">Read</span>
        </button>
        {sessionSpeakReplies ? (
          <button
            type="button"
            onClick={() => {
              if (isAssistantSpeaking) {
                stopActiveSpeech();
                return;
              }
              if (lastAssistantSpokenText) {
                void speakAssistantReply(lastAssistantSpokenText, activeSpeechMessageKey ?? undefined).finally(() => {
                  setIsAssistantSpeaking(false);
                });
              }
            }}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
            style={{
              borderColor: isAssistantSpeaking ? "rgba(248, 113, 113, 0.28)" : "var(--border)",
              color: isAssistantSpeaking ? "#fca5a5" : "var(--text-secondary)",
              background: isAssistantSpeaking ? "rgba(127, 29, 29, 0.18)" : "rgba(255, 255, 255, 0.03)",
            }}
            title={isAssistantSpeaking ? "Stop spoken reply" : "Replay last spoken reply"}
          >
            {isAssistantSpeaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            <span className="hidden sm:inline">{isAssistantSpeaking ? "Stop" : "Replay"}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const next = !sessionTalkMode;
            writeSessionTalkMode(activeSessionKey, next);
            setSessionTalkMode(next);
            if (next) {
              writeSessionVoiceAutoSpeak(activeSessionKey, true);
              setSessionSpeakReplies(true);
            } else {
              stopListening();
              stopBrowserSpeech();
              setIsAssistantSpeaking(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
          style={{
            borderColor: sessionTalkMode ? "rgba(52, 211, 153, 0.28)" : "var(--border)",
            color: sessionTalkMode ? "#34d399" : "var(--text-secondary)",
            background: sessionTalkMode ? "rgba(6, 95, 70, 0.16)" : "rgba(255, 255, 255, 0.03)",
          }}
          title={sessionTalkMode ? "Disable talk mode for this session" : "Enable talk mode for this session"}
        >
          {sessionTalkMode ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="hidden sm:inline">{sessionTalkMode ? "Talk on" : "Talk"}</span>
        </button>
        {!isMobile ? (
          <>
            <button
              type="button"
              onClick={() => setRailModal("rollups")}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "#93c5fd", background: "rgba(59, 130, 246, 0.08)" }}
            >
              <span className="hidden sm:inline">Rollups</span>
              <span>{commandChatView.rollups.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setRailModal("needs")}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "#fbbf24", background: "rgba(251, 191, 36, 0.08)" }}
            >
              <span className="hidden sm:inline">Needs</span>
              <span>{commandChatView.needsChristian.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setRailModal("agents")}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "rgba(255, 255, 255, 0.03)" }}
            >
              <span className="hidden sm:inline">Agents</span>
              <span>{rosterCards.length}</span>
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setMobileSessionPickerOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/5"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-primary)",
            background: "rgba(255, 255, 255, 0.03)",
          }}
        >
          <span className="max-w-[10rem] truncate">{activeSessionLabel}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${mobileSessionPickerOpen ? "rotate-180" : ""}`} />
        </button>
      </div>,
    );

    return () => setHeaderActions(null);
  }, [activeSessionKey, activeSessionLabel, activeSpeechMessageKey, chatMeasure, chatTextScale, commandChatView.needsChristian.length, commandChatView.rollups.length, isAssistantSpeaking, isMobile, lastAssistantSpokenText, mobileSessionPickerOpen, rosterCards.length, sessionSpeakReplies, sessionTalkMode, setHeaderActions, stopActiveSpeech, stopListening, speakAssistantReply]);

  useEffect(() => {
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.state === "final" && message.content.trim());

    if (!latestAssistant || !sessionSpeakReplies) {
      return;
    }

    const nextKey = latestAssistant.runId || latestAssistant.id;
    if (lastSpokenAssistantKeyRef.current === nextKey) {
      return;
    }

    if (latestAssistant.timestamp <= mountedAtRef.current) {
      lastSpokenAssistantKeyRef.current = nextKey;
      return;
    }

    lastSpokenAssistantKeyRef.current = nextKey;
    void speakAssistantReply(latestAssistant.content, nextKey).finally(() => {
      setIsAssistantSpeaking(false);
    });
  }, [messages, sessionSpeakReplies, speakAssistantReply]);

  useEffect(() => {
    lastSpokenAssistantKeyRef.current = null;
  }, [activeSessionKey]);

  useEffect(() => {
    if (!sessionTalkMode || !isConnected || isStreaming || isAssistantSpeaking || isVoiceListening) {
      return;
    }

    if (input.trim()) {
      return;
    }

    const timeout = window.setTimeout(() => {
      startComposerVoiceInput();
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [
    input,
    isAssistantSpeaking,
    isConnected,
    isStreaming,
    isVoiceListening,
    sessionTalkMode,
    startComposerVoiceInput,
  ]);

  useEffect(() => {
    if (!sessionTalkMode || !isVoiceListening || !finalTranscript.trim() || interimTranscript.trim()) {
      return;
    }

    const timeout = window.setTimeout(() => {
      stopComposerVoiceInput(true);
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [finalTranscript, interimTranscript, isVoiceListening, sessionTalkMode, stopComposerVoiceInput]);

  useEffect(() => {
    return () => {
      stopListening();
      if (speakAudioRef.current) {
        speakAudioRef.current.pause();
        speakAudioRef.current.src = "";
      }
      stopBrowserSpeech();
    };
  }, [stopListening]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="shell-chat-page h-full min-h-0 min-w-0 overflow-hidden px-2 py-2 md:px-6 md:py-6">
      <div className={`grid h-full min-h-0 flex-1 gap-3 overflow-hidden md:gap-4 ${isTablet ? "md:grid-cols-[248px_minmax(0,1fr)]" : "md:grid-cols-[264px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]"}`}>
        {!isMobile ? (
          <div className="order-2 min-h-0 md:order-1 md:h-full">
            <SessionRail
              activeSessionKey={activeSessionKey}
              actionLoading={actionLoading}
              error={sessionsError}
              loading={sessionsLoading}
              onAction={handleSessionAction}
              onNewSession={startNewSession}
              onRefresh={refresh}
              onSearchChange={setSessionSearch}
              onSelectSession={handleSelectSession}
              searchValue={sessionSearch}
              commandChatView={commandChatView}
              communications={visibilityCommunications}
              communicationSummary={visibilityCommunicationSummary}
              rosterCards={rosterCards}
              onUseSuggestedReply={handleRouteReply}
            />
          </div>
        ) : null}
        <div className="order-1 min-h-0 overflow-hidden md:order-2 md:h-full">
          <ChatThread
            abort={abort}
            error={error}
            gatewayState={gatewayState}
            input={input}
            inputRef={inputRef}
            composerRef={composerRef}
            isConnected={isConnected}
            isStreaming={isStreaming}
            keyboardInset={keyboardInset}
            messages={messages}
            messagesContainerRef={messagesContainerRef}
            messagesEndRef={messagesEndRef}
            onInputChange={setInput}
            onInputFocus={() => scrollChatToBottom("auto")}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onSend={handleSend}
            onVoiceToggle={toggleComposerVoiceInput}
            onSessionSpeakToggle={() =>
              setSessionSpeakReplies((current) => {
                const next = !current;
                writeSessionVoiceAutoSpeak(activeSessionKey, next);
                return next;
              })
            }
            onSessionReplay={() => {
              if (isAssistantSpeaking) {
                stopActiveSpeech();
                return;
              }
              if (lastAssistantSpokenText) {
                void speakAssistantReply(lastAssistantSpokenText, activeSpeechMessageKey ?? undefined).finally(() => {
                  setIsAssistantSpeaking(false);
                });
              }
            }}
            onSessionTalkToggle={() => {
              const next = !sessionTalkMode;
              writeSessionTalkMode(activeSessionKey, next);
              setSessionTalkMode(next);
              if (next) {
                writeSessionVoiceAutoSpeak(activeSessionKey, true);
                setSessionSpeakReplies(true);
              } else {
                stopListening();
                stopBrowserSpeech();
                setIsAssistantSpeaking(false);
              }
            }}
            onReadAloud={(text, messageKey) => {
              void speakAssistantReply(text, messageKey).finally(() => {
                setIsAssistantSpeaking(false);
              });
            }}
            onStopReading={stopActiveSpeech}
            onResumeReading={() => {
              void resumeActiveSpeech();
            }}
            activeSpeechMessageKey={activeSpeechMessageKey}
            isAssistantSpeaking={isAssistantSpeaking}
            speechPaused={speechPaused}
            attachedFile={attachedFile}
            fileInputRef={fileInputRef}
            onPickAttachment={handleAttachmentPick}
            onClearAttachment={() => applyAttachment(null)}
            activeSessionKey={activeSessionKey}
            isMobile={isMobile}
            isVoiceListening={isVoiceListening}
            voiceError={voiceError}
            sessionSpeakReplies={sessionSpeakReplies}
            sessionTalkMode={sessionTalkMode}
            hasReplayableSpeech={Boolean(lastAssistantSpokenText)}
            sessions={sessions}
            commandRollups={commandChatView.rollups}
            taskStateBuckets={commandChatView.taskState}
            showControlPanel={activeSessionKey === commandChatView.commandSession.key}
            onUseSuggestedReply={handleRouteReply}
            chatMeasure={chatMeasure}
            chatTextScale={chatTextScale}
            onSelectSession={handleSelectSession}
            onMessagesScroll={(event) => {
              const node = event.currentTarget;
              const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
              shouldAutoScrollRef.current = distanceFromBottom < 96;
            }}
          />
        </div>
      </div>
      {isMobile && mobileSessionPickerOpen ? (
        <div className="fixed inset-0 z-[60] bg-[rgba(3,7,10,0.78)] backdrop-blur-sm md:hidden">
          <div className="absolute inset-x-3 top-[max(1rem,env(safe-area-inset-top))] bottom-[max(1rem,env(safe-area-inset-bottom))]">
            <SessionRail
              activeSessionKey={activeSessionKey}
              actionLoading={actionLoading}
              error={sessionsError}
              loading={sessionsLoading}
              mobileOverlay
              onAction={handleSessionAction}
              onClose={() => setMobileSessionPickerOpen(false)}
              onNewSession={startNewSession}
              onRefresh={refresh}
              onSearchChange={setSessionSearch}
              onSelectSession={handleSelectSession}
              searchValue={sessionSearch}
              commandChatView={commandChatView}
              communications={visibilityCommunications}
              communicationSummary={visibilityCommunicationSummary}
              rosterCards={rosterCards}
              onUseSuggestedReply={handleRouteReply}
            />
          </div>
        </div>
      ) : null}
      {railModal ? (
        <RailModalOverlay
          mode={railModal}
          rosterCards={rosterCards}
          rollups={commandChatView.rollups}
          needsChristian={commandChatView.needsChristian}
          onClose={() => setRailModal(null)}
          onSelectSession={(key) => {
            setRailModal(null);
            handleSelectSession(key);
          }}
          onUseSuggestedReply={(route, text) => {
            setRailModal(null);
            handleRouteReply(route, text);
          }}
          isTablet={isTablet}
        />
      ) : null}
    </div>
  );
}

function ChatThread({
  abort,
  composerRef,
  error,
  gatewayState,
  input,
  inputRef,
  isConnected,
  isStreaming,
  keyboardInset,
  messages,
  messagesContainerRef,
  messagesEndRef,
  activeSessionKey,
  isMobile,
  onInputChange,
  onInputFocus,
  onKeyDown,
  onPaste,
  onMessagesScroll,
  onSend,
  onVoiceToggle,
  onSessionSpeakToggle,
  onSessionReplay,
  onSessionTalkToggle,
  onReadAloud,
  onStopReading,
  onResumeReading,
  activeSpeechMessageKey,
  isAssistantSpeaking,
  speechPaused,
  onSelectSession,
  attachedFile,
  fileInputRef,
  onPickAttachment,
  onClearAttachment,
  isVoiceListening,
  voiceError,
  sessionSpeakReplies,
  sessionTalkMode,
  hasReplayableSpeech,
  sessions,
  commandRollups,
  taskStateBuckets,
  showControlPanel,
  onUseSuggestedReply,
  chatMeasure,
  chatTextScale,
}: {
  abort: () => Promise<void>;
  composerRef: React.RefObject<HTMLDivElement | null>;
  error: string | null;
  gatewayState: "disconnected" | "connecting" | "authenticating" | "connected" | "error";
  input: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  isConnected: boolean;
  isStreaming: boolean;
  keyboardInset: number;
  messages: ChatMessage[];
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  activeSessionKey: string;
  isMobile: boolean;
  onInputChange: (value: string) => void;
  onInputFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onMessagesScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onSend: () => void;
  onVoiceToggle: () => void;
  onSessionSpeakToggle: () => void;
  onSessionReplay: () => void;
  onSessionTalkToggle: () => void;
  onReadAloud: (text: string, messageKey: string) => void;
  onStopReading: () => void;
  onResumeReading: () => void;
  activeSpeechMessageKey: string | null;
  isAssistantSpeaking: boolean;
  speechPaused: boolean;
  onSelectSession: (key: string) => void;
  attachedFile: { name: string; content: string; previewUrl?: string | null; isImage?: boolean } | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickAttachment: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearAttachment: () => void;
  isVoiceListening: boolean;
  voiceError: string | null;
  sessionSpeakReplies: boolean;
  sessionTalkMode: boolean;
  hasReplayableSpeech: boolean;
  sessions: SessionSummary[];
  commandRollups: CommandRollupCard[];
  taskStateBuckets: TaskStateBucket[];
  showControlPanel: boolean;
  onUseSuggestedReply: (route: { taskId: string; agentId?: string | null; kind?: string | null } | null | undefined, text: string) => void;
  chatMeasure: ChatMeasure;
  chatTextScale: ChatTextScale;
}) {
  return (
    <section
      className="relative z-[1] flex h-full min-h-[26rem] min-w-0 w-full flex-col overflow-hidden rounded-[var(--radius-shell)] border md:min-h-0"
      style={{
        borderColor: "var(--border)",
        background: "linear-gradient(180deg, rgba(9, 18, 24, 0.94), rgba(6, 13, 19, 0.92))",
      }}
    >
      {!isConnected ? (
        <div className="border-b px-6 py-3" style={{ borderColor: "var(--border)" }}>
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
              gatewayState === "connecting" || gatewayState === "authenticating"
                ? "bg-amber-500/10 text-amber-300"
                : "bg-red-500/10 text-red-500"
            }`}
          >
            {gatewayState === "connecting" || gatewayState === "authenticating" ? (
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            {gatewayState === "connecting" || gatewayState === "authenticating"
              ? "Connecting to the gateway. Chat will be ready in a moment."
              : "Gateway disconnected. Chat will reconnect automatically."}
          </div>
        </div>
      ) : null}

      <div
        ref={messagesContainerRef}
        data-chat-scroll-container
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-6"
        onScroll={onMessagesScroll}
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        <div className={`space-y-4 pb-3 ${chatMeasure === "narrow" ? "mx-auto w-full max-w-[780px] lg:max-w-[840px]" : "mx-auto w-full max-w-[1100px]"}`}>
          {showControlPanel && (commandRollups.length || taskStateBuckets.length) ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
              {commandRollups.length ? (
                <div className="rounded-[1.5rem] border p-4" style={{ borderColor: "rgba(96, 165, 250, 0.2)", background: "rgba(59, 130, 246, 0.08)" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#93c5fd" }}>Command Rollups</div>
                  <div className="mt-3 space-y-3">
                    {commandRollups.map((rollup) => (
                      <div key={rollup.id} className="rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{rollup.title}</div>
                        <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>{rollup.summary}</div>
                        {rollup.suggestedReplies?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {rollup.suggestedReplies.slice(0, 2).map((reply) => (
                              <button
                                key={reply.label}
                                type="button"
                                className="rounded-full border px-2.5 py-1 text-[11px]"
                                style={{ borderColor: "var(--border)", color: "#93c5fd" }}
                                onClick={() => onUseSuggestedReply(rollup.routeBackTo, reply.text)}
                              >
                                {reply.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {taskStateBuckets.length ? (
                <div className="rounded-[1.5rem] border p-4" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>Agent Work Queue</div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {taskStateBuckets.map((bucket) => (
                      <div key={bucket.key} className="rounded-2xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>{bucket.label}</div>
                        <div className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{bucket.total}</div>
                        <div className="mt-2 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                          {bucket.tasks[0]?.id ? `${bucket.tasks[0].id} · ${bucket.tasks[0].title}` : "Nothing here right now."}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-[1.75rem] border text-center" style={{ borderColor: "var(--border)", background: "rgba(255, 255, 255, 0.02)" }}>
              <Bot className="mb-4 h-16 w-16" style={{ color: "var(--text-secondary)" }} />
              <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
                Start a conversation
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                Select a session or start typing below.
              </p>
            </div>
          ) : null}

          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onReadAloud={onReadAloud}
              onStopReading={onStopReading}
              onResumeReading={onResumeReading}
              isReading={activeSpeechMessageKey === (message.runId || message.id) && isAssistantSpeaking}
              isReadPaused={activeSpeechMessageKey === (message.runId || message.id) && speechPaused}
              textScale={chatTextScale}
            />
          ))}

          {error ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          ) : null}
          <div ref={messagesEndRef} className="h-px w-full" aria-hidden="true" />
        </div>
      </div>

      <div
        ref={composerRef}
        className="z-[2] mt-auto flex-shrink-0 border-t px-3 py-3 md:px-6 md:py-4"
        style={{
          borderColor: "var(--border)",
          background: "linear-gradient(180deg, rgba(8, 16, 22, 0.74), rgba(6, 12, 18, 0.96))",
          backdropFilter: "blur(18px)",
          paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom) + ${Math.max(12, keyboardInset)}px)`,
        }}
      >
        {voiceError ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(248, 113, 113, 0.24)", background: "rgba(127, 29, 29, 0.18)", color: "#fca5a5" }}>
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {voiceError}
          </div>
        ) : null}
        {isVoiceListening ? (
          <div className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(96, 165, 250, 0.24)", background: "rgba(30, 64, 175, 0.14)", color: "#93c5fd" }}>
            <MicOff className="h-3.5 w-3.5 flex-shrink-0" />
            Listening into the chat field. Tap the mic again to stop.
          </div>
        ) : null}
        {attachedFile ? (
          <div className="mb-3 rounded-2xl border px-3 py-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.03)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 text-xs" style={{ color: "var(--text-secondary)" }}>
                <div className="truncate">📎 {attachedFile.name}</div>
              </div>
              <button type="button" onClick={onClearAttachment} className="rounded-lg px-2 py-1 text-xs" style={{ color: "#fca5a5" }}>Remove</button>
            </div>
            {attachedFile.isImage && attachedFile.previewUrl ? (
              <img src={attachedFile.previewUrl} alt={attachedFile.name} className="mt-3 max-h-40 w-full rounded-xl object-contain" />
            ) : null}
          </div>
        ) : null}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSessionSpeakToggle}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
            style={{
              borderColor: sessionSpeakReplies ? "rgba(96, 165, 250, 0.28)" : "var(--border)",
              color: sessionSpeakReplies ? "#93c5fd" : "var(--text-secondary)",
              background: sessionSpeakReplies ? "rgba(30, 64, 175, 0.14)" : "rgba(255, 255, 255, 0.03)",
            }}
          >
            {sessionSpeakReplies ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            {sessionSpeakReplies ? "Read on" : "Read off"}
          </button>
          <button
            type="button"
            onClick={onSessionTalkToggle}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5"
            style={{
              borderColor: sessionTalkMode ? "rgba(52, 211, 153, 0.28)" : "var(--border)",
              color: sessionTalkMode ? "#34d399" : "var(--text-secondary)",
              background: sessionTalkMode ? "rgba(6, 95, 70, 0.16)" : "rgba(255, 255, 255, 0.03)",
            }}
          >
            {sessionTalkMode ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            {sessionTalkMode ? "Talk on" : "Talk off"}
          </button>
          <button
            type="button"
            onClick={onSessionReplay}
            disabled={!hasReplayableSpeech && !isAssistantSpeaking}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/5 disabled:opacity-40"
            style={{
              borderColor: isAssistantSpeaking ? "rgba(248, 113, 113, 0.28)" : "var(--border)",
              color: isAssistantSpeaking ? "#fca5a5" : "var(--text-secondary)",
              background: isAssistantSpeaking ? "rgba(127, 29, 29, 0.18)" : "rgba(255, 255, 255, 0.03)",
            }}
          >
            {isAssistantSpeaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {isAssistantSpeaking ? "Stop voice" : "Replay last"}
          </button>
        </div>
        <div
          className="flex items-end gap-3 rounded-[1.25rem] border px-4 py-3"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            borderColor: "var(--border)",
          }}
        >
          <input
            ref={fileInputRef}
            id="openclaw-chat-attachment"
            type="file"
            accept="image/*,.txt,.md,.json,.csv,.pdf"
            onChange={onPickAttachment}
            className="sr-only"
          />
          <label
            htmlFor="openclaw-chat-attachment"
            className="flex-shrink-0 rounded-xl border p-2.5 transition-colors hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            title="Attach screenshot or file"
            aria-label="Attach screenshot or file"
          >
            <Paperclip className="h-4 w-4" />
          </label>
          <button
            type="button"
            onClick={onVoiceToggle}
            onMouseDown={(event) => event.preventDefault()}
            className={`flex-shrink-0 rounded-xl border p-2.5 transition-colors ${
              isVoiceListening ? "bg-blue-500/15" : "hover:bg-white/5"
            }`}
            style={{
              borderColor: isVoiceListening ? "rgba(96, 165, 250, 0.32)" : "var(--border)",
              color: isVoiceListening ? "#93c5fd" : "var(--text-secondary)",
            }}
            title={isVoiceListening ? "Stop voice input" : "Start voice input"}
            aria-label={isVoiceListening ? "Stop voice input" : "Start voice input"}
          >
            {isVoiceListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onFocus={onInputFocus}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder="Message the current session..."
            rows={1}
            className={`min-w-0 flex-1 resize-none bg-transparent outline-none ${chatTextScale === "comfortable" ? "text-[15px] leading-8" : "text-[13px] leading-6"}`}
            style={{
              color: "var(--text-primary)",
              maxHeight: "192px",
            }}
            disabled={!isConnected}
          />
          {isStreaming ? (
            <button
              onClick={() => void abort()}
              onMouseDown={(event) => event.preventDefault()}
              className="flex-shrink-0 rounded-xl bg-red-500 p-2.5 text-white transition-colors hover:bg-red-600"
              title="Stop generating"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onSend}
              onMouseDown={(event) => event.preventDefault()}
              disabled={(!input.trim() && !attachedFile) || !isConnected}
              className="flex-shrink-0 rounded-xl bg-[var(--primary)] p-2.5 transition-colors hover:brightness-105 disabled:opacity-40 disabled:hover:brightness-100"
              style={{ color: "var(--text-on-primary)" }}
              title="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function SessionRail({
  activeSessionKey,
  actionLoading,
  error,
  loading,
  mobileOverlay = false,
  onAction,
  onClose,
  onNewSession,
  onRefresh,
  onSearchChange,
  onSelectSession,
  onUseSuggestedReply,
  searchValue,
  commandChatView,
  communications,
  communicationSummary,
  rosterCards,
}: {
  activeSessionKey: string;
  actionLoading: string | null;
  error: string | null;
  loading: boolean;
  mobileOverlay?: boolean;
  onAction: (session: SessionSummary, action: "delete" | "reset" | "compact") => void;
  onClose?: () => void;
  onNewSession: () => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onSelectSession: (key: string) => void;
  onUseSuggestedReply: (route: { taskId: string; agentId?: string | null; kind?: string | null } | null | undefined, text: string) => void;
  searchValue: string;
  commandChatView: ReturnType<typeof buildCommandChatView>;
  communications: InterAgentCommunication[];
  communicationSummary: InterAgentCommunicationSummary | null;
  rosterCards: AgentRosterCard[];
}) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth <= 767 : false);
  const [mobileExpanded, setMobileExpanded] = useState(() => typeof window !== "undefined" ? window.innerWidth > 767 : true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobile(mediaQuery.matches);
      setMobileExpanded((current) => (mediaQuery.matches ? current : true));
    };
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isMobile) setMobileExpanded(false);
  }, [activeSessionKey, isMobile]);

  const showBody = mobileOverlay ? true : !isMobile || mobileExpanded;
  const sessionCount = 1 + commandChatView.backgroundGroups.reduce((sum, group) => sum + group.sessions.length, 0) + commandChatView.ungroupedSessions.length;

  return (
    <aside className={`relative z-0 flex h-auto min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-[var(--radius-shell)] border md:h-full ${mobileOverlay ? "h-full" : ""}`} style={{ background: "rgba(9, 18, 24, 0.96)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Command chat</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>One foreground thread, with agents and worker traces grouped behind it.</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} onClick={onNewSession}><Sparkles className="h-3.5 w-3.5" /><span>New</span></button>
          {mobileOverlay ? <button type="button" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} onClick={onClose}><span>Close</span></button> : null}
          {isMobile ? <button type="button" className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/5" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} onClick={() => setMobileExpanded((current) => !current)}><span>{mobileExpanded ? "Hide" : "Show"}</span>{mobileExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button> : null}
          <button type="button" className="rounded-lg p-2 transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)" }} onClick={onRefresh} title="Refresh sessions"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
        </div>
      </div>
      {isMobile ? <div className="border-b px-5 py-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{sessionCount} tracked sessions</div> : null}
      {showBody ? <>
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <label className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ background: "rgba(255, 255, 255, 0.03)", borderColor: "var(--border)" }}>
            <Search className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            <input type="text" value={searchValue} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search agents or work..." className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
          </label>
          {error ? <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</div> : null}
        </div>
        <div data-session-scroll-container className={`min-h-0 flex-1 overflow-y-auto px-3 py-3 ${mobileOverlay ? "" : "max-md:max-h-[18rem]"}`}>
          <div className="space-y-3">
            <div>
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>Command</div>
              <SessionListRow active={activeSessionKey === commandChatView.commandSession.key} actionLoading={actionLoading} onAction={onAction} onSelect={onSelectSession} session={{ ...commandChatView.commandSession, displayName: "Command", label: "Chief of Staff" }} />
              {commandChatView.taskState.length ? (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {commandChatView.taskState.map((bucket) => (
                    <div key={bucket.key} className="rounded-xl border px-2.5 py-2" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>{bucket.label}</div>
                      <div className="mt-1 text-base font-semibold" style={{ color: "var(--text-primary)" }}>{bucket.total}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {commandChatView.rollups.length ? (
                <CompactInsightSection
                  title="Command Rollups"
                  tone="blue"
                  items={commandChatView.rollups.slice(0, 4).map((item) => ({
                    id: item.id,
                    title: item.title,
                    summary: item.summary,
                    actionLabel: item.suggestedReplies?.[0]?.label ?? null,
                    onAction: item.suggestedReplies?.[0]
                      ? () => onUseSuggestedReply(item.routeBackTo, item.suggestedReplies![0].text)
                      : undefined,
                  }))}
                />
              ) : null}
              {commandChatView.needsChristian.length ? (
                <CompactInsightSection
                  title="Needs Christian"
                  tone="amber"
                  items={commandChatView.needsChristian.slice(0, 4).map((item) => ({
                    id: item.id,
                    title: item.title,
                    summary: item.reason,
                    badges: [item.priority, item.status],
                    actions: item.suggestedReplies?.slice(0, 2).map((reply) => ({
                      label: reply.label,
                      onClick: () => onUseSuggestedReply(item.routeBackTo, reply.text),
                    })),
                  }))}
                />
              ) : null}
              {communications.length ? (
                <div className="mt-3">
                  <CoordinationFeedCard
                    title="Coordination Layer"
                    communications={communications}
                    summary={communicationSummary}
                    maxItems={4}
                    compact
                    surface="plain"
                  />
                </div>
              ) : null}
            </div>
            <div>
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>Agents</div>
              <div className="space-y-2">{rosterCards.map((card) => <AgentRosterRow key={card.id} card={card} onSelectSession={onSelectSession} />)}</div>
            </div>
            <div>
              <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>Background work</div>
              <div className="space-y-2">{commandChatView.backgroundGroups.map((group) => <WorkerGroupRow key={group.groupId} group={group} activeSessionKey={activeSessionKey} actionLoading={actionLoading} onAction={onAction} onSelectSession={onSelectSession} />)}{commandChatView.ungroupedSessions.length ? <SessionSection title="Ungrouped traces" sessions={commandChatView.ungroupedSessions} activeSessionKey={activeSessionKey} actionLoading={actionLoading} onAction={onAction} onSelect={onSelectSession} /> : null}</div>
            </div>
          </div>
        </div>
      </> : null}
    </aside>
  );
}

function CompactInsightSection({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "blue" | "amber";
  items: Array<{
    id: string;
    title: string;
    summary: string;
    badges?: string[];
    actionLabel?: string | null;
    onAction?: (() => void) | undefined;
    actions?: Array<{ label: string; onClick: () => void }> | undefined;
  }>;
}) {
  const toneStyle =
    tone === "blue"
      ? {
          borderColor: "rgba(96, 165, 250, 0.2)",
          background: "rgba(59, 130, 246, 0.06)",
          titleColor: "#93c5fd",
          actionColor: "#93c5fd",
        }
      : {
          borderColor: "rgba(251, 191, 36, 0.2)",
          background: "rgba(251, 191, 36, 0.06)",
          titleColor: "#fbbf24",
          actionColor: "#fbbf24",
        };

  return (
    <div className="mt-2 rounded-2xl border px-3 py-3" style={{ borderColor: toneStyle.borderColor, background: toneStyle.background }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: toneStyle.titleColor }}>
          {title}
        </div>
        <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {items.length} shown
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border px-3 py-2.5" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-medium leading-5" style={{ color: "var(--text-primary)" }}>
                  {item.title}
                </div>
                <div className="mt-1 line-clamp-3 text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                  {item.summary}
                </div>
              </div>
              {item.badges?.length ? (
                <div className="flex flex-col items-end gap-1">
                  {item.badges.filter(Boolean).slice(0, 2).map((badge) => (
                    <span key={badge} className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {item.actions?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="rounded-full border px-2.5 py-1 text-[11px]"
                    style={{ borderColor: "var(--border)", color: toneStyle.actionColor }}
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            ) : item.actionLabel && item.onAction ? (
              <button
                type="button"
                className="mt-2 rounded-full border px-2.5 py-1 text-[11px]"
                style={{ borderColor: "var(--border)", color: toneStyle.actionColor }}
                onClick={item.onAction}
              >
                {item.actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function RailModalOverlay({
  mode,
  rosterCards,
  rollups,
  needsChristian,
  onClose,
  onSelectSession,
  onUseSuggestedReply,
  isTablet,
}: {
  mode: Exclude<RailModal, null>;
  rosterCards: AgentRosterCard[];
  rollups: CommandRollupCard[];
  needsChristian: ReturnType<typeof buildCommandChatView>["needsChristian"];
  onClose: () => void;
  onSelectSession: (key: string) => void;
  onUseSuggestedReply: (route: { taskId: string; agentId?: string | null; kind?: string | null } | null | undefined, text: string) => void;
  isTablet: boolean;
}) {
  const title = mode === "rollups" ? "Command Rollups" : mode === "needs" ? "Needs Christian" : "Agents";
  const wide = mode === "agents";

  return (
    <div className="fixed inset-0 z-[70] bg-[rgba(3,7,10,0.76)] backdrop-blur-sm">
      <div className={`absolute ${isTablet ? "inset-x-8 top-8 bottom-8" : "inset-x-3 top-3 bottom-3 md:left-[18rem] md:right-8 md:top-8 md:bottom-8"} flex`}>
        <div
          className={`flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-shell)] border ${wide ? "" : "max-w-[720px]"}`}
          style={{ borderColor: "var(--border)", background: "rgba(9, 18, 24, 0.98)" }}
        >
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
            <div>
              <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {mode === "agents" ? "Compact agent roster with session jump links." : "Focused review without rail scrolling."}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border p-2 transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {mode === "rollups" ? (
              <div className="space-y-2">
                {rollups.map((item) => (
                  <div key={item.id} className="rounded-xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(59, 130, 246, 0.06)" }}>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.title}</div>
                    <div className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{item.summary}</div>
                    {item.suggestedReplies?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.suggestedReplies.slice(0, 2).map((reply) => (
                          <button key={reply.label} type="button" className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--border)", color: "#93c5fd" }} onClick={() => onUseSuggestedReply(item.routeBackTo, reply.text)}>
                            {reply.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {mode === "needs" ? (
              <div className="space-y-2">
                {needsChristian.map((item) => (
                  <div key={item.id} className="rounded-xl border px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(251, 191, 36, 0.06)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.id} · {item.title}</div>
                        <div className="mt-1 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>{item.reason}</div>
                      </div>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: "var(--border)", color: "#fbbf24" }}>{item.priority}</span>
                    </div>
                    {item.suggestedReplies?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.suggestedReplies.slice(0, 2).map((reply) => (
                          <button key={reply.label} type="button" className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--border)", color: "#fbbf24" }} onClick={() => onUseSuggestedReply(item.routeBackTo, reply.text)}>
                            {reply.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {mode === "agents" ? (
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {rosterCards.map((card) => (
                  <AgentRosterCardView key={card.id} card={card} onOpenSession={onSelectSession} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionSection({
  title,
  sessions,
  activeSessionKey,
  actionLoading,
  onAction,
  onSelect,
}: {
  title: string;
  sessions: SessionSummary[];
  activeSessionKey: string;
  actionLoading: string | null;
  onAction: (session: SessionSummary, action: "delete" | "reset" | "compact") => void;
  onSelect: (key: string) => void;
}) {
  if (!sessions.length) {
    return null;
  }

  return (
    <div>
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-secondary)" }}>
        {title}
      </div>
      <div className="space-y-2">
        {sessions.map((session) => (
          <SessionListRow
            key={session.key}
            active={session.key === activeSessionKey}
            actionLoading={actionLoading}
            onAction={onAction}
            onSelect={onSelect}
            session={session}
          />
        ))}
      </div>
    </div>
  );
}

function SessionListRow({
  active,
  actionLoading,
  onAction,
  onClose,
  onSelect,
  session,
}: {
  active: boolean;
  actionLoading: string | null;
  onAction: (session: SessionSummary, action: "delete" | "reset" | "compact") => void;
  onClose?: () => void;
  onSelect: (key: string) => void;
  session: SessionSummary;
}) {
  const title = session.displayName || session.origin?.label || session.key;
  const typeLabel = sessionTypeLabel(session);
  const sessionMeta = [
    typeLabel,
    session.agentId || session.key.split(":")[1],
    session.channel,
    session.updatedAt ? formatTimeAgo(session.updatedAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="group rounded-2xl border transition-colors"
      style={{
        borderColor: active ? "rgba(255, 122, 26, 0.26)" : "var(--border)",
        background: active
          ? "linear-gradient(90deg, rgba(255, 122, 26, 0.14), rgba(255, 122, 26, 0.04))"
          : "rgba(255, 255, 255, 0.02)",
      }}
    >
      <button
        type="button"
        className="block w-full px-4 py-3 text-left"
        onClick={() => {
          onSelect(session.key);
          onClose?.();
        }}
      >
        <div className="truncate text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </div>
        <div className="mt-1 truncate text-xs" style={{ color: "var(--text-secondary)" }}>
          {sessionMeta || session.key}
        </div>
        {session.totalTokens != null ? (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {(session.totalTokens / 1000).toFixed(1)}K tokens
          </div>
        ) : null}
      </button>

      <div className="flex items-center justify-end gap-2 border-t px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <SessionActionButton
          active={active}
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          label="Reset"
          loading={actionLoading === `${session.key}-reset`}
          onClick={() => onAction(session, "reset")}
        />
        <SessionActionButton
          active={active}
          icon={<Archive className="h-3.5 w-3.5" />}
          label="Compact"
          loading={actionLoading === `${session.key}-compact`}
          onClick={() => onAction(session, "compact")}
        />
        <SessionActionButton
          danger
          active={active}
          icon={<Trash2 className="h-3.5 w-3.5" />}
          label="Delete"
          loading={actionLoading === `${session.key}-delete`}
          onClick={() => onAction(session, "delete")}
        />
      </div>
    </div>
  );
}

function SessionActionButton({
  active,
  danger,
  icon,
  label,
  loading,
  onClick,
}: {
  active?: boolean;
  danger?: boolean;
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
      style={{
        color: danger
          ? "#fca5a5"
          : active
            ? "var(--text-primary)"
            : "var(--text-secondary)",
        background: active ? "rgba(255, 255, 255, 0.04)" : "transparent",
      }}
      onClick={onClick}
      disabled={loading}
      title={label}
      aria-label={label}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

function ChatBubble({
  message,
  onReadAloud,
  onStopReading,
  onResumeReading,
  isReading,
  isReadPaused,
  textScale,
}: {
  message: ChatMessage;
  onReadAloud: (text: string, messageKey: string) => void;
  onStopReading: () => void;
  onResumeReading: () => void;
  isReading: boolean;
  isReadPaused: boolean;
  textScale: ChatTextScale;
}) {
  const isUser = message.role === "user";
  const isProactive = message.provenance === "proactive";
  const isStreaming = message.state === "delta";
  const messageKey = message.runId || message.id;
  const textContent = (
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n") || message.content
  ).trim();
  const orderedParts = message.parts?.length
    ? message.parts
    : textContent
      ? [{ type: "text", text: textContent } as const]
      : [];
  const proactiveLabel =
    isProactive && textContent.toLowerCase().startsWith("[action_taken]")
      ? "Action taken"
      : isProactive && textContent.toLowerCase().startsWith("[decision_needed]")
        ? "Needs decision"
        : "Proactive update";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: isUser
            ? "var(--primary, #3b82f6)"
            : isProactive
              ? "rgba(251, 191, 36, 0.16)"
              : "var(--border)",
          border: isProactive ? "1px solid rgba(251, 191, 36, 0.28)" : undefined,
        }}
      >
        {isUser ? (
          <User className="h-4 w-4" style={{ color: "var(--text-on-primary)" }} />
        ) : isProactive ? (
          <Sparkles className="h-4 w-4" style={{ color: "#fbbf24" }} />
        ) : (
          <Bot className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
        )}
      </div>
      <div className="min-w-0 max-w-full space-y-2 md:max-w-[78%]">
        {!isUser && isProactive ? (
          <div className="flex items-center gap-2">
            <span
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                borderColor: "rgba(251, 191, 36, 0.24)",
                background: "rgba(251, 191, 36, 0.08)",
                color: "#fbbf24",
              }}
            >
              {proactiveLabel}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              gateway-injected
            </span>
          </div>
        ) : null}
        {!isUser && textContent ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onReadAloud(textContent, messageKey)}
              className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Read
            </button>
            {isReading ? (
              <button
                type="button"
                onClick={onStopReading}
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/5"
                style={{ borderColor: "rgba(248, 113, 113, 0.24)", color: "#fca5a5" }}
              >
                Stop
              </button>
            ) : null}
            {isReadPaused ? (
              <button
                type="button"
                onClick={onResumeReading}
                className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/5"
                style={{ borderColor: "rgba(96, 165, 250, 0.24)", color: "#93c5fd" }}
              >
                Resume
              </button>
            ) : null}
          </div>
        ) : null}
        {isUser && textContent ? (
          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser ? "rounded-br-sm" : "rounded-bl-sm"
            }`}
            style={{
              background: isUser
                ? "var(--primary, #3b82f6)"
                : isProactive
                  ? "rgba(251, 191, 36, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
              color: isUser ? "var(--text-on-primary)" : "var(--text-primary)",
              borderColor: isUser
                ? undefined
                : isProactive
                  ? "rgba(251, 191, 36, 0.24)"
                  : "var(--border)",
              border: isUser ? undefined : "1px solid",
            }}
          >
            <MarkdownMessage content={textContent} isUser={isUser} textScale={textScale} />
            {isStreaming ? (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current opacity-60" />
            ) : null}
            {message.state === "error" ? (
              <div className="mt-2 text-xs opacity-70">Error generating response</div>
            ) : null}
          </div>
        ) : !isUser ? (
          <div className="space-y-2">
            {orderedParts.map((part, index) => (
              <AssistantPartCard
                key={`${message.id}-part-${index}`}
                part={part}
                isProactive={isProactive}
                isStreaming={isStreaming && index === orderedParts.length - 1 && part.type === "text"}
                textScale={textScale}
              />
            ))}
            {message.state === "error" ? (
              <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(248, 113, 113, 0.24)", color: "#fca5a5" }}>
                Error generating response
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AssistantPartCard({
  part,
  isProactive,
  isStreaming,
  textScale,
}: {
  part: ChatMessage["parts"][number];
  isProactive: boolean;
  isStreaming: boolean;
  textScale: ChatTextScale;
}) {
  if (part.type === "text") {
    return (
      <div
        className="rounded-2xl rounded-bl-sm border px-4 py-3"
        style={{
          background: isProactive ? "rgba(251, 191, 36, 0.08)" : "rgba(255, 255, 255, 0.03)",
          color: "var(--text-primary)",
          borderColor: isProactive ? "rgba(251, 191, 36, 0.24)" : "var(--border)",
        }}
      >
        <MarkdownMessage content={part.text} textScale={textScale} />
        {isStreaming ? (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current opacity-60" />
        ) : null}
      </div>
    );
  }

  if (part.type === "thinking") {
    return (
      <div
        className="rounded-2xl border px-4 py-3"
        style={{
          borderColor: "rgba(96, 165, 250, 0.2)",
          background: "rgba(59, 130, 246, 0.08)",
        }}
      >
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#93c5fd" }}>
          Reasoning
        </div>
        <div className="mt-2">
          <MarkdownMessage content={part.text} textScale={textScale} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
        {part.type === "tool-call" ? `Tool Call · ${part.name}` : `Tool Result · ${part.name}`}
      </div>
      {"args" in part && part.args ? (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/25 p-3 text-[12px] leading-relaxed whitespace-pre-wrap">
          {part.args}
        </pre>
      ) : null}
      {"text" in part && part.text ? (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-black/25 p-3 text-[12px] leading-relaxed whitespace-pre-wrap">
          {part.text}
        </pre>
      ) : null}
      {part.type === "tool-result" && !part.text ? (
        <div className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          Completed without textual output.
        </div>
      ) : null}
    </div>
  );
}

function MarkdownMessage({ content, isUser = false, textScale = "compact" }: { content: string; isUser?: boolean; textScale?: ChatTextScale }) {
  const normalized = content
    .replace(/^\[action_taken\]\s*/i, "")
    .replace(/^\[decision_needed\]\s*/i, "")
    .trim();
  return (
    <div
      className={`openclaw-markdown ${textScale === "comfortable" ? "text-[15px] leading-8" : "text-[13px] leading-6"} ${isUser ? "font-semibold" : ""}`}
      style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-white/30 underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => (
            <code
              className={`rounded-md bg-black/20 px-1.5 py-0.5 font-mono text-[0.85em] ${className ?? ""}`}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-xl bg-black/25 p-3 text-[0.85em] last:mb-0">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-white/15 pl-4 italic last:mb-0">
              {children}
            </blockquote>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

function AgentRosterRow({
  card,
  onSelectSession,
}: {
  card: AgentRosterCard;
  onSelectSession: (key: string) => void;
}) {
  return <AgentRosterCardView card={card} onOpenSession={onSelectSession} />;
}

function WorkerGroupRow({ group, activeSessionKey, actionLoading, onAction, onSelectSession }: { group: ReturnType<typeof buildCommandChatView>["backgroundGroups"][number]; activeSessionKey: string; actionLoading: string | null; onAction: (session: SessionSummary, action: "delete" | "reset" | "compact") => void; onSelectSession: (key: string) => void; }) {
  return (
    <details className="rounded-2xl border" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.02)" }}>
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{group.label}</div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{group.sessions.length} session{group.sessions.length === 1 ? "" : "s"} · {group.latestSummary}</div>
          </div>
          <div className="text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--text-secondary)" }}>{group.status}</div>
        </div>
      </summary>
      <div className="border-t px-3 py-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <SessionSection title="Sessions" sessions={group.sessions} activeSessionKey={activeSessionKey} actionLoading={actionLoading} onAction={onAction} onSelect={onSelectSession} />
      </div>
    </details>
  );
}

function formatTimeAgo(ts: number | string): string {
  const date = typeof ts === "number" ? ts : new Date(ts).getTime();
  const now = Date.now();
  const diff = now - date;
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function toSpokenPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_~#>-]+/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const [, base64 = ""] = result.split(",", 2);
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
