"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Mic, MicOff, Send, Settings2, Square, Trash2, Undo2 } from "lucide-react";
import { useOrom, type Outcome, type Turn } from "@/components/assistant/useOrom";
import { clearConversationAction } from "@/server/actions/capture.actions";
import { BrandMark } from "@/components/layout/BrandMark";
import { VOICE_LABEL, micPermission } from "@/lib/voice";

const OUTCOME: Record<Outcome, { label: string; tone: string }> = {
  done: { label: "Fait", tone: "text-[#7fe0b0]" },
  partial: { label: "En partie", tone: "text-[#ffd9a8]" },
  failed: { label: "Pas fait", tone: "text-[#ffb3a3]" },
  answer: { label: "Réponse", tone: "text-[var(--ink-dim)]" },
  confirm: { label: "À confirmer", tone: "text-[#f0cd79]" },
  cancelled: { label: "Annulé", tone: "text-[var(--ink-dim)]" },
};

/**
 * The Jarvis assistant page: one conversation, by voice or text, with what each request
 * really did, previews to confirm, and undo. Listening is only ever on while the
 * microphone button says so.
 */
export function AssistantConsole({ initial, suggestions }: { initial: Turn[]; suggestions: string[] }) {
  const o = useOrom({ initial, page: "/assistant" });
  const [mic, setMic] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [canListen, setCanListen] = useState(false);
  const [clearing, startClear] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const busy = o.state === "processing" || o.state === "executing";
  const live = o.state === "listening" || o.state === "transcribing";

  useEffect(() => {
    const t = setTimeout(() => {
      setCanListen(o.canListen());
      void micPermission().then(setMic);
    }, 0);
    return () => clearTimeout(t);
  }, [o, o.state]);
  useEffect(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }), [o.turns.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && o.stop();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [o]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <section className="glass-card flex flex-wrap items-center gap-4 p-5">
        <span className="orom-orb" data-state={o.state} aria-hidden>
          <BrandMark size={44} />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <h1 className="text-lg font-semibold text-[var(--ink)]">Jarvis</h1>
          <p role="status" aria-live="polite" className="text-sm text-[var(--ink-dim)]">
            {VOICE_LABEL[o.state]}
            {live && " Le micro est allumé."}
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
            {!canListen
              ? "Dictée indisponible dans ce navigateur : écris ta demande."
              : mic === "denied"
                ? "Micro bloqué : autorise-le dans les réglages du navigateur."
                : o.prefs?.conversation
                  ? "Mode conversation : je réécoute après chaque réponse parlée, tant que cette page est ouverte."
                  : "Appuie sur le micro pour parler ; Échap pour arrêter."}
          </p>
        </div>
        <Link href="/settings#voix" className="mod-chip focus-ring" aria-label="Réglages de la voix">
          <Settings2 size={13} /> Voix
        </Link>
      </section>

      <section className="glass-card flex min-h-[18rem] flex-col p-4" aria-label="Conversation">
        {o.turns.length === 0 ? (
          <div className="m-auto max-w-md py-8 text-center">
            <p className="text-sm text-[var(--ink)]">Dis-moi ce que tu veux accomplir.</p>
            <p className="mt-1 text-xs text-[var(--ink-dim)]">Je le fais, je vérifie que c&apos;est enregistré, et je te dis exactement ce qui a marché.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {o.turns.map((t) => (
              <TurnRow key={t.id} t={t} onUndo={() => void o.undo(t)} onConfirm={() => t.confirm && void o.confirm(t.confirm)} onDecline={() => t.confirm && o.decline(t.confirm)} busy={busy} />
            ))}
          </ol>
        )}
        <div ref={end} />
      </section>

      {o.notice && (
        <p role="alert" className="rounded-xl bg-[rgba(255,179,163,0.1)] px-4 py-2.5 text-sm text-[#ffd9a8]">
          {o.notice}
        </p>
      )}

      {o.turns.length < 3 && (
        <div className="flex flex-wrap gap-2" aria-label="Suggestions">
          {suggestions.map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => void o.send(s)} className="mod-chip mod-chip-dark focus-ring">
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void o.send(o.draft);
        }}
        className="glass-card flex items-center gap-2 p-2.5"
      >
        <input
          value={o.draft}
          onChange={(e) => o.setDraft(e.target.value)}
          placeholder={live ? "Parle…" : "Écris ou dicte ta demande à Jarvis"}
          aria-label="Ta demande à Jarvis"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        {(live || busy || o.state === "speaking") && (
          <button type="button" onClick={o.stop} aria-label="Arrêter" className="qc-mic-inline focus-ring" data-on>
            <Square size={16} />
          </button>
        )}
        {canListen && !live && (
          <button type="button" onClick={o.listen} disabled={busy} aria-label="Parler à Jarvis" className="qc-mic-inline focus-ring">
            {mic === "denied" ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button type="submit" disabled={!o.draft.trim() || busy} aria-label="Envoyer" className="mod-chip mod-chip-gold focus-ring">
          <Send size={14} />
        </button>
      </form>

      <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-faint)]">
        <span>Les 100 derniers échanges de cette page sont gardés pour toi seul.</span>
        <button
          type="button"
          disabled={clearing || !o.turns.length}
          onClick={() =>
            startClear(async () => {
              await clearConversationAction();
              o.setTurns([]);
            })
          }
          className="inline-flex items-center gap-1 underline-offset-2 hover:text-[var(--ink)] hover:underline disabled:opacity-40"
        >
          <Trash2 size={12} /> Effacer la conversation
        </button>
      </p>
    </div>
  );
}

function TurnRow({ t, onUndo, onConfirm, onDecline, busy }: { t: Turn; onUndo: () => void; onConfirm: () => void; onDecline: () => void; busy: boolean }) {
  if (t.role === "user")
    return (
      <li className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[rgba(255,220,148,0.12)] px-4 py-2.5 text-sm text-[var(--ink)]">
        <span className="sr-only">Toi : </span>
        {t.text}
      </li>
    );
  const o = t.outcome ? OUTCOME[t.outcome] : null;
  return (
    <li className="max-w-[92%] rounded-2xl rounded-bl-md bg-[rgba(20,12,3,0.45)] px-4 py-3">
      <p className="text-sm leading-6 text-[var(--ink)]">
        <span className="sr-only">Jarvis : </span>
        {t.text}
      </p>
      {(o || t.undo) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
          {o && <span className={`font-semibold ${o.tone}`}>{o.label}</span>}
          {t.undo && (
            <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 text-[var(--ink-dim)] underline-offset-2 hover:text-[var(--ink)] hover:underline">
              <Undo2 size={12} /> Annuler
            </button>
          )}
        </div>
      )}
      {t.confirm && (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onDecline} disabled={busy} className="mod-chip focus-ring">
            Ne rien faire
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="mod-chip mod-chip-gold focus-ring">
            Confirmer
          </button>
        </div>
      )}
    </li>
  );
}
