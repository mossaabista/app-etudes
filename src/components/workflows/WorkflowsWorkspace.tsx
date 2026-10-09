"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleSlash, Loader2, Pause, Pencil, Play, Plus, Trash2, Undo2, Workflow as WorkflowIcon, XCircle } from "lucide-react";
import { CONDITIONS, MAX_STEPS, STEP_CATALOG, TEMPLATES, needsConfirm, stepLabel, triggerLabel, type Condition, type Step, type StepType, type Workflow } from "@/lib/workflows";
import { WEEKDAYS, WEEKDAY_FR } from "@/lib/planning-prefs";
import { deleteWorkflowAction, runWorkflowAction, saveWorkflowAction, toggleWorkflowAction, undoRunAction } from "@/server/actions/workflows.actions";
import type { Run } from "@/server/workflows";

const field = "w-full rounded-xl border border-[rgba(255,220,148,0.16)] bg-[rgba(20,14,6,0.55)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[rgba(255,220,148,0.45)]";
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
const when = (iso: string) => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const RUN_LABEL: Record<Run["status"], string> = { running: "En cours", done: "Réussie", partial: "En partie", failed: "Échouée", skipped: "Rien à faire", interrupted: "Interrompue" };

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
        onDone(d.id ? "Automatisation mise à jour." : "Automatisation créée.");
      }}
    >
      <h2 className="text-sm font-semibold text-[var(--ink)]">{d.id ? "Modifier l'automatisation" : "Nouvelle automatisation"}</h2>
      <label className="block text-xs text-[var(--ink-dim)]">
        Nom
        <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} className={`${field} mt-1`} placeholder="ex. Matin organisé" />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs text-[var(--ink-dim)]">Déclenchement</legend>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!d.daily} data-on={!d.daily || undefined} onClick={() => setD({ ...d, daily: false })} className="mod-tab focus-ring">
            À la demande
          </button>
          <button type="button" aria-pressed={d.daily} data-on={d.daily || undefined} onClick={() => setD({ ...d, daily: true })} className="mod-tab focus-ring">
            Chaque matin
          </button>
        </div>
        {d.daily && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={d.days.includes(w)}
                  data-on={d.days.includes(w) || undefined}
                  onClick={() => setD({ ...d, days: d.days.includes(w) ? d.days.filter((x) => x !== w) : [...d.days, w] })}
                  className="mod-tab focus-ring text-xs"
                >
                  {WEEKDAY_FR[w].slice(0, 3)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--ink-faint)]">Lancée une fois par jour choisi, tôt le matin (vers 7 h), par le serveur : pas besoin que l&apos;app soit ouverte.</p>
            <label className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--ink)]">
              <input type="checkbox" checked={d.authorize} onChange={(e) => setD({ ...d, authorize: e.target.checked })} className="mt-0.5" />
              J&apos;autorise OROM à exécuter ces étapes automatiquement, sans me demander, les jours choisis. Chaque exécution est journalisée et peut être annulée.
            </label>
          </>
        )}
      </fieldset>

      <label className="block text-xs text-[var(--ink-dim)]">
        Condition
        <select value={d.condition} onChange={(e) => setD({ ...d, condition: e.target.value as Condition })} className={`${field} mt-1 cursor-pointer appearance-none`}>
          {CONDITIONS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs text-[var(--ink-dim)]">Étapes, dans l&apos;ordre ({d.steps.length}/{MAX_STEPS})</legend>
        <ol className="space-y-2">
          {d.steps.map((s, i) => (
            <li key={i} className="tile flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-[var(--ink)]">
              <span className="tabular-nums text-xs text-[var(--ink-faint)]">{i + 1}.</span>
              <span className="min-w-0 flex-1 basis-40">{STEP_CATALOG.find((c) => c.type === s.type)?.label}</span>
              {s.type === "create_task" && (
                <>
                  <input value={s.title} onChange={(e) => setStep(i, { ...s, title: e.target.value })} aria-label="Titre de la tâche" placeholder="Titre de la tâche" maxLength={120} className={`${field} basis-48 flex-1`} />
                  <select value={s.dueInDays} onChange={(e) => setStep(i, { ...s, dueInDays: Number(e.target.value) })} aria-label="Échéance" className={`${field} w-36`}>
                    {[0, 1, 2, 3, 7].map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? "Le jour même" : `Sous ${n} j`}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {s.type === "plan_workouts" && (
                <>
                  <select value={s.sessions} onChange={(e) => setStep(i, { ...s, sessions: Number(e.target.value) })} aria-label="Nombre de séances" className={`${field} w-24`}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n} séance{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                  <select value={s.minutes} onChange={(e) => setStep(i, { ...s, minutes: Number(e.target.value) })} aria-label="Durée" className={`${field} w-24`}>
                    {[30, 45, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} min
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button type="button" onClick={() => setD({ ...d, steps: d.steps.filter((_, j) => j !== i) })} aria-label={`Retirer l'étape ${i + 1}`} className="focus-ring rounded p-1 text-[var(--ink-faint)] hover:text-[#ffb3a3]">
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ol>
        {d.steps.length < MAX_STEPS && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STEP_CATALOG.map((c) => (
              <button key={c.type} type="button" title={c.desc} onClick={() => setD({ ...d, steps: [...d.steps, defaultStep(c.type)] })} className="mod-chip focus-ring text-xs">
                <Plus size={11} /> {c.label}
              </button>
            ))}
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-xs text-[#ffb3a3]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="mod-chip mod-chip-gold focus-ring">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Enregistrer
        </button>
        <button type="button" onClick={onCancel} className="mod-chip focus-ring">
          Annuler
        </button>
      </div>
    </form>
  );
}

function RunCard({ run, onUndone }: { run: Run; onUndone: (msg?: string) => void }) {
  const tone = run.status === "done" ? "text-[#86d6a4]" : run.status === "failed" || run.status === "interrupted" ? "text-[#ffb3a3]" : "text-[#f0cd79]";
  return (
    <li className="tile px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--ink)]">
          {run.name}{" "}
          <span className={`ml-1 text-xs font-semibold ${tone}`}>
            {RUN_LABEL[run.status]}
            {run.status === "done" && run.steps.some((s) => s.status !== "done") ? " (une étape non faite)" : ""}
          </span>
          {run.undone && <span className="ml-1 text-xs text-[var(--ink-faint)]">· annulée</span>}
        </p>
        <span className="text-xs text-[var(--ink-faint)]">
          {run.trigger === "schedule" ? "Automatique" : "Lancée par toi"} · {when(run.startedAt)}
        </span>
      </div>
      {run.note && <p className="mt-1 text-xs text-[var(--ink-dim)]">{run.note}</p>}
      {run.status === "interrupted" && <p className="mt-1 text-xs text-[var(--ink-dim)]">L&apos;exécution s&apos;est arrêtée avant la fin : vérifie ton calendrier, rien d&apos;autre ne sera relancé seul.</p>}
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
            onUndone("error" in r ? r.error : r.missed ? `Annulée en partie : ${r.missed} élément(s) avaient déjà changé.` : "Exécution annulée.");
          }}
          className="mod-chip focus-ring mt-2 text-xs"
        >
          <Undo2 size={12} /> Annuler cette exécution
        </button>
      )}
    </li>
  );
}

export function WorkflowsWorkspace({ workflows, runs, push }: { workflows: Workflow[]; runs: Run[]; push: boolean }) {
  const router = useRouter();
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

  const run = async (w: Workflow, opId = newId(), confirmed = false) => {
    setBusy(w.id);
    setStatus(null);
    try {
      const r = await runWorkflowAction(w.id, opId, confirmed);
      if ("confirm" in r) setConfirmRun({ id: w.id, opId, text: r.confirm });
      else if ("error" in r) setStatus(r.error);
      else if ("duplicate" in r) setStatus("Déjà lancée : je ne la relance pas.");
      else {
        const notDone = r.run.steps.filter((s) => s.status !== "done").length;
        setStatus(`« ${w.name} » : ${RUN_LABEL[r.run.status].toLowerCase()}${r.run.status === "done" && notDone ? `, sauf ${notDone} étape${notDone > 1 ? "s" : ""} non faite${notDone > 1 ? "s" : ""}` : ""}. Le détail est dans l'historique.`);
      }
    } catch {
      setStatus("Je n'ai pas pu joindre le serveur : rien n'a été lancé.");
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
      {!push && workflows.some((w) => w.steps.some((s) => s.type === "notify_briefing")) && (
        <p className="text-xs text-[var(--ink-faint)]">Les notifications ne sont pas configurées sur ce serveur : l&apos;étape « résumé du jour » sera notée comme non faite.</p>
      )}

      {editing ? (
        <Builder initial={editing} onDone={done} onCancel={() => setEditing(null)} />
      ) : (
        <section className="glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <WorkflowIcon size={15} className="text-[#f0cd79]" /> Mes automatisations ({workflows.length})
            </h2>
            <button type="button" onClick={() => setEditing(draftOf())} className="mod-chip mod-chip-gold focus-ring">
              <Plus size={13} /> Créer
            </button>
          </div>
          {workflows.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-[var(--ink-dim)]">Aucune automatisation. Pars d&apos;un modèle :</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <li key={t.name}>
                    <button type="button" onClick={() => setEditing(draftOf({ ...t.input, enabled: true }))} className="tile focus-ring h-full w-full px-3.5 py-3 text-left">
                      <p className="text-sm font-semibold text-[var(--ink)]">{t.name}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">{t.desc}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {workflows.map((w) => (
                <li key={w.id} className="tile px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {w.name}
                        {!w.enabled && <span className="ml-2 text-xs font-normal text-[var(--ink-faint)]">désactivée</span>}
                      </p>
                      <p className="text-xs text-[var(--ink-dim)]">
                        {triggerLabel(w.trigger)}
                        {w.condition !== "always" ? ` · ${CONDITIONS.find((c) => c.key === w.condition)?.label.toLowerCase()}` : ""}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--ink-faint)]">{w.steps.map(stepLabel).join(" → ")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" disabled={busy === w.id} onClick={() => run(w)} className="mod-chip mod-chip-gold focus-ring" aria-label={`Lancer ${w.name}`}>
                        {busy === w.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Lancer
                      </button>
                      {w.trigger.type === "daily" && (
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await toggleWorkflowAction(w.id, !w.enabled);
                            done("error" in r ? r.error : w.enabled ? `« ${w.name} » ne se lancera plus seule.` : `« ${w.name} » est réactivée.`);
                          }}
                          className="mod-chip focus-ring"
                        >
                          {w.enabled ? <Pause size={12} /> : <Play size={12} />} {w.enabled ? "Désactiver" : "Activer"}
                        </button>
                      )}
                      <button type="button" onClick={() => setEditing(draftOf(w))} className="focus-ring rounded p-1.5 text-[var(--ink-faint)] hover:text-[var(--ink)]" aria-label={`Modifier ${w.name}`}>
                        <Pencil size={13} />
                      </button>
                      {confirmDelete === w.id ? (
                        <span className="flex items-center gap-1.5 text-xs text-[var(--ink-dim)]">
                          Supprimer avec son historique ?
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await deleteWorkflowAction(w.id);
                              setConfirmDelete(null);
                              done("error" in r ? r.error : `« ${w.name} » supprimée.`);
                            }}
                            className="mod-chip focus-ring text-[#ffb3a3]"
                          >
                            Oui
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="mod-chip focus-ring">
                            Non
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(w.id)} className="focus-ring rounded p-1.5 text-[var(--ink-faint)] hover:text-[#ffb3a3]" aria-label={`Supprimer ${w.name}`}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  {confirmRun?.id === w.id && (
                    <div role="alertdialog" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ink)]">
                      {confirmRun.text}
                      <button
                        type="button"
                        onClick={() => {
                          const c = confirmRun;
                          setConfirmRun(null);
                          void run(w, c.opId, true);
                        }}
                        className="mod-chip mod-chip-gold focus-ring"
                      >
                        Oui, lancer
                      </button>
                      <button type="button" onClick={() => setConfirmRun(null)} className="mod-chip focus-ring">
                        Non
                      </button>
                    </div>
                  )}
                  {w.trigger.type === "daily" && needsConfirm(w) && <p className="mt-1 text-[0.7rem] text-[var(--ink-faint)]">Le matin, elle tourne sans demander : tu l&apos;as autorisée.</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="glass-card p-5">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Historique des exécutions</h2>
        {runs.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ink-dim)]">Aucune exécution pour l&apos;instant.</p>
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
