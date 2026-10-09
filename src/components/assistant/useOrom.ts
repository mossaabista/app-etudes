"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { commandAction, confirmCommandAction, undoCommandAction, type CommandResult, type Undo } from "@/server/actions/capture.actions";
import type { Confirmation } from "@/server/assistant-run";
import { loadVoicePrefs, recognitionError, spokenSummary, webSpeechInput, webSpeechOutput, type Listening, type VoicePrefs, type VoiceState } from "@/lib/voice";

export type Outcome = "done" | "partial" | "failed" | "answer" | "confirm" | "cancelled";

export interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  outcome: Outcome | null;
  /** What undoes this reply's changes, while it still can. */
  undo?: Undo | null;
  opId?: string;
  confirm?: Confirmation;
}

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

function outcome(res: CommandResult): Outcome {
  if ("error" in res) return "failed";
  if ("confirm" in res) return "confirm";
  if ("choose" in res) return "answer";
  return res.partial ? "partial" : res.answer || !res.undo ? "answer" : "done";
}

const replyText = (res: CommandResult) =>
  "error" in res ? res.error : "confirm" in res ? `Avant de le faire, j'ai besoin de ton accord : ${res.confirm.items.join(" ; ")}.` : "choose" in res ? `${res.question} ${res.choose.map((c) => c.label).join(" ; ")}` : res.message;

/**
 * One conversation with OROM, by voice or by text: both go through the same server
 * command. Tracks the voice state so the screen always says what is happening, speaks
 * short and shows everything, and can be interrupted at any point.
 */
export function useOrom({ initial, page, record = true }: { initial: Turn[]; page: string; record?: boolean }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initial);
  const [state, setState] = useState<VoiceState>("idle");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<VoicePrefs | null>(null);
  const listening = useRef<Listening | null>(null);
  // A reply that arrives after the user cancelled is still reported, never silently dropped.
  const cancelled = useRef(false);
  const spokenTurn = useRef(false);
  // Latest versions, for callbacks that outlive the render that made them (recognition, speech).
  const sendRef = useRef<(s: string) => void>(() => {});
  const listenRef = useRef<() => void>(() => {});

  useEffect(() => {
    const t = setTimeout(() => setPrefs(loadVoicePrefs()), 0);
    return () => clearTimeout(t);
  }, []);

  const push = (t: Omit<Turn, "id">) => setTurns((ts) => [...ts, { ...t, id: newId() }]);
  const history = useCallback(() => turns.slice(-8).map((t) => ({ role: t.role, text: t.text })), [turns]);

  const speakThen = useCallback(
    (text: string, next: () => void) => {
      const p = prefs ?? loadVoicePrefs();
      if (!webSpeechOutput.supported()) return next();
      setState("speaking");
      webSpeechOutput.speak(spokenSummary(text), p, next);
    },
    [prefs]
  );

  const listen = useCallback(() => {
    if (!webSpeechInput.supported()) {
      setNotice("La dictée n'est pas disponible dans ce navigateur : écris ta demande.");
      setState("error");
      return;
    }
    webSpeechOutput.cancel();
    listening.current?.abort();
    setNotice(null);
    setDraft("");
    setState("listening");
    const p = prefs ?? loadVoicePrefs();
    listening.current = webSpeechInput.listen(p.locale, {
      onText: (text, final) => {
        setDraft(text);
        if (final) setState("transcribing");
      },
      onError: (code) => {
        const msg = recognitionError(code);
        if (msg) {
          setNotice(msg);
          setState("error");
        }
      },
      onEnd: (finalText) => {
        listening.current = null;
        if (finalText) {
          spokenTurn.current = true;
          sendRef.current(finalText);
        } else setState((s) => (s === "listening" || s === "transcribing" ? "idle" : s));
      },
    });
  }, [prefs]);

  const afterReply = useCallback(
    (text: string, viaVoice: boolean) => {
      const p = prefs ?? loadVoicePrefs();
      if (!(viaVoice || p.speakTyped)) return setState("idle");
      speakThen(text, () => {
        // Conversation mode: listen again, only after a spoken exchange, only while here.
        if (viaVoice && p.conversation && !cancelled.current) listenRef.current();
        else setState("idle");
      });
    },
    [prefs, speakThen]
  );

  const handle = useCallback(
    (res: CommandResult, opId: string, viaVoice: boolean) => {
      const text = replyText(res);
      push({ role: "assistant", text, outcome: outcome(res), undo: "ok" in res ? res.undo : null, opId, confirm: "confirm" in res ? res.confirm : undefined });
      if ("ok" in res && res.navigate) router.push(res.navigate);
      if ("ok" in res && res.undo) router.refresh();
      if (cancelled.current) {
        cancelled.current = false;
        setNotice("Ta demande était déjà partie : voici ce qui a été fait.");
        return setState("idle");
      }
      afterReply(text, viaVoice);
    },
    [router, afterReply]
  );

  const send = useCallback(
    async (sentence: string) => {
      const text = sentence.trim();
      if (!text) return;
      const viaVoice = spokenTurn.current;
      spokenTurn.current = false;
      cancelled.current = false;
      setDraft("");
      setNotice(null);
      push({ role: "user", text, outcome: null });
      setState("processing");
      const opId = newId();
      try {
        const res = await commandAction(text, { opId, page, history: history(), record });
        handle(res, opId, viaVoice);
      } catch {
        push({ role: "assistant", text: "Je n'ai pas pu joindre le serveur : rien n'a été fait. Réessaie.", outcome: "failed" });
        setState("error");
      }
    },
    [page, history, record, handle]
  );

  useEffect(() => {
    sendRef.current = (s: string) => void send(s);
    listenRef.current = listen;
  });

  const confirm = useCallback(
    async (c: Confirmation) => {
      setTurns((ts) => ts.map((t) => (t.confirm === c ? { ...t, confirm: undefined } : t)));
      setState("executing");
      try {
        handle(await confirmCommandAction(c.token, { record }), c.opId, false);
      } catch {
        push({ role: "assistant", text: "Je n'ai pas pu joindre le serveur : rien n'a été fait.", outcome: "failed" });
        setState("error");
      }
    },
    [handle, record]
  );

  const decline = useCallback((c: Confirmation) => {
    setTurns((ts) => [...ts.map((t) => (t.confirm === c ? { ...t, confirm: undefined } : t)), { id: newId(), role: "assistant", text: "D'accord, je n'ai rien fait.", outcome: "cancelled" }]);
  }, []);

  const undo = useCallback(
    async (t: Turn) => {
      if (!t.undo) return;
      const { missed } = await undoCommandAction(t.undo, t.opId, { record });
      setTurns((ts) => [
        ...ts.map((x) => (x.id === t.id ? { ...x, undo: null } : x)),
        { id: newId(), role: "assistant", text: missed ? `Annulé en partie : ${missed} élément${missed > 1 ? "s avaient" : " avait"} déjà changé.` : "Annulé.", outcome: missed ? "partial" : "cancelled" },
      ]);
      router.refresh();
    },
    [router, record]
  );

  /** Stop whatever is happening: listening, speaking, or waiting on a reply. */
  const stop = useCallback(() => {
    if (listening.current) {
      listening.current.abort();
      listening.current = null;
      setDraft("");
      setState("cancelled");
      return;
    }
    if (state === "speaking") {
      webSpeechOutput.cancel();
      setState("interrupted");
      return;
    }
    if (state === "processing" || state === "executing") {
      // The server cannot be recalled mid-request; say so and report what comes back.
      cancelled.current = true;
      setNotice("Je ne peux plus l'arrêter : la demande est partie. Je t'indique le résultat dès qu'il arrive, et tu pourras l'annuler.");
    }
  }, [state]);

  return { turns, setTurns, state, draft, setDraft, notice, prefs, setPrefs, send, listen, stop, confirm, decline, undo, canListen: webSpeechInput.supported };
}
