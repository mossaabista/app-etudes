"use client";

import { useState, useTransition } from "react";
import { History, Undo2 } from "lucide-react";
import { undoLoggedAction } from "@/server/actions/capture.actions";

export interface HistoryRow {
  id: string;
  when: string;
  summary: string;
  status: string;
  canUndo: boolean;
}

const STATUS: Record<string, string> = { done: "Fait", partial: "En partie", undone: "Annulé" };

/** The assistant's latest changes, each with its outcome in words, and undo where still possible. */
export function AgentHistory({ rows }: { rows: HistoryRow[] | null }) {
  const [list, setList] = useState(rows);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  if (!list)
    return <p className="text-sm text-[var(--ink-dim)]">L&apos;historique de l&apos;assistant n&apos;est pas encore activé sur ce serveur. En attendant, chaque modification reste annulable juste après, depuis sa confirmation.</p>;
  if (!list.length) return <p className="text-sm text-[var(--ink-dim)]">L&apos;assistant n&apos;a encore rien modifié pour toi.</p>;

  const undo = (id: string) =>
    start(async () => {
      const r = await undoLoggedAction(id);
      if ("error" in r) setMessage({ text: r.error, error: true });
      else if ("ok" in r) {
        setMessage({ text: r.message, error: r.partial });
        setList((l) => l?.map((x) => (x.id === id ? { ...x, status: "undone", canUndo: false } : x)) ?? l);
      }
    });

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-[rgba(255,220,148,0.08)]">
        {list.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
            <History size={14} className="mt-0.5 shrink-0 text-[#f0cd79]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--ink)]">{r.summary}</p>
              <p className="text-xs text-[var(--ink-dim)]">
                {r.when} · <span className={r.status === "partial" ? "text-[#ffb3a3]" : undefined}>{STATUS[r.status] ?? r.status}</span>
              </p>
            </div>
            {r.canUndo && (
              <button type="button" onClick={() => undo(r.id)} disabled={pending} className="mod-chip focus-ring">
                <Undo2 size={13} /> Annuler
              </button>
            )}
          </li>
        ))}
      </ul>
      <p role="status" aria-live="polite" className={`min-h-[1rem] text-xs ${message?.error ? "text-[#ffb3a3]" : "text-[var(--ink-dim)]"}`}>
        {pending ? "Annulation…" : message?.text}
      </p>
    </div>
  );
}
