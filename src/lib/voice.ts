/**
 * OROM's voice, behind two small adapters so the speech provider can change without
 * touching the assistant: SpeechInput (dictation) and SpeechOutput (spoken replies). The
 * implementations here use the browser's own Web Speech API — free, no audio leaves the
 * device for synthesis, and recognition runs only while the microphone button is on.
 *
 * What browsers allow, plainly: no background wake word ("Hey OROM") — a page cannot
 * listen while closed or hidden, and continuous listening would mean recording the room.
 * Instead, "conversation mode" re-opens the microphone after each spoken reply, only while
 * the page is open and only once the user has turned it on; the mic is always visibly on.
 */

export type VoiceState = "idle" | "permission" | "listening" | "transcribing" | "processing" | "executing" | "speaking" | "interrupted" | "cancelled" | "error";

export const VOICE_LABEL: Record<VoiceState, string> = {
  idle: "Prêt",
  permission: "Autorise le micro…",
  listening: "Je t'écoute…",
  transcribing: "Je transcris…",
  processing: "Je réfléchis…",
  executing: "J'exécute…",
  speaking: "Je réponds…",
  interrupted: "Interrompu",
  cancelled: "Annulé",
  error: "Erreur",
};

export interface VoicePrefs {
  /** Recognition and synthesis language. */
  locale: string;
  /** Speaking rate, 0.7–1.4. */
  rate: number;
  /** A device voice by name, or the best one for the locale. */
  voice: string | null;
  /** Re-open the microphone after each spoken reply (while the page is open). */
  conversation: boolean;
  /** Also speak replies to typed requests. */
  speakTyped: boolean;
}

export const LOCALES = [
  { id: "fr-CA", label: "Français (Canada)" },
  { id: "fr-FR", label: "Français (France)" },
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
];

export const DEFAULT_VOICE: VoicePrefs = { locale: "fr-CA", rate: 1.05, voice: null, conversation: false, speakTyped: false };

const KEY = "orom-voice-prefs";
/** The older "speak replies" switch, kept so existing devices keep their choice. */
const LEGACY = "aurum-voice";

export function loadVoicePrefs(): VoicePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<VoicePrefs> | null;
    const legacy = localStorage.getItem(LEGACY) === "on";
    return sanitizeVoicePrefs({ ...DEFAULT_VOICE, speakTyped: legacy, ...(raw ?? {}) });
  } catch {
    return DEFAULT_VOICE;
  }
}

export function saveVoicePrefs(p: VoicePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeVoicePrefs(p)));
    localStorage.setItem(LEGACY, p.speakTyped ? "on" : "off");
  } catch {}
}

export function sanitizeVoicePrefs(p: Partial<VoicePrefs>): VoicePrefs {
  return {
    locale: LOCALES.some((l) => l.id === p.locale) ? p.locale! : DEFAULT_VOICE.locale,
    rate: typeof p.rate === "number" && Number.isFinite(p.rate) ? Math.min(1.4, Math.max(0.7, p.rate)) : DEFAULT_VOICE.rate,
    voice: typeof p.voice === "string" && p.voice ? p.voice.slice(0, 120) : null,
    conversation: !!p.conversation,
    speakTyped: !!p.speakTyped,
  };
}

/** What a recognition error means for the user, in words. Null: nothing to say. */
export function recognitionError(code: string): string | null {
  const messages: Record<string, string> = {
    "not-allowed": "Autorise le micro pour dicter (réglages du navigateur), ou écris ta demande.",
    "service-not-allowed": "La dictée n'est pas autorisée sur cet appareil : écris ta demande.",
    "no-speech": "Je n'ai rien entendu.",
    "audio-capture": "Aucun micro détecté : branche-en un ou écris ta demande.",
    network: "La reconnaissance vocale demande une connexion : écris ta demande ou réessaie.",
    "language-not-supported": "La dictée dans cette langue n'est pas disponible ici : écris ta demande.",
  };
  if (code === "aborted") return null;
  return messages[code] ?? "La dictée s'est interrompue : réessaie ou écris ta demande.";
}

// ---- Speech input -------------------------------------------------------------------

export interface ListenHandlers {
  onText: (text: string, final: boolean) => void;
  onEnd: (finalText: string) => void;
  onError: (code: string) => void;
}

export interface Listening {
  /** Stop and use what was heard. */
  stop(): void;
  /** Stop and throw it away. */
  abort(): void;
}

export interface SpeechInput {
  supported(): boolean;
  listen(locale: string, handlers: ListenHandlers, silenceMs?: number): Listening;
}

// The Web Speech API is still prefixed in Safari and Chrome and absent from the DOM types.
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;
const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const webSpeechInput: SpeechInput = {
  supported: () => !!recognitionCtor(),
  listen(locale, handlers, silenceMs = 2000) {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      handlers.onError("service-not-allowed");
      return { stop() {}, abort() {} };
    }
    const r = new Ctor();
    r.lang = locale;
    r.interimResults = true;
    // Keep listening through pauses between words; stop after a silence.
    r.continuous = true;
    let finalText = "";
    let aborted = false;
    let silence: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (silence) clearTimeout(silence);
      silence = setTimeout(() => r.stop(), silenceMs);
    };
    arm();
    r.onresult = (e) => {
      arm();
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      handlers.onText((finalText + interim).trim(), !interim);
    };
    r.onerror = (e) => handlers.onError(e.error);
    r.onend = () => {
      if (silence) clearTimeout(silence);
      handlers.onEnd(aborted ? "" : finalText.trim());
    };
    r.start();
    return {
      stop: () => r.stop(),
      abort: () => {
        aborted = true;
        r.abort();
      },
    };
  },
};

// ---- Speech output ------------------------------------------------------------------

export interface SpeechOutput {
  supported(): boolean;
  voices(locale: string): { name: string; lang: string }[];
  speak(text: string, prefs: VoicePrefs, onEnd?: () => void): void;
  cancel(): void;
}

export const webSpeechOutput: SpeechOutput = {
  supported: () => typeof window !== "undefined" && "speechSynthesis" in window,
  voices(locale) {
    if (!this.supported()) return [];
    const lang = locale.slice(0, 2);
    return window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang.startsWith(lang))
      .map((v) => ({ name: v.name, lang: v.lang }));
  },
  speak(text, prefs, onEnd) {
    if (!this.supported() || !text) {
      onEnd?.();
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    u.voice = voices.find((v) => v.name === prefs.voice) ?? voices.find((v) => v.lang === prefs.locale) ?? voices.find((v) => v.lang.startsWith(prefs.locale.slice(0, 2))) ?? null;
    u.lang = u.voice?.lang ?? prefs.locale;
    u.rate = prefs.rate;
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    synth.speak(u);
  },
  cancel() {
    if (this.supported()) window.speechSynthesis.cancel();
  },
};

/** The microphone permission as the browser reports it, when it does. */
export async function micPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

/** A long answer is shown in full but spoken short: its first sentences. */
export function spokenSummary(text: string, max = 260): string {
  if (text.length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > max) break;
    out += s;
  }
  return (out || text.slice(0, max)).trim() + " Le détail est à l'écran.";
}
