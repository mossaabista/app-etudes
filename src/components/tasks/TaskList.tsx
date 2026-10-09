"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Search, Trash2, Undo2 } from "lucide-react";
import { bulkCompleteAction, bulkDeleteAction } from "@/server/actions/tasks-bulk.actions";
import { undoCommandAction, type Undo } from "@/server/actions/capture.actions";
import { queryString, type TaskQuery } from "@/lib/task-list";

export interface ListTask {
  id: string;
  title: string;
  done: boolean;
  priority: string;
  due: string | null;
  overdue: boolean;
  where: string | null;
}

const field = "rounded-xl border border-[rgba(255,220,148,0.16)] bg-[rgba(20,14,6,0.55)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[rgba(255,220,148,0.45)]";
const PRIORITY_FR: Record<string, string> = { Critical: "Critique", High: "Haute", Medium: "Moyenne", Low: "Basse" };
const day = (iso: string) => new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));

/** Every task, filtered from the address bar (shareable, works without script), acted on in bulk. */
export function TaskList({ query, tasks, total, limit, areas }: { query: TaskQuery; tasks: ListTask[]; total: number; limit: number; areas: { key: string; label: string }[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<{ text: string; undo?: Undo | null } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const go = (patch: Partial<TaskQuery>) => {
    setPicked(new Set());
    router.push(`/liste${queryString(query, patch)}`);
  };
  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const all = tasks.length > 0 && tasks.every((t) => picked.has(t.id));
  const after = (text: string, undo?: Undo | null) => {
    setNote({ text, undo });
    setPicked(new Set());
    setConfirm(null);
    router.refresh();
  };
  const remove = async (confirmed: boolean) => {
    setBusy(true);
    const r = await bulkDeleteAction([...picked], confirmed);
    setBusy(false);
    if ("confirm" in r) return setConfirm(r.confirm);
    if ("error" in r) return setNote({ text: r.error });
    after(`${r.count} tâche${r.count > 1 ? "s" : ""} supprimée${r.count > 1 ? "s" : ""}.${r.kept ? ` ${r.kept} gardée${r.kept > 1 ? "s" : ""} : elle${r.kept > 1 ? "s ont" : " a"} des sous-tâches, supprime-les depuis leur secteur.` : ""}`, r.undo);
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: String(new FormData(e.currentTarget).get("q") ?? "") });
        }}
        action="/liste"
        className="glass-card flex flex-wrap items-end gap-2 p-4"
      >
        <label className="min-w-0 flex-1 basis-48 text-xs text-[var(--ink-dim)]">
          Rechercher
          <span className="relative mt-1 block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input name="q" defaultValue={query.q} key={query.q} placeholder="Titre de la tâche" className={`${field} w-full pl-8`} />
          </span>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          État
          <select value={query.status} onChange={(e) => go({ status: e.target.value as TaskQuery["status"] })} className={`${field} mt-1 block`}>
            <option value="open">À faire</option>
            <option value="done">Faites</option>
            <option value="all">Toutes</option>
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Échéance
          <select value={query.due} onChange={(e) => go({ due: e.target.value as TaskQuery["due"] })} className={`${field} mt-1 block`}>
            <option value="any">Toutes</option>
            <option value="overdue">En retard</option>
            <option value="today">Aujourd&apos;hui</option>
            <option value="week">7 prochains jours</option>
            <option value="none">Sans date</option>
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Secteur
          <select value={query.area ?? ""} onChange={(e) => go({ area: e.target.value || null })} className={`${field} mt-1 block max-w-[11rem]`}>
            <option value="">Tous</option>
            {areas.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Trier par
          <select value={query.sort} onChange={(e) => go({ sort: e.target.value as TaskQuery["sort"] })} className={`${field} mt-1 block`}>
            <option value="due">Échéance</option>
            <option value="priority">Priorité</option>
            <option value="recent">Plus récentes</option>
          </select>
        </label>
      </form>

      {note && (
        <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
          {note.text}
          {note.undo && (
            <button
              type="button"
              onClick={async () => {
                const { missed } = await undoCommandAction(note.undo!);
                after(missed ? `Annulé en partie : ${missed} tâche${missed > 1 ? "s avaient" : " avait"} déjà changé.` : "Annulé.");
              }}
              className="mod-chip focus-ring"
            >
              <Undo2 size={12} /> Annuler
            </button>
          )}
        </p>
      )}

      <section className="glass-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(tasks.map((t) => t.id)))} aria-label="Tout sélectionner" />
            {picked.size ? `${picked.size} sélectionnée${picked.size > 1 ? "s" : ""}` : `${total} tâche${total > 1 ? "s" : ""}${total > limit ? ` (les ${limit} premières affichées)` : ""}`}
          </label>
          {picked.size > 0 && (
            <span className="ml-auto flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await bulkCompleteAction([...picked]);
                  setBusy(false);
                  if ("error" in r) setNote({ text: r.error });
                  else after(`${r.count} tâche${r.count > 1 ? "s" : ""} cochée${r.count > 1 ? "s" : ""}.`, r.undo);
                }}
                className="mod-chip mod-chip-gold focus-ring"
              >
                <CheckCheck size={13} /> Cocher
              </button>
              <button type="button" disabled={busy} onClick={() => remove(false)} className="mod-chip focus-ring text-[#ffb3a3]">
                <Trash2 size={13} /> Supprimer
              </button>
            </span>
          )}
        </div>
        {confirm && (
          <div role="alertdialog" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
            {confirm}
            <button type="button" onClick={() => remove(true)} className="mod-chip focus-ring text-[#ffb3a3]">
              Oui, supprimer
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="mod-chip focus-ring">
              Non
            </button>
          </div>
        )}
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--ink-dim)]">Aucune tâche ne correspond.</p>
        ) : (
          <ul className="divide-y divide-[rgba(255,220,148,0.08)]">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Sélectionner ${t.title}`} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm text-[var(--ink)] ${t.done ? "line-through opacity-60" : ""}`}>{t.title}</p>
                  <p className="text-xs text-[var(--ink-faint)]">
                    {[t.where, PRIORITY_FR[t.priority] && t.priority !== "Medium" ? `priorité ${PRIORITY_FR[t.priority].toLowerCase()}` : null].filter(Boolean).join(" · ") || "Sans secteur"}
                  </p>
                </div>
                <span className={`shrink-0 text-xs tabular-nums ${t.overdue ? "font-semibold text-[#ffb3a3]" : "text-[var(--ink-dim)]"}`}>{t.due ? `${t.overdue ? "en retard · " : ""}${day(t.due)}` : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
