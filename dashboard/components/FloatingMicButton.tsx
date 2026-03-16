"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Mic, MicOff, MessageSquare, Type } from "lucide-react";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { VoiceTranscriptPreview } from "./VoiceTranscriptPreview";
import {
  type VoiceChatMode,
  VOICE_CHAT_EVENT,
  VOICE_PENDING_MESSAGE_KEY,
  readVoiceAutoSend,
  readVoiceChatMode,
  writeVoiceChatMode,
} from "@/lib/voice-chat";

export function FloatingMicButton() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<VoiceChatMode>("chat");
  const [showMenu, setShowMenu] = useState(false);
  const hideOnChat = pathname.startsWith("/chat");

  useEffect(() => {
    setMounted(true);
    setMode(readVoiceChatMode());
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    writeVoiceChatMode(mode);
  }, [mode, mounted]);

  const {
    isListening,
    isSupported,
    transcript,
    finalTranscript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
  } = useSpeechToText({
    continuous: true,
    interimResults: true,
    onResult: (text, isFinal) => {
      if (isFinal && mode === "inject") {
        injectIntoFocusedInput(text);
      }
    },
  });

  useEffect(() => {
    if (!mounted || mode !== "chat" || !pathname.startsWith("/chat") || !isListening) {
      return;
    }

    const combined = `${finalTranscript} ${interimTranscript}`.trim();
    window.dispatchEvent(
      new CustomEvent(VOICE_CHAT_EVENT, {
        detail: { text: combined, autoSend: false, draft: true },
      }),
    );
  }, [finalTranscript, interimTranscript, isListening, mode, mounted, pathname]);

  // Inject transcript into the currently focused input element
  const injectIntoFocusedInput = useCallback((text: string) => {
    const el = document.activeElement;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement
    ) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const spacer = before && !before.endsWith(" ") ? " " : "";

      // Use native input setter to trigger React onChange
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value"
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, before + spacer + text + after);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        el.value = before + spacer + text + after;
      }

      el.selectionStart = el.selectionEnd = start + spacer.length + text.length;
    } else if (el?.getAttribute("contenteditable") === "true") {
      document.execCommand("insertText", false, text);
    }
  }, []);

  // Toggle listening
  const toggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  // Keyboard shortcut: Cmd+Shift+M
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && e.key === "m") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  // Handle send to chat (stubbed - will connect to Aegilume agent)
  const handleSendToChat = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(VOICE_PENDING_MESSAGE_KEY, trimmed);
        window.dispatchEvent(
          new CustomEvent(VOICE_CHAT_EVENT, {
            detail: { text: trimmed, autoSend: readVoiceAutoSend() },
          }),
        );
        if (!pathname.startsWith("/chat")) {
          window.location.href = "/chat";
        }
      }
      resetTranscript();
    },
    [pathname, resetTranscript]
  );

  if (!mounted || !isSupported || hideOnChat) return null;

  return (
    <>
      {/* Transcript Preview */}
      <VoiceTranscriptPreview
        interimTranscript={interimTranscript}
        finalTranscript={finalTranscript}
        isListening={isListening}
        mode={mode}
        onSendToChat={handleSendToChat}
        onDismiss={() => {
          stopListening();
          resetTranscript();
        }}
      />

      {/* Mode toggle (shows on long-press or right-click) */}
      {showMenu && (
        <div
          className="
            fixed right-3 z-50 bottom-[calc(env(safe-area-inset-bottom)+6.1rem)] md:bottom-[5rem]
            rounded-lg border shadow-xl overflow-hidden
            animate-in slide-in-from-bottom-1 fade-in duration-150
            max-md:hidden
          "
          style={{
            background: "var(--card, #131d33)",
            borderColor: "var(--border, #2a2a4a)",
          }}
        >
          <button
            onClick={() => { setMode("inject"); setShowMenu(false); }}
            className={`flex items-center gap-2 px-3 py-2 w-full text-left text-sm hover:bg-white/5 transition-colors ${
              mode === "inject" ? "text-blue-400" : ""
            }`}
            style={{ color: mode === "inject" ? undefined : "var(--text-secondary, #888)" }}
          >
            <Type className="w-4 h-4" />
            Inject into input
          </button>
          <button
            onClick={() => { setMode("chat"); setShowMenu(false); }}
            className={`flex items-center gap-2 px-3 py-2 w-full text-left text-sm hover:bg-white/5 transition-colors ${
              mode === "chat" ? "text-blue-400" : ""
            }`}
            style={{ color: mode === "chat" ? undefined : "var(--text-secondary, #888)" }}
          >
            <MessageSquare className="w-4 h-4" />
            Send to chat
          </button>
        </div>
      )}

      {/* Main mic button */}
      <button
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
        }}
        className={`
          fixed right-3 z-50 bottom-28 md:bottom-6
          h-9 w-9 md:h-10 md:w-10 rounded-2xl
          flex items-center justify-center
          shadow-lg backdrop-blur transition-all duration-200
          ${isListening
            ? "bg-red-500 hover:bg-red-600 ring-4 ring-red-500/30 animate-pulse"
            : "bg-blue-600/92 hover:bg-blue-700 opacity-70 hover:opacity-100"
          }
        `}
        title={`${isListening ? "Stop" : "Start"} voice input (⌘⇧M)`}
      >
        {isListening ? (
          <MicOff className="h-[18px] w-[18px] text-white md:h-5 md:w-5" />
        ) : (
          <Mic className="h-[18px] w-[18px] text-white md:h-5 md:w-5" />
        )}
      </button>
    </>
  );
}
