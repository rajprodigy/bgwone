import type { Message } from "./gemini";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

export interface UploadedFileState {
  name: string;
  base64: string;
  extractedText?: string;
  pdfUrl?: string;
  pdfSize?: number;
}

export const CHAT_SESSIONS_STORAGE_KEY = "_gita_chat_sessions_v1";
export const DEFAULT_GITA_DESCRIPTION =
  "The Bhagavad Gita is a 700-verse Hindu scripture that is part of the epic Mahabharata. It features a dialog between Pandava prince Arjuna and his guide and charioteer Lord Krishna, imparting teachings on selfless duty (Karma Yoga), devotion (Bhakti Yoga), knowledge (Jnana Yoga), and attaining absolute inner peace.";

export interface LanguageOption {
  value: string;
  label: string;
}

const LANGUAGE_DEFINITIONS: readonly LanguageOption[] = [
  { value: "English", label: "English" },
  { value: "Hindi", label: "हिन्दी (Hindi)" },
  { value: "Spanish", label: "Español (Spanish)" },
  { value: "Sanskrit", label: "संस्कृतम् (Sanskrit)" },
  { value: "French", label: "Français (French)" },
  { value: "German", label: "Deutsch (German)" },
  { value: "Telugu", label: "తెలుగు (Telugu)" },
  { value: "Tamil", label: "தமிழ் (Tamil)" },
  { value: "Bengali", label: "বাংলা (Bengali)" },
  { value: "Marathi", label: "मराठी (Marathi)" },
  { value: "Gujarati", label: "ગુજરાતી (Gujarati)" },
  { value: "Kannada", label: "ಕನ್ನಡ (Kannada)" },
  { value: "Malayalam", label: "മലയാളം (Malayalam)" },
];

export function getLanguageOptions(): LanguageOption[] {
  return [...LANGUAGE_DEFINITIONS];
}

export const SPEECH_LANGUAGE_MAP: Record<string, string> = {
  English: "en-US",
  Hindi: "hi-IN",
  Spanish: "es-ES",
  Sanskrit: "en-US",
  French: "fr-FR",
  German: "de-DE",
  Telugu: "te-IN",
  Tamil: "ta-IN",
  Bengali: "bn-IN",
  Marathi: "mr-IN",
  Gujarati: "gu-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
};

export const SPEECH_VOICE_LANGUAGE_MAP: Record<string, string> = {
  English: "en-US",
  Hindi: "hi-IN",
  Spanish: "es-ES",
  Sanskrit: "hi-IN",
  French: "fr-FR",
  German: "de-DE",
  Telugu: "te-IN",
  Tamil: "ta-IN",
  Bengali: "bn-IN",
  Marathi: "mr-IN",
  Gujarati: "gu-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
};

export const DEFAULT_GREETING =
  "Peace be with you. The Bhagavad Gita scripture is active and ready to guide you. How can I help you navigate the battles of your life today?";

export function createDefaultFileState(overrides: Partial<UploadedFileState> = {}): UploadedFileState {
  return {
    name: "Bhagavad Gita (Divine Wisdom Guide)",
    base64: "",
    extractedText: DEFAULT_GITA_DESCRIPTION,
    pdfUrl: "",
    pdfSize: 0,
    ...overrides,
  };
}

export function loadSessionsFromLocalStorage(): ChatSession[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const data = window.localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
      if (data) return JSON.parse(data) as ChatSession[];
    }
  } catch (e) {
    console.warn("localStorage read failed:", e);
  }
  return [];
}

export function saveSessionsToLocalStorage(sessions: ChatSession[]) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

export function createSession(options: { id?: string; title?: string; messages?: Message[]; greeting?: string } = {}): ChatSession {
  const greeting = options.greeting ?? DEFAULT_GREETING;
  return {
    id: options.id ?? Math.random().toString(36).substring(2, 9),
    title: options.title ?? "New Guidance",
    messages: options.messages ?? [{ role: "model", content: greeting }],
    updatedAt: new Date().toISOString(),
  };
}

export function updateSessionTitle(session: ChatSession, userMessage: string): ChatSession {
  const isNewChat = session.title === "New Guidance" || session.title === "First Consult";
  const newTitle = isNewChat
    ? userMessage.length > 25
      ? `${userMessage.substring(0, 25).trim()}...`
      : userMessage
    : session.title;

  return {
    ...session,
    title: newTitle,
    updatedAt: new Date().toISOString(),
  };
}

export function getSpeechLanguageCode(language: string): string {
  return SPEECH_LANGUAGE_MAP[language] ?? "en-US";
}

export function getSpeechVoiceLanguage(language: string): string {
  return SPEECH_VOICE_LANGUAGE_MAP[language] ?? "en-US";
}

export function cleanSpeechText(text: string): string {
  return text.replace(/[*#`_\-]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
}
