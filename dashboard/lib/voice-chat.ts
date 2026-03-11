export type VoiceChatMode = "inject" | "chat";

export const VOICE_CHAT_EVENT = "openclaw:voice-chat-send";
export const VOICE_PENDING_MESSAGE_KEY = "openclaw.voice.pending-message";
export const VOICE_CHAT_MODE_KEY = "openclaw.voice.chat.mode";
export const VOICE_CHAT_AUTOSPEAK_KEY = "openclaw.voice.chat.auto-speak";
export const VOICE_CHAT_AUTOSEND_KEY = "openclaw.voice.chat.auto-send";
export const VOICE_SESSION_AUTOSPEAK_PREFIX = "openclaw.voice.session.auto-speak.";
export const VOICE_SESSION_TALK_PREFIX = "openclaw.voice.session.talk.";

export function readVoiceChatMode(): VoiceChatMode {
  if (typeof window === "undefined") {
    return "chat";
  }
  const value = window.localStorage.getItem(VOICE_CHAT_MODE_KEY);
  return value === "inject" ? "inject" : "chat";
}

export function writeVoiceChatMode(mode: VoiceChatMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(VOICE_CHAT_MODE_KEY, mode);
}

export function readVoiceAutoSpeak(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const value = window.localStorage.getItem(VOICE_CHAT_AUTOSPEAK_KEY);
  return value == null ? false : value === "true";
}

export function writeVoiceAutoSpeak(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(VOICE_CHAT_AUTOSPEAK_KEY, String(enabled));
}

export function readVoiceAutoSend(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const value = window.localStorage.getItem(VOICE_CHAT_AUTOSEND_KEY);
  return value == null ? false : value === "true";
}

export function writeVoiceAutoSend(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(VOICE_CHAT_AUTOSEND_KEY, String(enabled));
}

export function speakWithBrowser(text: string, voiceName?: string | null) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.rate = 1;
  utterance.pitch = 1;
  if (voiceName) {
    const match = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.name === voiceName);
    if (match) {
      utterance.voice = match;
    }
  }
  window.speechSynthesis.speak(utterance);
  return true;
}

export async function speakWithBrowserAsync(text: string, voiceName?: string | null) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.rate = 1;
  utterance.pitch = 1;
  if (voiceName) {
    const match = window.speechSynthesis.getVoices().find((voice) => voice.name === voiceName);
    if (match) {
      utterance.voice = match;
    }
  }

  return await new Promise<boolean>((resolve) => {
    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);
    window.speechSynthesis.speak(utterance);
  });
}

export function stopBrowserSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
}

function sessionAutoSpeakKey(sessionKey: string) {
  return `${VOICE_SESSION_AUTOSPEAK_PREFIX}${sessionKey}`;
}

function sessionTalkKey(sessionKey: string) {
  return `${VOICE_SESSION_TALK_PREFIX}${sessionKey}`;
}

export function readSessionVoiceAutoSpeak(sessionKey: string) {
  if (typeof window === "undefined") {
    return false;
  }
  const value = window.localStorage.getItem(sessionAutoSpeakKey(sessionKey));
  return value == null ? readVoiceAutoSpeak() : value === "true";
}

export function writeSessionVoiceAutoSpeak(sessionKey: string, enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(sessionAutoSpeakKey(sessionKey), String(enabled));
}

export function readSessionTalkMode(sessionKey: string) {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(sessionTalkKey(sessionKey)) === "true";
}

export function writeSessionTalkMode(sessionKey: string, enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(sessionTalkKey(sessionKey), String(enabled));
}
