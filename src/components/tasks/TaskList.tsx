"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Search, Trash2, Undo2 } from "lucide-react";
import { bulkCompleteAction, bulkDeleteAction } from "@/server/actions/tasks-bulk.actions";
import { undoCommandAction, type Undo } from "@/server/actions/capture.actions";
import { queryString, type TaskQuery } from "@/lib/task-list";
import { labelIn } from "@/lib/labels";
import { useI18n } from "@/i18n/client";
import { fmt, INTL, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/ns/workspace";

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
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
// A stored day ("2026-10-09"), read at noon UTC so it is the same day in every zone.
const day = (iso: string, locale: Locale) => new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));

/** Every task, filtered from the address bar (shareable, works without script), acted on in bulk. */
export function TaskList({ query, tasks, total, limit, areas }: { query: TaskQuery; tasks: ListTask[]; total: number; limit: number; areas: { key: string; label: string }[] }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const w = t.workspace.list;
  const pl = (n: number, one: string, many: string) => plural(locale, n, one, many);
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
  const all = tasks.length > 0 && tasks.every((x) => picked.has(x.id));
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
    after(`${pl(r.count, w.deletedOne, w.deletedMany)}${r.kept ? ` ${pl(r.kept, w.keptOne, w.keptMany)}` : ""}`, r.undo);
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
          {w.search}
          <span className="relative mt-1 block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-faint)]" />
            <input name="q" defaultValue={query.q} key={query.q} placeholder={w.searchPlaceholder} className={`${field} w-full pl-8`} />
          </span>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          {w.state}
          <select value={query.status} onChange={(e) => go({ status: e.target.value as TaskQuery["status"] })} className={`${field} mt-1 block`}>
            <option value="open">{w.stateOpen}</option>
            <option value="done">{w.stateDone}</option>
            <option value="all">{w.stateAll}</option>
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          {w.due}
          <select value={query.due} onChange={(e) => go({ due: e.target.value as TaskQuery["due"] })} className={`${field} mt-1 block`}>
            <option value="any">{w.dueAny}</option>
            <option value="overdue">{w.dueOverdue}</option>
            <option value="today">{w.dueToday}</option>
            <option value="week">{w.dueWeek}</option>
            <option value="none">{w.dueNone}</option>
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          {w.sector}
          <select value={query.area ?? ""} onChange={(e) => go({ area: e.target.value || null })} className={`${field} mt-1 block max-w-[11rem]`}>
            <option value="">{w.allSectors}</option>
            {areas.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          {w.sortBy}
          <select value={query.sort} onChange={(e) => go({ sort: e.target.value as TaskQuery["sort"] })} className={`${field} mt-1 block`}>
            <option value="due">{w.sortDue}</option>
            <option value="priority">{w.sortPriority}</option>
            <option value="recent">{w.sortRecent}</option>
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
                after(missed ? pl(missed, w.partialOne, w.partialMany) : w.undone);
              }}
              className="mod-chip focus-ring"
            >
              <Undo2 size={12} /> {t.common.undo}
            </button>
          )}
        </p>
      )}

      <section className="glass-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            <input type="checkbox" checked={all} onChange={() => setPicked(all ? new Set() : new Set(tasks.map((x) => x.id)))} aria-label={w.selectAll} />
            {picked.size ? pl(picked.size, w.selectedOne, w.selectedMany) : `${pl(total, w.countOne, w.countMany)}${total > limit ? fmt(w.firstShown, { n: limit }) : ""}`}
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
                  else after(pl(r.count, w.checkedOne, w.checkedMany), r.undo);
                }}
                className="mod-chip mod-chip-gold focus-ring"
              >
                <CheckCheck size={13} /> {w.check}
              </button>
              <button type="button" disabled={busy} onClick={() => remove(false)} className="mod-chip focus-ring text-[#ffb3a3]">
                <Trash2 size={13} /> {t.common.delete}
              </button>
            </span>
          )}
        </div>
        {confirm && (
          <div role="alertdialog" className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
            {confirm}
            <button type="button" onClick={() => remove(true)} className="mod-chip focus-ring text-[#ffb3a3]">
              {w.yesDelete}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="mod-chip focus-ring">
              {t.common.no}
            </button>
          </div>
        )}
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-[var(--ink-dim)]">{w.noMatch}</p>
            {(query.q || query.status !== "open" || query.due !== "any" || query.area) && (
              <button type="button" onClick={() => go({ q: "", status: "open", due: "any", area: null })} className="mod-chip focus-ring">
                {w.clearFilters}
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[rgba(255,220,148,0.08)]">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-2.5">
                <input type="checkbox" checked={picked.has(task.id)} onChange={() => toggle(task.id)} aria-label={fmt(w.selectNamed, { title: task.title })} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm text-[var(--ink)] ${task.done ? "line-through opacity-60" : ""}`}>{task.title}</p>
                  <p className="text-xs text-[var(--ink-faint)]">
                    {[task.where, PRIORITIES.includes(task.priority) && task.priority !== "Medium" ? fmt(w.priorityWord, { p: labelIn(task.priority, locale).toLowerCase() }) : null].filter(Boolean).join(" · ") || w.noSector}
                  </p>
                </div>
                <span className={`shrink-0 text-xs tabular-nums ${task.overdue ? "font-semibold text-[#ffb3a3]" : "text-[var(--ink-dim)]"}`}>{task.due ? `${task.overdue ? w.overduePrefix : ""}${day(task.due, locale)}` : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
