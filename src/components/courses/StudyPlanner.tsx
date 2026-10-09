"use client";

import { expectLanding } from "@/components/layout/LandWatcher";
import { useState, useTransition } from "react";
import { BrainCircuit, CalendarCheck, Check, Sparkles, X } from "lucide-react";
import { acceptStudyAction, proposeStudyAction } from "@/server/actions/study.actions";
import type { StudyPlan } from "@/server/study";

export interface PlannerTarget {
  id: string;
  title: string;
  type: string;
  due: string;
  weight: number | null;
  code: string;
}

const dayTitle = (iso: string) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
const hours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`);
const len = (a: string, b: string) => Number(b.slice(0, 2)) * 60 + Number(b.slice(3)) - (Number(a.slice(0, 2)) * 60 + Number(a.slice(3)));

/**
 * "Plan de révision": pick what to prepare (or everything coming up), get a schedule of
 * sessions fitted around classes and life, then put it on the calendar in one tap.
 */
export function StudyPlanner({ targets, all = false, title = "Plan de révision" }: { targets: PlannerTarget[]; all?: boolean; title?: string }) {
  const [selected, setSelected] = useState<string[]>(() => (all ? targets.map((t) => t.id) : targets[0] ? [targets[0].id] : []));
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const propose = () =>
    start(async () => {
      setNote(null);
      const res = await proposeStudyAction(all && selected.length === targets.length ? "upcoming" : selected);
      if ("error" in res) return setNote(res.error);
      setPlan(res);
    });
  const accept = () =>
    plan &&
    start(async () => {
      expectLanding();
      const res = await acceptStudyAction(plan.sessions);
      setNote(`${res.count} séance${res.count > 1 ? "s" : ""} ajoutée${res.count > 1 ? "s" : ""} à ton calendrier.`);
      setPlan(null);
    });

  const byDay = plan ? Object.entries(plan.sessions.reduce<Record<string, StudyPlan["sessions"]>>((m, s) => ((m[s.date] ??= []).push(s), m), {})) : [];
  const nameOf = (id: string) => plan?.targets.find((t) => t.id === id);
  const planned = plan ? plan.sessions.reduce((s, x) => s + len(x.start, x.end), 0) : 0;

  return (
    <section className="glass-card p-5" aria-busy={pending}>
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <span className="pilot-orb" aria-hidden>
          <BrainCircuit size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
          <p className="text-xs text-[var(--ink-dim)]">
            Les chapitres à revoir, le temps qu&apos;il faut, et des séances placées dans tes vrais créneaux libres — avant l&apos;évaluation, jamais après.
          </p>
        </div>
      </header>

      {targets.length === 0 ? (
        <p className="py-3 text-center text-xs text-[var(--ink-faint)]">Aucune évaluation dans les 3 prochaines semaines.</p>
      ) : (
        !plan && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {targets.map((t) => {
                const on = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected((s) => (on ? s.filter((x) => x !== t.id) : [...s, t.id]))}
                    className={`mod-chip focus-ring ${on ? "mod-chip-gold" : ""}`}
                  >
                    {on && <Check size={12} />}
                    {all ? `${t.code} · ` : ""}
                    {t.title} · {new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${t.due}T12:00:00Z`))}
                    {t.weight != null ? ` · ${String(t.weight).replace(".", ",")} %` : ""}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={propose} disabled={pending || selected.length === 0} className="mod-chip mod-chip-gold focus-ring px-5 py-2.5">
                <Sparkles size={14} /> {pending ? "Je prépare ton plan…" : "Préparer mon plan"}
              </button>
            </div>
          </>
        )
      )}

      {note && <p className="mt-3 text-xs text-[#f0cd79]">{note}</p>}

      {plan && (
        <div className="mt-2 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="mod-stat">
              <span className="text-[0.68rem] uppercase tracking-wide text-[var(--ink-faint)]">À prévoir</span>
              <span className="mt-1 text-lg font-semibold text-[var(--ink)]">{hours(plan.totalMinutes)}</span>
            </div>
            <div className="mod-stat">
              <span className="text-[0.68rem] uppercase tracking-wide text-[var(--ink-faint)]">Planifié</span>
              <span className="mt-1 text-lg font-semibold text-[#f0cd79]">{hours(planned)}</span>
            </div>
            <div className="mod-stat">
              <span className="text-[0.68rem] uppercase tracking-wide text-[var(--ink-faint)]">Séances</span>
              <span className="mt-1 text-lg font-semibold text-[var(--ink)]">{plan.sessions.length}</span>
            </div>
          </div>

          {plan.chapters.length > 0 && (
            <div>
              <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Ce qu&apos;il faut maîtriser</p>
              <ul className="space-y-1.5">
                {plan.chapters.map((c, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-[var(--ink)]">
                    <span className="flex gap-0.5" aria-label={`Difficulté ${c.difficulty} sur 3`}>
                      {[1, 2, 3].map((n) => (
                        <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= c.difficulty ? "bg-[#f0cd79]" : "bg-[rgba(255,220,148,0.18)]"}`} />
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">{c.title}</span>
                    <span className="shrink-0 text-xs text-[var(--ink-dim)]">{hours(c.minutes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Tes séances</p>
            <div className="space-y-3">
              {byDay.map(([day, list]) => (
                <div key={day}>
                  <p className="mb-1.5 text-xs font-semibold capitalize text-[var(--ink-dim)]">{dayTitle(day)}</p>
                  <ul className="space-y-1.5">
                    {list.map((s, i) => (
                      <li key={i} className="tile flex items-start gap-3 px-3.5 py-2.5">
                        <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-[#f0cd79]">
                          {s.start}–{s.end}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[var(--ink)]">{s.topic}</p>
                          <p className="text-xs text-[var(--ink-dim)]">
                            {nameOf(s.assessmentId) && plan.targets.length > 1 ? `${nameOf(s.assessmentId)!.course.code} · ${nameOf(s.assessmentId)!.title} · ` : ""}
                            {s.method}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {plan.advice && <p className="rounded-2xl bg-[rgba(240,205,121,0.08)] px-4 py-3 text-xs leading-5 text-[var(--ink-dim)]">{plan.advice}</p>}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[0.7rem] text-[var(--ink-faint)]">{plan.source === "ai" ? "Plan conçu par l'assistant" : "Plan par répétition espacée"} · remplace un plan précédent pour ces évaluations</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPlan(null)} disabled={pending} className="mod-chip focus-ring">
                <X size={13} /> Ignorer
              </button>
              <button type="button" onClick={accept} disabled={pending || plan.sessions.length === 0} className="mod-chip mod-chip-gold focus-ring">
                <CalendarCheck size={13} /> Ajouter au calendrier
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
