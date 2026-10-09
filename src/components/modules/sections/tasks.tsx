"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, ChevronDown, Clock, Flag, ListTree, Pause, Play, Plus, RotateCcw, Sparkles, Target, Trash2, X } from "lucide-react";
import { Block, DayBars, Empty, Stats, addDays, dayLabel, field, lastDays, useEntries, type ModuleProps, type SectionTask } from "@/components/modules/kit";
import { deleteTaskAction, quickTaskAction, toggleTaskStatusAction, updateTaskFieldsAction } from "@/server/actions/task.actions";
import { aiHelperAction } from "@/server/actions/ai.actions";
import { ask } from "@/components/modules/SectionAssistant";

const PRIORITIES = [
  { key: "Critical", label: "P1", name: "Urgente", color: "#f07a6a" },
  { key: "High", label: "P2", name: "Haute", color: "#f0a35e" },
  { key: "Medium", label: "P3", name: "Normale", color: "#7aa7e8" },
  { key: "Low", label: "P4", name: "Basse", color: "#9d8455" },
];
const prio = (k: string) => PRIORITIES.find((p) => p.key === k) ?? PRIORITIES[2];
const RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

type View = "today" | "upcoming" | "nodate" | "done";
const FOCUS = 25;
const BREAK = 5;

/**
 * A task manager in the spirit of Todoist and TickTick: what is due today (and late),
 * what comes next, what has no date; priorities P1–P4; sub-tasks — split by the assistant
 * if you like; a focus timer started on a task; and the Eisenhower matrix worked out from
 * priority and due date instead of drawn by hand.
 */
export function Taches({ module, today, entries, tasks = [], category = "travail:taches" }: ModuleProps) {
  const [pending, start] = useTransition();
  const [view, setView] = useState<View>("today");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(today);
  const [priority, setPriority] = useState("Medium");
  const [minutes, setMinutes] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [focusOn, setFocusOn] = useState<SectionTask | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const open_ = tasks.filter((t) => !t.done);
  const overdue = open_.filter((t) => t.due && t.due < today);
  const lists: Record<View, SectionTask[]> = {
    today: open_.filter((t) => t.due && t.due <= today),
    upcoming: open_.filter((t) => t.due && t.due > today),
    nodate: open_.filter((t) => !t.due),
    done: tasks.filter((t) => t.done),
  };
  const sorted = [...lists[view]].sort((a, b) => (view === "upcoming" ? (a.due ?? "").localeCompare(b.due ?? "") : 0) || RANK[a.priority] - RANK[b.priority]);

  const focus = entries.filter((e) => e.kind === "focus");
  const focusOnDay = (d: string) => focus.filter((f) => f.day === d).reduce((s, f) => s + (f.value ?? 0), 0);

  const add = () => {
    if (!title.trim()) return;
    const t = title.trim();
    setTitle("");
    setMinutes("");
    start(async () => {
      await quickTaskAction({ title: t, category, due: view === "nodate" ? null : due, priority, minutes: minutes ? Number(minutes) : null });
    });
  };

  const breakdown = (t: SectionTask) => {
    setAiBusy(t.id);
    setNote(null);
    start(async () => {
      const res = await aiHelperAction({ kind: "breakdown", title: t.title });
      setAiBusy(null);
      if ("error" in res) return setNote(res.error);
      const steps = (res.result.steps as { title: string; minutes: number }[] | undefined) ?? [];
      for (const s of steps.slice(0, 8)) await quickTaskAction({ title: s.title, category, parentId: t.id, minutes: s.minutes });
      setOpen(t.id);
    });
  };

  // Eisenhower, computed: urgent = due within two days (or late), important = P1/P2.
  const urgent = (t: SectionTask) => !!t.due && t.due <= addDays(today, 2);
  const important = (t: SectionTask) => RANK[t.priority] <= 1;
  const quadrants = [
    { title: "Faire maintenant", hint: "Urgent et important", items: open_.filter((t) => urgent(t) && important(t)) },
    { title: "Planifier", hint: "Important, pas urgent", items: open_.filter((t) => !urgent(t) && important(t)) },
    { title: "Déléguer ou expédier", hint: "Urgent, moins important", items: open_.filter((t) => urgent(t) && !important(t)) },
    { title: "Plus tard ou jamais", hint: "Ni l'un ni l'autre", items: open_.filter((t) => !urgent(t) && !important(t)) },
  ];

  return (
    <>
      <Block
        title="Mes tâches"
        hint="Ajoute une tâche, donne-lui un jour et une priorité. L'assistant peut la découper en étapes, le Pilote la placer dans ta journée."
        wide
        action={
          <button type="button" onClick={() => ask("Planifie mes tâches de la journée")} className="mod-chip mod-chip-gold focus-ring">
            <Sparkles size={13} /> Planifier ma journée
          </button>
        }
      >
        <Stats
          items={[
            { label: "Aujourd'hui", value: String(lists.today.length), tone: "gold" },
            { label: "En retard", value: String(overdue.length) },
            { label: "À venir", value: String(lists.upcoming.length) },
            { label: "Focus aujourd'hui", value: `${focusOnDay(today)} min` },
          ]}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle tâche" aria-label="Nouvelle tâche" className={`${field} min-w-0 flex-1 basis-56`} />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Pour le" className={`${field} w-36`} />
          <div className="flex gap-1" role="radiogroup" aria-label="Priorité">
            {PRIORITIES.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={priority === p.key}
                aria-label={`Priorité ${p.name}`}
                onClick={() => setPriority(p.key)}
                className={`mod-chip focus-ring px-2 ${priority === p.key ? "ring-1 ring-[#f0cd79]" : "opacity-60"}`}
              >
                <Flag size={12} style={{ color: p.color }} /> {p.label}
              </button>
            ))}
          </div>
          <input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="min" aria-label="Durée estimée en minutes" className={`${field} w-20`} />
          <button type="submit" disabled={pending || !title.trim()} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> Ajouter
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist">
          {(
            [
              ["today", `Aujourd'hui · ${lists.today.length}`],
              ["upcoming", `À venir · ${lists.upcoming.length}`],
              ["nodate", `Sans date · ${lists.nodate.length}`],
              ["done", `Faites · ${lists.done.length}`],
            ] as [View, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className="mod-tab" data-on={view === k || undefined}>
              {l}
            </button>
          ))}
        </div>

        {note && <p className="mt-3 text-xs text-[#ffb3a3]">{note}</p>}

        <ul className="mt-3 space-y-2" aria-busy={pending}>
          {sorted.length === 0 ? (
            <Empty>{view === "today" ? "Rien pour aujourd'hui. Profite, ou avance une tâche à venir." : view === "done" ? "Aucune tâche terminée pour l'instant." : "Rien ici."}</Empty>
          ) : (
            sorted.map((t) => {
              const p = prio(t.priority);
              const late = !t.done && t.due && t.due < today;
              const isOpen = open === t.id;
              const subsDone = t.subtasks.filter((x) => x.done).length;
              return (
                <li key={t.id} data-land={`task-${t.id}`} className={`tile px-3.5 py-2.5 ${t.done ? "opacity-55" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={t.done}
                      aria-label={t.done ? `Rouvrir « ${t.title} »` : `Terminer « ${t.title} »`}
                      onClick={() => start(() => toggleTaskStatusAction(t.id))}
                      className="check focus-ring"
                      data-checked={t.done || undefined}
                      style={{ boxShadow: t.done ? undefined : `inset 0 0 0 1.5px ${p.color}` }}
                    >
                      {t.done && <Check size={12} strokeWidth={3} />}
                    </button>
                    <button type="button" onClick={() => setOpen(isOpen ? null : t.id)} className="min-w-0 flex-1 basis-40 text-left">
                      <span className={`block text-sm text-[var(--ink)] ${t.done ? "line-through" : ""}`}>{t.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-[var(--ink-dim)]">
                        <span style={{ color: p.color }}>{p.label}</span>
                        {t.due && (
                          <span className={late ? "font-semibold text-[#ffb3a3]" : ""}>
                            <CalendarDays size={11} className="mr-0.5 inline" />
                            {t.due === today ? "Aujourd'hui" : t.due === addDays(today, 1) ? "Demain" : late ? `En retard · ${dayLabel(t.due)}` : dayLabel(t.due)}
                          </span>
                        )}
                        {t.minutes && (
                          <span>
                            <Clock size={11} className="mr-0.5 inline" />
                            {t.minutes} min
                          </span>
                        )}
                        {t.subtasks.length > 0 && (
                          <span>
                            <ListTree size={11} className="mr-0.5 inline" />
                            {subsDone}/{t.subtasks.length}
                          </span>
                        )}
                      </span>
                    </button>
                    {!t.done && (
                      <>
                        <button type="button" onClick={() => setFocusOn(t)} className="mod-chip focus-ring" aria-label={`Se concentrer sur « ${t.title} »`}>
                          <Target size={12} /> Focus
                        </button>
                        <button type="button" onClick={() => breakdown(t)} disabled={!!aiBusy} className="mod-chip focus-ring" aria-label={`Découper « ${t.title} » en étapes`}>
                          <Sparkles size={12} /> {aiBusy === t.id ? "…" : "Découper"}
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => setOpen(isOpen ? null : t.id)} aria-label="Détails" aria-expanded={isOpen} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                      <ChevronDown size={15} className={isOpen ? "rotate-180" : ""} />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-3 space-y-3 border-t border-[rgba(255,220,148,0.08)] pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {PRIORITIES.map((x) => (
                          <button key={x.key} type="button" onClick={() => start(() => void updateTaskFieldsAction(t.id, { priority: x.key }))} className={`mod-chip focus-ring px-2 ${t.priority === x.key ? "ring-1 ring-[#f0cd79]" : "opacity-60"}`}>
                            <Flag size={12} style={{ color: x.color }} /> {x.name}
                          </button>
                        ))}
                        <input type="date" defaultValue={t.due ?? ""} onChange={(e) => start(() => void updateTaskFieldsAction(t.id, { due: e.target.value || null }))} aria-label="Échéance" className={`${field} w-36`} />
                        <button type="button" onClick={() => start(() => void deleteTaskAction(t.id))} className="mod-chip focus-ring ml-auto text-[#ffb3a3]">
                          <Trash2 size={12} /> Supprimer
                        </button>
                      </div>
                      <Subtasks task={t} category={category} />
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </Block>

      <FocusTimer key={focusOn?.id ?? "none"} module={module} today={today} task={focusOn} onClear={() => setFocusOn(null)} />

      <Block title="Matrice d'Eisenhower" hint="Calculée pour toi : urgent = à faire dans les deux jours, important = priorité P1 ou P2.">
        <div className="grid grid-cols-2 gap-2">
          {quadrants.map((q, i) => (
            <div key={q.title} className="mod-stat min-h-[6.5rem]">
              <span className={`text-sm font-semibold ${i === 0 ? "text-[#f07a6a]" : i === 1 ? "text-[#f0cd79]" : "text-[var(--ink)]"}`}>
                {q.title} · {q.items.length}
              </span>
              <span className="text-[0.68rem] text-[var(--ink-faint)]">{q.hint}</span>
              <ul className="mt-1.5 space-y-0.5">
                {q.items.slice(0, 4).map((t) => (
                  <li key={t.id} className="truncate text-xs text-[var(--ink-dim)]">
                    · {t.title}
                  </li>
                ))}
                {q.items.length > 4 && <li className="text-[0.68rem] text-[var(--ink-faint)]">+{q.items.length - 4}</li>}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-xs text-[var(--ink-dim)]">Concentration, 7 derniers jours</p>
          <DayBars days={lastDays(today, 7)} value={focusOnDay} target={120} unit="min" />
        </div>
      </Block>
    </>
  );
}

function Subtasks({ task, category }: { task: SectionTask; category: string }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  return (
    <div>
      <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Étapes</p>
      <ul className="space-y-1.5">
        {task.subtasks.map((s) => (
          <li key={s.id} data-land={`sub-${s.id}`} className="flex items-center gap-2.5">
            <button type="button" role="checkbox" aria-checked={s.done} aria-label={s.title} onClick={() => start(() => toggleTaskStatusAction(s.id))} className="check focus-ring scale-90" data-checked={s.done || undefined}>
              {s.done && <Check size={11} strokeWidth={3} />}
            </button>
            <span className={`min-w-0 flex-1 text-sm text-[var(--ink)] ${s.done ? "line-through opacity-60" : ""}`}>{s.title}</span>
            <button type="button" onClick={() => start(() => deleteTaskAction(s.id))} aria-label={`Retirer ${s.title}`} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const t = text.trim();
          setText("");
          start(async () => {
            await quickTaskAction({ title: t, category, parentId: task.id });
          });
        }}
        className="mt-2 flex gap-2"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une étape" aria-label="Nouvelle étape" className={`${field} flex-1 py-1.5 text-xs`} />
        <button type="submit" disabled={pending} className="mod-chip focus-ring">
          <Plus size={12} />
        </button>
      </form>
    </div>
  );
}

function FocusTimer({ module, today, task, onClear }: { module: string; today: string; task: SectionTask | null; onClear: () => void }) {
  const { add } = useEntries(module);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [left, setLeft] = useState(FOCUS * 60);
  // Mounted afresh for each task (see the key), so choosing one starts its block.
  const [running, setRunning] = useState(!!task);
  const clock = useRef({ left: FOCUS * 60, mode: "focus" as "focus" | "break" });
  const taskRef = useRef<SectionTask | null>(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);


  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const c = clock.current;
      c.left -= 1;
      if (c.left > 0) {
        setLeft(c.left);
        return;
      }
      clearInterval(id);
      setRunning(false);
      if (c.mode === "focus") add("focus", { day: today, value: FOCUS, text: taskRef.current?.title ?? null, data: taskRef.current ? { taskId: taskRef.current.id } : {} });
      c.mode = c.mode === "focus" ? "break" : "focus";
      c.left = (c.mode === "focus" ? FOCUS : BREAK) * 60;
      setMode(c.mode);
      setLeft(c.left);
    }, 1000);
    return () => clearInterval(id);
  }, [running, add, today]);

  const total = (mode === "focus" ? FOCUS : BREAK) * 60;
  const ring = useMemo(() => 2 * Math.PI * 45, []);

  return (
    <Block title="Concentration" hint="25 minutes sur une seule tâche, puis 5 minutes de pause (méthode Pomodoro). Lance-le depuis le bouton « Focus » d'une tâche.">
      <div className="flex flex-col items-center gap-4 py-1 sm:flex-row sm:justify-between">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,220,148,0.12)" strokeWidth="5" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="#f0cd79" strokeWidth="5" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (left / total)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="text-center">
            <p className="text-3xl font-semibold tabular-nums text-[var(--ink)]">
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </p>
            <p className="text-xs text-[var(--ink-dim)]">{mode === "focus" ? "Travail" : "Pause"}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-3 sm:items-end">
          <p className="max-w-[14rem] truncate text-sm text-[var(--ink)]">{task ? task.title : "Aucune tâche choisie"}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setRunning((r) => !r)} className="mod-chip mod-chip-gold focus-ring">
              {running ? <Pause size={13} /> : <Play size={13} />} {running ? "Pause" : "Démarrer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                clock.current = { left: FOCUS * 60, mode: "focus" };
                setMode("focus");
                setLeft(FOCUS * 60);
                onClear();
              }}
              className="mod-chip focus-ring"
            >
              <RotateCcw size={13} /> Réinitialiser
            </button>
          </div>
        </div>
      </div>
    </Block>
  );
}
