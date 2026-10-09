"use client";

import { useState } from "react";
import { currentZone } from "@/lib/dates";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleSlash, Loader2, Pause, Pencil, Play, Plus, Trash2, Undo2, Workflow as WorkflowIcon, XCircle } from "lucide-react";
import { CONDITIONS, MAX_STEPS, STEP_CATALOG, TEMPLATES, needsConfirm, stepLabelIn, stepNameIn, type Condition, type Step, type StepType, type Trigger, type Workflow } from "@/lib/workflows";
import { WEEKDAYS } from "@/lib/planning-prefs";
import { useI18n } from "@/i18n/client";
import { fmt, INTL, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/ns/workspace";
import type { Messages } from "@/i18n/messages";
import { deleteWorkflowAction, runWorkflowAction, saveWorkflowAction, toggleWorkflowAction, undoRunAction } from "@/server/actions/workflows.actions";
import type { Run } from "@/server/workflows";

const field = "w-full rounded-xl border border-[rgba(255,220,148,0.16)] bg-[rgba(20,14,6,0.55)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[rgba(255,220,148,0.45)]";
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const when = (iso: string, locale: Locale) => new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
/** "Monday" → "lundi" / "Monday": 2023-01-02 was a Monday. */
const weekdayName = (day: string, locale: Locale, style: "long" | "short" = "long") =>
  new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", weekday: style }).format(new Date(Date.UTC(2023, 0, 2 + Math.max(0, WEEKDAYS.indexOf(day as (typeof WEEKDAYS)[number])), 12)));
// TEMPLATES, in order, as they read in the namespace.
const TEMPLATE_KEYS = ["morning", "sunday", "sprint"] as const;

function triggerText(tr: Trigger, w: Messages["workspace"]["wf"], locale: Locale) {
  if (tr.type === "manual") return w.onDemand;
  if (tr.days.length === 7) return w.everyMorning;
  return fmt(w.morningOn, { days: tr.days.map((d) => weekdayName(d, locale)).join(", ") });
}

function defaultStep(type: StepType): Step {
  if (type === "plan_workouts") return { type, sessions: 3, minutes: 60, when: "libre" };
  if (type === "create_task") return { type, title: "", dueInDays: 0 };
  return { type } as Step;
}

interface Draft {
  id?: string;
  name: string;
  daily: boolean;
  days: string[];
  condition: Condition;
  steps: Step[];
  authorize: boolean;
}

const draftOf = (w?: Partial<Workflow>): Draft => ({
  id: w?.id,
  name: w?.name ?? "",
  daily: w?.trigger?.type === "daily",
  days: w?.trigger?.type === "daily" ? w.trigger.days : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  condition: w?.condition ?? "always",
  steps: w?.steps ?? [],
  authorize: false,
});

/** Build one workflow from the catalogue: name, trigger, condition, steps. */
function Builder({ initial, onDone, onCancel }: { initial: Draft; onDone: (msg: string) => void; onCancel: () => void }) {
  const { t, locale } = useI18n();
  const w = t.workspace.wf;
  const [d, setD] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setStep = (i: number, s: Step) => setD({ ...d, steps: d.steps.map((x, j) => (j === i ? s : x)) });
  return (
    <form
      className="glass-card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const r = await saveWorkflowAction({ name: d.name, trigger: d.daily ? { type: "daily", days: d.days } : { type: "manual" }, condition: d.condition, steps: d.steps, authorize: d.authorize }, d.id);
        setSaving(false);
        if ("error" in r) return setError(r.error);
        onDone(d.id ? w.updated : w.created);
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--ink)]">{d.id ? w.editTitle : w.newTitle}</h2>
      <label className="block text-xs text-[var(--ink-dim)]">
        {w.name}
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} className={`${field} mt-1`} placeholder={w.namePlaceholder} />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs text-[var(--ink-dim)]">{w.trigger}</legend>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!d.daily} data-on={!d.daily || undefined} onClick={() => setD({ ...d, daily: false })} className="mod-tab focus-ring">
            {w.onDemand}
          </button>
          <button type="button" aria-pressed={d.daily} data-on={d.daily || undefined} onClick={() => setD({ ...d, daily: true })} className="mod-tab focus-ring">
            {w.everyMorning}
          </button>
        </div>
        {d.daily && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((wd) => (
                <button
                  key={wd}
                  type="button"
                  aria-pressed={d.days.includes(wd)}
                  aria-label={weekdayName(wd, locale)}
                  data-on={d.days.includes(wd) || undefined}
                  onClick={() => setD({ ...d, days: d.days.includes(wd) ? d.days.filter((x) => x !== wd) : [...d.days, wd] })}
                  className="mod-tab focus-ring text-xs"
                >
                  {weekdayName(wd, locale, "short")}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-faint)]">{w.dailyNote}</p>
            <label className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--ink)]">
              <input type="checkbox" checked={d.authorize} onChange={(e) => setD({ ...d, authorize: e.target.checked })} className="mt-0.5" />
              {w.authorize}
            </label>
          </>
        )}
      </fieldset>

      <label className="block text-xs text-[var(--ink-dim)]">
        {w.condition}
        <select value={d.condition} onChange={(e) => setD({ ...d, condition: e.target.value as Condition })} className={`${field} mt-1 cursor-pointer appearance-none`}>
          {CONDITIONS.map((c) => (
            <option key={c.key} value={c.key}>
              {w.conditions[c.key]}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs text-[var(--ink-dim)]">{fmt(w.steps, { n: d.steps.length, max: MAX_STEPS })}</legend>
        <ol className="space-y-2">
          {d.steps.map((s, i) => (
            <li key={i} className="tile flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-[var(--ink)]">
              <span className="tabular-nums text-xs text-[var(--ink-faint)]">{i + 1}.</span>
              <span className="min-w-0 flex-1 basis-40">{stepNameIn(s.type, locale)}</span>
              {s.type === "create_task" && (
                <>
                  <input value={s.title} onChange={(e) => setStep(i, { ...s, title: e.target.value })} aria-label={w.taskTitle} placeholder={w.taskTitle} maxLength={120} className={`${field} basis-48 flex-1`} />
                  <select value={s.dueInDays} onChange={(e) => setStep(i, { ...s, dueInDays: Number(e.target.value) })} aria-label={w.due} className={`${field} w-36`}>
                    {[0, 1, 2, 3, 7].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? w.sameDay : fmt(w.withinDays, { n })}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {s.type === "plan_workouts" && (
                <>
                  <select value={s.sessions} onChange={(e) => setStep(i, { ...s, sessions: Number(e.target.value) })} aria-label={w.sessions} className={`${field} w-24`}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {plural(locale, n, w.sessionOne, w.sessionMany)}
                      </option>
                    ))}
                  </select>
                  <select value={s.minutes} onChange={(e) => setStep(i, { ...s, minutes: Number(e.target.value) })} aria-label={w.length} className={`${field} w-24`}>
                    {[30, 45, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        {fmt(t.workspace.task.minutes, { n })}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button type="button" onClick={() => setD({ ...d, steps: d.steps.filter((_, j) => j !== i) })} aria-label={fmt(w.removeStep, { n: i + 1 })} className="focus-ring rounded p-1 text-[var(--ink-faint)] hover:text-[#ffb3a3]">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ol>
        {d.steps.length < MAX_STEPS && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STEP_CATALOG.map((c) => (
              <button key={c.type} type="button" title={w.catalog[c.type]} onClick={() => setD({ ...d, steps: [...d.steps, defaultStep(c.type)] })} className="mod-chip focus-ring text-xs">
                <Plus size={11} /> {stepNameIn(c.type, locale)}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="mod-chip mod-chip-gold focus-ring">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} {t.common.save}
        </button>
        <button type="button" onClick={onCancel} className="mod-chip focus-ring">
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}

function RunCard({ run, onUndone }: { run: Run; onUndone: (msg?: string) => void }) {
  const { t, locale } = useI18n();
  const w = t.workspace.wf;
  const tone = run.status === "done" ? "text-[#86d6a4]" : run.status === "failed" || run.status === "interrupted" ? "text-[#ffb3a3]" : "text-[#f0cd79]";
  return (
    <li className="tile px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--ink)]">
          {run.name}{" "}
          <span className={`ml-1 text-xs font-semibold ${tone}`}>
            {w.run[run.status]}
            {run.status === "done" && run.steps.some((s) => s.status !== "done") ? w.oneNotDone : ""}
          </span>
          {run.undone && <span className="ml-1 text-xs text-[var(--ink-faint)]">{w.undoneTag}</span>}
        </p>
        <span className="text-xs text-[var(--ink-faint)]">
          {run.trigger === "schedule" ? w.automatic : w.byYou} · {when(run.startedAt, locale)}
        </span>
      </div>
      {run.note && <p className="mt-1 text-xs text-[var(--ink-dim)]">{run.note}</p>}
      {run.status === "interrupted" && <p className="mt-1 text-xs text-[var(--ink-dim)]">{w.interrupted}</p>}
      <ul className="mt-1.5 space-y-1">
        {run.steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-xs leading-5 text-[var(--ink-dim)]">
            {s.status === "done" ? <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#86d6a4]" /> : s.status === "failed" ? <XCircle size={13} className="mt-0.5 shrink-0 text-[#ffb3a3]" /> : <CircleSlash size={13} className="mt-0.5 shrink-0 text-[var(--ink-faint)]" />}
            <span>
              <span className="text-[var(--ink)]">{s.label}</span> — {s.message}
            </span>
          </li>
        ))}
      </ul>
      {run.undo && !run.undone && (
        <button
          type="button"
          onClick={async () => {
            const r = await undoRunAction(run.id);
            onUndone("error" in r ? r.error : r.missed ? fmt(w.undoPartial, { n: r.missed }) : w.undoDone);
          }}
          className="mod-chip focus-ring mt-2 text-xs"
        >
          <Undo2 size={12} /> {w.undoRun}
        </button>
      )}
    </li>
  );
}

export function WorkflowsWorkspace({ workflows, runs, push }: { workflows: Workflow[]; runs: Run[]; push: boolean }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const w = t.workspace.wf;
  const [editing, setEditing] = useState<Draft | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState<{ id: string; opId: string; text: string } | null>(null);
  const done = (msg?: string) => {
    msg ??= "";
    setStatus(msg);
    setEditing(null);
    router.refresh();
  };

  const run = async (wf: Workflow, opId = newId(), confirmed = false) => {
    setBusy(wf.id);
    setStatus(null);
    try {
      const r = await runWorkflowAction(wf.id, opId, confirmed);
      if ("confirm" in r) setConfirmRun({ id: wf.id, opId, text: r.confirm });
      else if ("error" in r) setStatus(r.error);
      else if ("duplicate" in r) setStatus(w.already);
      else {
        const notDone = r.run.steps.filter((s) => s.status !== "done").length;
        const vars = { name: wf.name, status: w.run[r.run.status].toLowerCase(), n: notDone };
        setStatus(fmt(r.run.status === "done" && notDone ? (notDone > 1 ? w.resultExceptMany : w.resultExceptOne) : w.result, vars));
      }
    } catch {
      setStatus(w.unreachable);
    }
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      {status && (
        <p role="status" className="glass-card px-4 py-3 text-sm text-[var(--ink)]">
          {status}
        </p>
      )}
      {!push && workflows.some((x) => x.steps.some((s) => s.type === "notify_briefing")) && (
        <p className="text-xs text-[var(--ink-faint)]">{w.noPush}</p>
      )}

      {editing ? (
        <Builder initial={editing} onDone={done} onCancel={() => setEditing(null)} />
      ) : (
        <section className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <WorkflowIcon size={15} className="text-[#f0cd79]" /> {fmt(w.mine, { n: workflows.length })}
            </h2>
            <button type="button" onClick={() => setEditing(draftOf())} className="mod-chip mod-chip-gold focus-ring">
              <Plus size={13} /> {w.create}
            </button>
          </div>
          {workflows.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-[var(--ink-dim)]">{w.empty}</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {TEMPLATES.map((tpl, i) => {
                  const text = w.templates[TEMPLATE_KEYS[i]] ?? { name: tpl.name, desc: tpl.desc };
                  return (
                  <li key={tpl.name}>
                    <button type="button" onClick={() => setEditing(draftOf({ ...tpl.input, name: text.name, enabled: true }))} className="tile focus-ring h-full w-full px-3.5 py-3 text-left">
                      <p className="text-sm font-semibold text-[var(--ink)]">{text.name}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">{text.desc}</p>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {workflows.map((wf) => (
                <li key={wf.id} className="tile px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {wf.name}
                        {!wf.enabled && <span className="ml-2 text-xs font-normal text-[var(--ink-faint)]">{w.disabled}</span>}
                      </p>
                      <p className="text-xs text-[var(--ink-dim)]">
                        {triggerText(wf.trigger, w, locale)}
                        {wf.condition !== "always" && CONDITIONS.some((c) => c.key === wf.condition) ? ` · ${w.conditions[wf.condition].toLowerCase()}` : ""}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--ink-faint)]">{wf.steps.map((s) => stepLabelIn(s, locale)).join(" → ")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" disabled={busy === wf.id} onClick={() => run(wf)} className="mod-chip mod-chip-gold focus-ring" aria-label={fmt(w.runNamed, { name: wf.name })}>
                        {busy === wf.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} {w.launch}
                      </button>
                      {wf.trigger.type === "daily" && (
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await toggleWorkflowAction(wf.id, !wf.enabled);
                            done("error" in r ? r.error : fmt(wf.enabled ? w.paused : w.resumed, { name: wf.name }));
                          }}
                          className="mod-chip focus-ring"
                        >
                          {wf.enabled ? <Pause size={12} /> : <Play size={12} />} {wf.enabled ? w.disable : w.enable}
                        </button>
                      )}
                      <button type="button" onClick={() => setEditing(draftOf(wf))} className="focus-ring rounded p-1.5 text-[var(--ink-faint)] hover:text-[var(--ink)]" aria-label={fmt(w.editNamed, { name: wf.name })}>
                        <Pencil size={13} />
                      </button>
                      {confirmDelete === wf.id ? (
                        <span className="flex items-center gap-1.5 text-xs text-[var(--ink-dim)]">
                          {w.confirmDelete}
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await deleteWorkflowAction(wf.id);
                              setConfirmDelete(null);
                              done("error" in r ? r.error : fmt(w.deleted, { name: wf.name }));
                            }}
                            className="mod-chip focus-ring text-[#ffb3a3]"
                          >
                            {t.common.yes}
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="mod-chip focus-ring">
                            {t.common.no}
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(wf.id)} className="focus-ring rounded p-1.5 text-[var(--ink-faint)] hover:text-[#ffb3a3]" aria-label={fmt(w.deleteNamed, { name: wf.name })}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  {confirmRun?.id === wf.id && (
                    <div role="alertdialog" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ink)]">
                      {confirmRun.text}
                      <button
                        type="button"
                        onClick={() => {
                          const c = confirmRun;
                          setConfirmRun(null);
                          void run(wf, c.opId, true);
                        }}
                        className="mod-chip mod-chip-gold focus-ring"
                      >
                        {w.yesRun}
                      </button>
                      <button type="button" onClick={() => setConfirmRun(null)} className="mod-chip focus-ring">
                        {t.common.no}
                      </button>
                    </div>
                  )}
                  {wf.trigger.type === "daily" && needsConfirm(wf) && <p className="mt-1 text-[0.7rem] text-[var(--ink-faint)]">{w.authorized}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="glass-card p-5">
        <h2 className="text-sm font-semibold text-[var(--ink)]">{w.history}</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-dim)]">{w.noRuns}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {runs.map((r) => (
              <RunCard key={r.id} run={r} onUndone={done} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
