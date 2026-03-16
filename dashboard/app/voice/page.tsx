"use client";

import { useState, useEffect } from "react";
import { DashboardScreenLayout } from "@/components/DashboardScreenLayout";
import { useOpenClawTTS } from "@/hooks/use-openclaw-tts";
import { useOpenClaw } from "@/contexts/OpenClawContext";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import {
  readVoiceAutoSend,
  readVoiceAutoSpeak,
  readVoiceChatMode,
  writeVoiceAutoSend,
  writeVoiceAutoSpeak,
  writeVoiceChatMode,
} from "@/lib/voice-chat";
import {
  Mic,
  Volume2,
  VolumeX,
  RefreshCw,
  Loader2,
  Play,
  Check,
  AlertCircle,
  Square,
} from "lucide-react";

type Tab = "tts" | "stt" | "talk";

export default function OpenClawVoicePage() {
  const [tab, setTab] = useState<Tab>("tts");

  return (
    <DashboardScreenLayout
      screenKey="voice"
      renderers={{
        "voice.workspace": () => (
          <section
            className="min-w-0 rounded-2xl border p-5"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div>
              <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                Voice workspace
              </h2>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                Text-to-speech, speech recognition, and talk mode settings
              </p>
            </div>

            <div className="mt-5 flex gap-1 p-1 rounded-lg" style={{ background: "var(--background)" }}>
              {(["tts", "stt", "talk"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === t ? "bg-blue-600 text-white" : ""
                  }`}
                  style={tab !== t ? { color: "var(--text-secondary)" } : undefined}
                >
                  {t === "tts" ? "Text-to-Speech" : t === "stt" ? "Speech-to-Text" : "Talk Mode"}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {tab === "tts" ? <TTSSettings /> : null}
              {tab === "stt" ? <STTSettings /> : null}
              {tab === "talk" ? <TalkModeSettings /> : null}
            </div>
          </section>
        ),
      }}
    />
  );
}

function TTSSettings() {
  const { status, providers, loading, error, enable, disable, setProvider, convert } =
    useOpenClawTTS();
  const [testText, setTestText] = useState("Hello, I am Aegilume, your personal AI assistant.");
  const [converting, setConverting] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const activeProviderId = (status as any)?.provider ?? "edge";
  const activeProvider =
    providers.find((provider) => provider.id === activeProviderId) ?? providers.find((provider) => provider.configured);
  const activeVoice = (status as any)?.voice ?? "";

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.src = "";
      }
    };
  }, [audioEl]);

  const handleTest = async () => {
    if (!testText.trim()) return;
    setConverting(true);
    setPlayError(null);

    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }

    // Stop any currently playing audio
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
    }

    try {
      const result = await convert(testText) as any;

      if (result?.audioPath) {
        // Gateway returned a file path - proxy through our API route
        const url = `/api/tts-audio?path=${encodeURIComponent(result.audioPath)}`;
        const audio = new Audio(url);
        setAudioEl(audio);

        audio.onended = () => setConverting(false);
        audio.onerror = () => {
          setPlayError("Failed to play audio from gateway. Trying browser fallback...");
          // Fallback to browser speechSynthesis
          playBrowserTTS(testText);
          setConverting(false);
        };

        await audio.play();
        return; // audio.onended will reset converting
      }

      if (result?.audio) {
        // Base64 audio
        const audio = new Audio(`data:audio/mp3;base64,${result.audio}`);
        setAudioEl(audio);
        audio.onended = () => setConverting(false);
        await audio.play();
        return;
      }

      // No audio returned - use browser fallback
      playBrowserTTS(testText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "TTS failed";
      setPlayError(msg + ". Using browser TTS fallback.");
      playBrowserTTS(testText);
    } finally {
      setConverting(false);
    }
  };

  const handleStop = () => {
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
    }
    speechSynthesis.cancel();
    setConverting(false);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div
        className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          {status?.enabled ? (
            <Volume2 className="w-5 h-5 text-green-500" />
          ) : (
            <VolumeX className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          )}
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Text-to-Speech
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {status?.enabled
                ? `Enabled — provider: ${(status as any).provider ?? "default"}`
                : "Disabled"}
            </p>
          </div>
        </div>
        <button
          onClick={status?.enabled ? disable : enable}
          disabled={loading}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            status?.enabled
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
          }`}
        >
          {status?.enabled ? "Disable" : "Enable"}
        </button>
      </div>

      {/* Providers */}
      {providers.length > 0 && (
        <div
          className="p-4 rounded-xl border space-y-3"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Providers
          </h3>
          {providers.map((p) => {
            const isActive = (status as any)?.provider === p.id;
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-lg px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: "var(--background)" }}
              >
                <div className="min-w-0 flex items-center gap-2">
                  {isActive && <Check className="w-4 h-4 text-green-500" />}
                  <div className="min-w-0">
                    <span className="block truncate text-sm" style={{ color: "var(--text-primary)" }}>
                      {p.name}
                    </span>
                    <span
                      className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                        p.configured
                          ? "bg-green-500/10 text-green-500"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {p.configured ? "configured" : "not configured"}
                    </span>
                  </div>
                </div>
                {!isActive && p.configured && (
                  <button
                    onClick={() => setProvider(p.id)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Select
                  </button>
                )}
              </div>
            );
          })}

          <div className="grid gap-3 pt-2 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                Active provider
              </span>
              <select
                value={activeProviderId}
                onChange={(event) => {
                  const nextProvider = providers.find((provider) => provider.id === event.target.value);
                  void setProvider(
                    event.target.value,
                    nextProvider?.voices?.[0] && nextProvider.id !== activeProviderId
                      ? nextProvider.voices[0]
                      : undefined,
                  );
                }}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id} disabled={!provider.configured}>
                    {provider.name}{provider.configured ? "" : " (needs key)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.16em]" style={{ color: "var(--text-secondary)" }}>
                Voice
              </span>
              <select
                value={activeVoice || activeProvider?.voices?.[0] || ""}
                onChange={(event) => void setProvider(activeProviderId, event.target.value)}
                disabled={!activeProvider?.voices || activeProvider.voices.length === 0}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none disabled:opacity-50"
                style={{
                  background: "var(--background)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {activeProvider?.voices && activeProvider.voices.length > 0 ? (
                  activeProvider.voices.map((voice) => (
                    <option key={voice} value={voice}>
                      {voice}
                    </option>
                  ))
                ) : (
                  <option value="">No voice list exposed for this provider</option>
                )}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* Test TTS */}
      <div
        className="p-4 rounded-xl border space-y-3"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Test TTS
        </h3>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border bg-transparent text-sm outline-none resize-none"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={converting ? handleStop : handleTest}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              converting
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {converting ? (
              <>
                <Square className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Play
              </>
            )}
          </button>
          <button
            onClick={() => playBrowserTTS(testText)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: "var(--text-secondary)", background: "var(--background)" }}
            title="Use browser built-in speech synthesis"
          >
            <Volume2 className="w-4 h-4" />
            Browser TTS
          </button>
        </div>
        {playError && (
          <p className="text-xs text-yellow-500">{playError}</p>
        )}
      </div>
    </div>
  );
}

function playBrowserTTS(text: string) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
}

function STTSettings() {
  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error,
  } = useSpeechToText();

  return (
    <div className="space-y-4">
        <div
          className="p-4 rounded-xl border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Mic
              className={`w-5 h-5 ${isListening ? "text-red-500 animate-pulse" : ""}`}
              style={!isListening ? { color: "var(--text-secondary)" } : undefined}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Speech Recognition
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {isSupported
                  ? "Browser Web Speech API (works offline)"
                  : "Not supported in this browser — use Chrome or Edge"}
              </p>
            </div>
          </div>
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={!isSupported}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isListening
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-blue-600 text-white hover:bg-blue-700"
            } disabled:opacity-50`}
          >
            {isListening ? "Stop" : "Start Listening"}
          </button>
        </div>

        {/* Live transcript */}
        <div
          className="min-h-[120px] p-4 rounded-lg text-sm leading-relaxed"
          style={{ background: "var(--background)", color: "var(--text-primary)" }}
        >
          {transcript}
          {interimTranscript && (
            <span style={{ color: "var(--text-secondary)" }}>{interimTranscript}</span>
          )}
          {!transcript && !interimTranscript && (
            <span className="italic" style={{ color: "var(--text-secondary)" }}>
              {isListening
                ? "Listening... speak now"
                : "Click \"Start Listening\" and speak into your microphone"}
            </span>
          )}
        </div>

        {transcript && (
          <button
            onClick={resetTranscript}
            className="mt-3 text-xs text-blue-400 hover:text-blue-300"
          >
            Clear transcript
          </button>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}

function TalkModeSettings() {
  const { rpc, isConnected } = useOpenClaw();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatMicMode, setChatMicMode] = useState<"inject" | "chat">("chat");
  const [autoSendVoice, setAutoSendVoice] = useState(false);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState(false);

  // Load initial state
  useEffect(() => {
    if (!isConnected) return;
    rpc("talk.config").then((r: any) => {
      if (r?.config?.enabled) setEnabled(true);
    }).catch(() => {});
  }, [isConnected, rpc]);

  useEffect(() => {
    setChatMicMode(readVoiceChatMode());
    setAutoSendVoice(readVoiceAutoSend());
    setAutoSpeakReplies(readVoiceAutoSpeak());
  }, []);

  const toggleTalkMode = async () => {
    setLoading(true);
    try {
      await rpc("talk.mode", { enabled: !enabled });
      setEnabled(!enabled);
    } catch (err) {
      console.error("Failed to toggle talk mode:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Talk Mode
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Enable continuous voice conversation with Aegilume (STT + TTS loop)
          </p>
        </div>
        <button
          onClick={toggleTalkMode}
          disabled={loading || !isConnected}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            enabled
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : enabled ? (
            "Disable"
          ) : (
            "Enable"
          )}
        </button>
      </div>

      <div
        className="p-4 rounded-xl border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label
            className="flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Mic behavior
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Choose whether voice goes straight to chat or just fills the current input.
              </p>
            </div>
            <select
              value={chatMicMode}
              onChange={(event) => {
                const nextMode = event.target.value === "inject" ? "inject" : "chat";
                setChatMicMode(nextMode);
                writeVoiceChatMode(nextMode);
              }}
              className="rounded-lg border px-2 py-1 text-sm outline-none"
              style={{
                background: "var(--card)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              <option value="chat">Send to chat</option>
              <option value="inject">Inject into input</option>
            </select>
          </label>

          <label
            className="flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Auto-send voice
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                When mic mode is chat, send the finished transcript immediately instead of leaving it in the composer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !autoSendVoice;
                setAutoSendVoice(next);
                writeVoiceAutoSend(next);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                autoSendVoice
                  ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10"
              }`}
            >
              {autoSendVoice ? "On" : "Off"}
            </button>
          </label>

          <label
            className="flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Speak replies in chat
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Read assistant final responses aloud automatically in the active chat session. Turn this off for text-only chat.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !autoSpeakReplies;
                setAutoSpeakReplies(next);
                writeVoiceAutoSpeak(next);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                autoSpeakReplies
                  ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10"
              }`}
            >
              {autoSpeakReplies ? "On" : "Off"}
            </button>
          </label>
        </div>

        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Talk mode activates a continuous loop: your microphone listens for speech,
          sends it to the agent, and plays back the response via TTS. Requires both STT
          and TTS to be configured. The dashboard/PWA path now supports browser voice chat;
          the native apps and CLI (<code className="font-mono">openclaw talk</code>) still
          remain the stronger low-latency option for always-on conversation.
        </p>
      </div>
    </div>
  );
}
