"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, Check, Clock, Mic, PencilLine, Plus, Sparkles, Trash2, Undo2, Volume2, VolumeX, X } from "lucide-react";
import { commandAction, undoCommandAction, type Choice, type Undo } from "@/server/actions/capture.actions";
import { parseCapture } from "@/lib/capture";
import { intentsOf, isDeadline, parseIntent, splitCommands } from "@/lib/command";
import { AREAS, areaByKey } from "@/lib/task-areas";
import { toISODate } from "@/lib/dates";
import { expectLanding } from "@/components/layout/LandWatcher";

const EXAMPLES = [
  "muscu samedi à 10h pendant 1h",
  "décale la séance de samedi 10h à 11h",
  "appeler maman ce soir",
  "repousse la réunion d'une heure",
  "rendre le rapport vendredi 17h",
  "supprime le dentiste de mardi",
  "courses samedi",
];

const dayName = (iso: string, today: string) => {
  if (iso === today) return "Aujourd'hui";
  const diff = Math.round((new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000);
  if (diff === 1) return "Demain";
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));
};
const fr = (t: string) => t.replace(/^0/, "").replace(":00", " h").replace(":", " h ");

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

/** Read a reply aloud with the device's own French voice: free, offline on iPhone and Mac. */
function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  u.voice = voices.find((v) => v.lang === "fr-CA") ?? voices.find((v) => v.lang.startsWith("fr")) ?? null;
  u.lang = u.voice?.lang ?? "fr-CA";
  u.rate = 1.05;
  synth.speak(u);
}

interface Toast {
  text: string;
  undo: Undo | null;
  error?: boolean;
}

/**
 * The gold "+" on every page, and the microphone above it. Say or type what you want in
 * plain French — add, move, delete or rename — see how it was understood, and it is done.
 * Every change can be undone from the confirmation. Also opens with N or ⌘K.
 */
export function QuickCapture() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The last exchanges, so "et à 19h plutôt" follows on from what was just said.
  const history = useRef<{ role: "user" | "assistant"; text: string }[]>([]);
  const spoken = useRef(false);
  const [voice, setVoice] = useState(false);
  const [text, setText] = useState("");
  const [section, setSection] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [choices, setChoices] = useState<{ question: string; list: Choice[] } | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const rec = useRef<Recognition | null>(null);
  const [example, setExample] = useState(0);
  const today = useMemo(() => toISODate(new Date()), []);

  const multi = useMemo(() => {
    const parts = text.trim() ? splitCommands(text) : [];
    return parts.length > 1 ? intentsOf(parts) : null;
  }, [text]);
  const intent = useMemo(() => (text.trim() && !multi ? parseIntent(text) : null), [text, multi]);
  const parsed = useMemo(() => (text.trim() && intent?.kind === "create" ? parseCapture(text, today) : null), [text, intent, today]);
  const target = useMemo(() => (intent?.kind === "move" && intent.target ? parseCapture(intent.target, today) : null), [intent, today]);
  const key = section ?? (parsed ? `${parsed.area}:${parsed.sub}` : null);
  const area = key ? areaByKey(key.split(":")[0]) : null;
  const sub = area?.subs.find((s) => s.key === key?.split(":")[1]);

  useEffect(() => {
    const t = setTimeout(() => {
      setCanListen(!!recognitionCtor());
      try {
        setVoice(localStorage.getItem("aurum-voice") === "on");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  // Sections ask through events: open with a sentence (and run it), or start listening.
  const listenRef = useRef<() => void>(() => {});
  const runRef = useRef<(t: string) => void>(() => {});
  useEffect(() => {
    const onAsk = (e: Event) => {
      const { text: t, run: go } = (e as CustomEvent<{ text: string; run: boolean }>).detail;
      setOpen(true);
      setText(t);
      setAnswer(null);
      if (go) runRef.current(t);
    };
    const onListen = () => listenRef.current();
    window.addEventListener("aurum:ask", onAsk);
    window.addEventListener("aurum:listen", onListen);
    return () => {
      window.removeEventListener("aurum:ask", onAsk);
      window.removeEventListener("aurum:listen", onListen);
    };
  }, []);
  const toggleVoice = () =>
    setVoice((v) => {
      try {
        localStorage.setItem("aurum-voice", v ? "off" : "on");
      } catch {}
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "n" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        rec.current?.abort();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const t = setInterval(() => setExample((i) => (i + 1) % EXAMPLES.length), 2600);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const run = useCallback(
    (sentence: string, pick?: Choice) => {
      if (!sentence.trim()) return;
      const [a, s] = (section ?? "").split(":");
      expectLanding(15000);
      start(async () => {
        const res = await commandAction(sentence, {
          ...(section ? { area: a, sub: s } : {}),
          ...(pick ? { pick: { kind: pick.kind, id: pick.id } } : {}),
          page: pathname,
          history: history.current,
        });
        const viaVoice = spoken.current;
        spoken.current = false;
        if ("choose" in res) {
          setChoices({ question: res.question, list: res.choose });
          return;
        }
        if ("error" in res) {
          setToast({ text: res.error, undo: null, error: true });
          if (viaVoice || voice) speak(res.error);
          return;
        }
        history.current = [...history.current, { role: "user" as const, text: sentence }, { role: "assistant" as const, text: res.message }].slice(-8);
        // Spoken to, it answers out loud; typed to, only if the voice is switched on.
        if (viaVoice || voice) speak(res.message);
        if (res.navigate) router.push(res.navigate);
        setChoices(null);
        // A review or an answer stays on screen to be read; a change is confirmed and closes.
        if (res.answer) {
          setAnswer(res.message);
          setText("");
          return;
        }
        setToast({ text: res.message, undo: res.undo });
        setText("");
        setSection(null);
        setOpen(false);
      });
    },
    [section, pathname, router, voice]
  );

  const undo = () => {
    if (!toast?.undo) return;
    const u = toast.undo;
    start(async () => {
      await undoCommandAction(u);
      setToast({ text: "Annulé.", undo: null });
    });
  };

  // Dictation: the words appear as they are said, and the sentence runs once it is final.
  const listen = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    setOpen(true);
    setChoices(null);
    setAnswer(null);
    setText("");
    const r = new Ctor();
    r.lang = "fr-CA";
    r.interimResults = true;
    // Keep listening through pauses between words; stop after ~2 s of silence, or when
    // the mic is tapped again.
    r.continuous = true;
    let finalText = "";
    let silence: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (silence) clearTimeout(silence);
      silence = setTimeout(() => r.stop(), 2000);
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
      setText((finalText + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setToast({ text: "Autorise le micro pour dicter.", undo: null, error: true });
      else if (e.error === "no-speech") setToast({ text: "Je n'ai rien entendu.", undo: null, error: true });
    };
    r.onend = () => {
      if (silence) clearTimeout(silence);
      setListening(false);
      rec.current = null;
      if (finalText.trim()) {
        spoken.current = true;
        run(finalText.trim());
      }
    };
    rec.current = r;
    setListening(true);
    r.start();
  };

  useEffect(() => {
    listenRef.current = listen;
    runRef.current = run;
  });

  const verb =
    intent?.kind === "move" ? "Déplacer" : intent?.kind === "delete" ? "Supprimer" : intent?.kind === "rename" ? "Renommer" : intent?.kind === "summary" ? "Bilan" : null;

  return (
    <>
      {canListen && (
        <button type="button" onClick={listen} aria-label="Dicter (micro)" title="Dicter" className="qc-mic focus-ring" data-on={listening || undefined}>
          <Mic size={18} />
        </button>
      )}
      <button type="button" onClick={() => setOpen(true)} aria-label="Ajouter rapidement (N)" title="Ajouter rapidement (N)" className="qc-fab focus-ring">
        <Plus size={22} strokeWidth={2.4} />
      </button>

      {toast && (
        <div role="status" className="qc-toast" data-error={toast.error || undefined}>
          {toast.error ? <X size={14} className="shrink-0 text-[#ffb3a3]" /> : <Check size={14} className="shrink-0 text-[#f0cd79]" />}
          <span className="min-w-0 flex-1">{toast.text}</span>
          {toast.undo && (
            <button type="button" onClick={undo} disabled={pending} className="qc-undo focus-ring">
              <Undo2 size={13} /> Annuler
            </button>
          )}
        </div>
      )}

      {open && (
        <div
          className="qc-overlay"
          onClick={() => {
            rec.current?.abort();
            setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Ajout rapide"
        >
          <div className="qc-sheet glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-dim)]">
              <Sparkles size={14} className="text-[#f0cd79]" /> {listening ? "Je t'écoute…" : pending ? "Je m'en occupe…" : "Assistant"}
              <button
                type="button"
                onClick={toggleVoice}
                aria-pressed={voice}
                aria-label={voice ? "Ne plus répondre à voix haute" : "Répondre à voix haute"}
                title={voice ? "Réponses à voix haute : activées" : "Réponses à voix haute : seulement quand tu parles"}
                className="ml-2 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                {voice ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  rec.current?.abort();
                  setOpen(false);
                }}
                aria-label="Fermer"
                className="ml-auto text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X size={16} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(text);
              }}
              className="mt-3 flex items-center gap-3"
            >
              <input
                ref={input}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setSection(null);
                  setChoices(null);
                  setAnswer(null);
                }}
                placeholder={listening ? "Parle…" : `ex. ${EXAMPLES[example]}`}
                aria-label="Ce que tu veux faire"
                className="min-w-0 flex-1 bg-transparent text-xl font-medium text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] sm:text-2xl"
              />
              {canListen && (
                <button type="button" onClick={listen} aria-label={listening ? "Arrêter la dictée" : "Dicter"} className="qc-mic-inline focus-ring" data-on={listening || undefined}>
                  <Mic size={18} />
                </button>
              )}
            </form>

            <div className="mt-4 flex min-h-[2rem] flex-wrap items-center gap-2">
              {multi ? (
                multi.map((m, i) => (
                  <span key={i} className="qc-chip" style={{ "--c": m.kind === "delete" ? "#ef4444" : "#e8bf63" } as React.CSSProperties}>
                    {m.kind === "delete" ? <Trash2 size={13} /> : m.kind === "rename" ? <PencilLine size={13} /> : m.kind === "move" ? <ArrowRight size={13} /> : <Plus size={13} />}
                    {m.kind === "delete" ? "Supprimer" : m.kind === "rename" ? "Renommer" : m.kind === "move" ? "Déplacer" : "Ajouter"}
                    {m.kind !== "create" && m.kind !== "summary" && m.source ? ` · ${m.source}` : ""}
                  </span>
                ))
              ) : verb && intent && intent.kind !== "create" ? (
                <>
                  <span className="qc-chip" style={{ "--c": intent.kind === "delete" ? "#ef4444" : "#e8bf63" } as React.CSSProperties}>
                    {intent.kind === "delete" ? <Trash2 size={13} /> : intent.kind === "rename" ? <PencilLine size={13} /> : <ArrowRight size={13} />}
                    {verb}
                  </span>
                  {"source" in intent && intent.source && <span className="qc-chip" data-dim>{intent.source}</span>}
                  {intent.kind === "move" && (target || intent.shift != null) && (
                    <span className="qc-chip">
                      <Clock size={13} />
                      {intent.shift != null
                        ? `${intent.shift > 0 ? "+" : "−"}${Math.abs(intent.shift) >= 60 ? `${Math.abs(intent.shift) / 60} h` : `${Math.abs(intent.shift)} min`}`
                        : `${target?.found.day ? dayName(target.day, today) : "même jour"}${target?.time ? ` · ${fr(target.time)}` : ""}`}
                    </span>
                  )}
                  {intent.kind === "rename" && <span className="qc-chip">→ {intent.title}</span>}
                </>
              ) : parsed && area ? (
                <>
                  <label className="qc-chip" style={{ "--c": area.color } as React.CSSProperties}>
                    <span className="h-2 w-2 rounded-full" style={{ background: area.color }} />
                    <select value={key ?? ""} onChange={(e) => setSection(e.target.value)} aria-label="Section" className="cursor-pointer appearance-none bg-transparent pr-1 outline-none">
                      {AREAS.map((a) => (
                        <optgroup key={a.key} label={a.label}>
                          {a.subs.map((s) => (
                            <option key={s.key} value={`${a.key}:${s.key}`}>
                              {a.front} · {s.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <span className="qc-chip" data-dim={!parsed.found.day || undefined}>
                    <CalendarClock size={13} /> {dayName(parsed.day, today)}
                  </span>
                  {parsed.time && (
                    <span className="qc-chip">
                      <Clock size={13} /> {isDeadline(text) ? `avant ${fr(parsed.time)}` : `${fr(parsed.time)} · ${parsed.minutes} min`}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs leading-5 text-[var(--ink-faint)]">
                  Parle-lui comme à un assistant : « sport samedi 10h », « décale la réunion à 15h », « crée trois dossiers de cours », « ajoute un secteur Guitare »,
                  « j&apos;ai couru 30 min », « fais-moi un plan de révision pour mon examen », « qu&apos;est-ce que j&apos;ai demain ? ».
                </span>
              )}
            </div>

            {answer && (
              <div className="qc-answer mt-4" role="status">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-[#f0cd79]" />
                <p>{answer}</p>
              </div>
            )}

            {choices && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-[var(--ink-dim)]">{choices.question}</p>
                <div className="flex flex-col gap-1.5">
                  {choices.list.map((c) => (
                    <button key={`${c.kind}${c.id}`} type="button" disabled={pending} onClick={() => run(text, c)} className="tile focus-ring px-3.5 py-2.5 text-left text-sm text-[var(--ink)]">
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[0.7rem] text-[var(--ink-faint)]">
                {intent?.kind === "create" && sub
                  ? parsed?.time && !isDeadline(text)
                    ? `Au calendrier · ${area?.label} · ${sub.label}`
                    : `${isDeadline(text) ? "À rendre" : "À faire"} · ${area?.label} · ${sub.label}`
                  : "Entrée pour valider · Échap pour fermer"}
              </span>
              <button type="button" onClick={() => run(text)} disabled={!text.trim() || pending} className="mod-chip mod-chip-gold focus-ring">
                {pending ? "…" : multi ? `Faire les ${multi.length}` : verb ?? "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
