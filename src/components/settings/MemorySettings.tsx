"use client";

import { useState, useTransition } from "react";
import { Brain, Trash2 } from "lucide-react";
import { addFactAction, deleteFactAction } from "@/server/actions/memory.actions";

/** What the assistant remembers: only what you told it to, and you can see and erase all of it. */
export function MemorySettings({ facts: initial }: { facts: { id: string; text: string }[] }) {
  const [facts, setFacts] = useState(initial);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const r = await addFactAction(text);
      if ("error" in r) return setStatus({ text: r.error ?? "Erreur.", error: true });
      setFacts((f) => [...f, r.fact]);
      setText("");
      setStatus({ text: "Retenu." });
    });
  const remove = (id: string) =>
    start(async () => {
      await deleteFactAction(id);
      setFacts((f) => f.filter((x) => x.id !== id));
      setStatus({ text: "Effacé." });
    });

  return (
    <div className="space-y-3">
      <p className="text-xs leading-5 text-[var(--ink-dim)]">
        L&apos;assistant ne retient que ce que tu lui demandes (« retiens que je préfère le sport le soir »), et s&apos;en sert comme d&apos;une préférence, jamais comme d&apos;un ordre.
        Rien d&apos;autre n&apos;est mémorisé.
      </p>
      {facts.length ? (
        <ul className="space-y-1.5">
          {facts.map((f) => (
            <li key={f.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
              <Brain size={14} className="shrink-0 text-[#f0cd79]" aria-hidden />
              <span className="min-w-0 flex-1 text-sm text-[var(--ink)]">{f.text}</span>
              <button type="button" onClick={() => remove(f.id)} disabled={pending} aria-label={`Effacer « ${f.text} »`} className="focus-ring rounded p-1 text-[var(--ink-faint)] hover:text-[#ffb3a3]">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--ink-dim)]">Rien pour l&apos;instant.</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) add();
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          placeholder="ex. Je préfère réviser le matin"
          aria-label="Ajouter quelque chose à retenir"
          className="min-w-0 flex-1 basis-56 rounded-xl border border-[rgba(255,220,148,0.18)] bg-[rgba(20,12,3,0.4)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[#e8bf63]"
        />
        <button type="submit" disabled={pending || !text.trim()} className="mod-chip mod-chip-gold focus-ring">
          Retenir
        </button>
      </form>
      <p role="status" aria-live="polite" className={`min-h-[1rem] text-xs ${status?.error ? "text-[#ffb3a3]" : "text-[var(--ink-dim)]"}`}>
        {status?.text}
      </p>
    </div>
  );
}
