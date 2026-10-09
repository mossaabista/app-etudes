"use client";

import { expectLanding } from "@/components/layout/LandWatcher";
import { useState, useTransition } from "react";
import { AlertTriangle, Check, HelpCircle, Sparkles, Undo2, X } from "lucide-react";
import { acceptPlanAction, acceptWeekAction, proposePlanAction, proposeWeekAction, undoPlanAction, undoWeekAction } from "@/server/actions/pilot.actions";
import type { DayPlan, Unplaced, WeekPlan } from "@/server/pilot";
import { DEFAULT_PLANNING, WEEKDAY_FR, hm, type PlanningPrefs } from "@/lib/planning-prefs";

const hours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`);

/**
 * The Pilot: one tap fills the free time of the day with what matters most, shown first as
 * a proposal; accepted blocks land on the calendar in their section's colour.
 */
export function PilotPanel({ day, planned, prefs = DEFAULT_PLANNING }: { day: string; planned: number; prefs?: PlanningPrefs }) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"day" | "week">("day");
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [week, setWeek] = useState<WeekPlan | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const isToday = day === new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

  const propose = () =>
    start(async () => {
      setNote(null);
      if (mode === "week") {
        const res = await proposeWeekAction(day);
        if ("error" in res) return setNote(res.error ?? null);
        setWeek(res);
        return;
      }
      const res = await proposePlanAction(day);
      if ("error" in res) return setNote(res.error ?? null);
      if (res.rest) return setNote("Jour de repos dans tes préférences : le Pilote n'y place rien.");
      setPlan(res);
    });
  const acceptWeek = () =>
    week &&
    start(async () => {
      expectLanding();
      const res = await acceptWeekAction(week.days.map((d) => ({ day: d.day, blocks: d.blocks })));
      setNote("count" in res ? `${res.count} bloc${res.count > 1 ? "s" : ""} ajouté${res.count > 1 ? "s" : ""} sur la semaine.` : null);
      setWeek(null);
    });
  const undoWeek = () =>
    start(async () => {
      const res = await undoWeekAction(day);
      setNote("count" in res ? `${res.count} bloc(s) du Pilote retiré(s) sur 7 jours.` : null);
    });
  const weekCount = week ? week.days.reduce((n, d) => n + d.blocks.length, 0) : 0;
  const dayLabel = (iso: string) => new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00Z`));
  const accept = () =>
    plan &&
    start(async () => {
      expectLanding();
      await acceptPlanAction(day, plan.blocks);
      setNote(`${plan.blocks.length} bloc${plan.blocks.length > 1 ? "s" : ""} ajouté${plan.blocks.length > 1 ? "s" : ""} au calendrier.`);
      setPlan(null);
    });
  const undo = () =>
    start(async () => {
      const res = await undoPlanAction(day);
      setNote("count" in res ? `${res.count} bloc(s) retiré(s).` : null);
    });

  return (
    <section className="pilot glass-card p-5" aria-busy={pending}>
      <header className="flex flex-wrap items-center gap-3">
        <span className="pilot-orb" aria-hidden>
          <Sparkles size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Pilote</h2>
          <p className="text-xs text-[var(--ink-dim)]">
            {week
              ? `Semaine : ${weekCount} bloc${weekCount > 1 ? "s" : ""} proposé${weekCount > 1 ? "s" : ""} autour de ${week.fixed} engagement${week.fixed > 1 ? "s" : ""} fixe${week.fixed > 1 ? "s" : ""}, qui ne bougent pas${week.unplaced.length ? ` · ${week.unplaced.length} sans place` : ""}`
              : plan
              ? `${hours(plan.free)} de libre ${isToday ? "aujourd'hui" : "ce jour-là"} · ${plan.blocks.length} bloc${plan.blocks.length > 1 ? "s" : ""} proposé${plan.blocks.length > 1 ? "s" : ""}${plan.left ? ` · ${plan.left} autre${plan.left > 1 ? "s" : ""} en attente d'un créneau` : ""}`
              : planned
                ? `Plan actif : ${planned} bloc${planned > 1 ? "s" : ""} au calendrier.`
                : "Range tes tâches et tes révisions dans les trous de ta journée, entre tes cours et tes rendez-vous."}
          </p>
        </div>
        <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} aria-label="Comment marche le Pilote" className="focus-ring rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]">
          <HelpCircle size={16} />
        </button>
        {!plan && !week && (
          <div className="flex flex-wrap gap-2">
            <div role="group" aria-label="Période" className="flex rounded-full bg-[rgba(255,220,148,0.06)] p-0.5">
              {(["day", "week"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`focus-ring rounded-full px-3 py-1 text-xs font-medium ${mode === m ? "bg-[rgba(255,220,148,0.16)] text-[var(--ink)]" : "text-[var(--ink-faint)]"}`}>
                  {m === "day" ? "Jour" : "Semaine"}
                </button>
              ))}
            </div>
            {mode === "day" && planned > 0 && (
              <button type="button" onClick={undo} disabled={pending} className="mod-chip focus-ring">
                <Undo2 size={13} /> Défaire
              </button>
            )}
            {mode === "week" && (
              <button type="button" onClick={undoWeek} disabled={pending} className="mod-chip focus-ring">
                <Undo2 size={13} /> Défaire la semaine
              </button>
            )}
            <button type="button" onClick={propose} disabled={pending} className="mod-chip mod-chip-gold focus-ring">
              <Sparkles size={13} /> {pending ? "Calcul…" : mode === "week" ? "Planifier ma semaine" : planned ? "Replanifier" : "Planifier ma journée"}
            </button>
          </div>
        )}
      </header>

      {help && (
        <ul className="mt-4 space-y-1.5 rounded-2xl bg-[rgba(255,220,148,0.05)] px-4 py-3 text-xs leading-5 text-[var(--ink-dim)]">
          <li>· Il ne déplace jamais tes cours, rendez-vous ni échéances : il ajoute des blocs dans le temps libre, entre {hm(prefs.dayStart)} et {hm(prefs.dayEnd)}, avec {prefs.buffer} min de marge autour de chaque engagement, et pas sur tes repas (12 h–13 h, 18 h 30–19 h 30), ni dans le passé{prefs.restDays.length ? `, ni le ${prefs.restDays.map((d) => WEEKDAY_FR[d].toLowerCase()).join(" ni le ")}` : ""}.</li>
          <li>· Pour chaque évaluation à venir, il estime le temps de préparation (un quiz ≈ 1 h 30, un examen ≈ 6 h, ajusté au poids) et le répartit sur les jours qui restent.</li>
          <li>· La révision finit toujours au moins 30 min avant l&apos;examen ou le quiz, et une heure avant une remise.</li>
          <li>· Les tâches passent avant leur échéance, les plus urgentes et les plus lourdes d&apos;abord ; le sport et les courses plutôt en fin de journée.</li>
          <li>· Une pause de {prefs.breakMin} min après {hm(prefs.streak)} d&apos;affilée, et pas plus de {hm(prefs.focusCap)} de travail concentré par jour. Ces limites se règlent dans Réglages → Planification.</li>
          <li>· Une échéance reste une échéance : le temps pour y travailler est un bloc séparé, avant elle.</li>
          <li>· Rien n&apos;est ajouté avant que tu valides, et « Défaire » retire uniquement ses blocs.</li>
        </ul>
      )}

      {note && !plan && !week && <p className="mt-3 text-xs text-[#f0cd79]">{note}</p>}

      {week && (
        <div className="mt-4 space-y-3">
          {week.days.map((d) => (
            <div key={d.day}>
              <p className="mb-1 text-xs font-semibold capitalize text-[var(--ink-dim)]">
                {dayLabel(d.day)} · {d.rest ? "jour de repos" : d.blocks.length ? `${d.blocks.length} bloc${d.blocks.length > 1 ? "s" : ""} · ${hours(d.free)} de libre` : "rien à placer"}
              </p>
              {d.blocks.length > 0 && (
                <ul className="space-y-1">
                  {d.blocks.map((b, i) => (
                    <li key={i} className="tile flex items-center gap-3 px-3 py-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.color }} aria-hidden />
                      <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-[#f0cd79]">
                        {b.start}–{b.end}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-[var(--ink)]">{b.title}</span>
                        <span className="block truncate text-xs text-[var(--ink-dim)]">{b.why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <UnplacedList items={week.unplaced} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setWeek(null)} disabled={pending} className="mod-chip focus-ring">
              <X size={13} /> Ignorer
            </button>
            {weekCount > 0 && (
              <button type="button" onClick={acceptWeek} disabled={pending} className="mod-chip mod-chip-gold focus-ring">
                <Check size={13} /> Valider la semaine
              </button>
            )}
          </div>
        </div>
      )}

      {plan && (
        <div className="mt-4">
          {plan.blocks.length === 0 ? (
            <p className="py-3 text-center text-xs text-[var(--ink-faint)]">Rien d&apos;urgent à placer : profite de ta journée.</p>
          ) : (
            <ol className="relative space-y-2 pl-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-[rgba(255,220,148,0.2)]">
              {plan.blocks.map((b, i) => (
                <li key={`${b.start}-${i}`} className="pilot-step relative" style={{ "--i": i } as React.CSSProperties}>
                  <span className="absolute -left-4 top-3 h-2.5 w-2.5 rounded-full ring-2 ring-[#1a1106]" style={{ background: b.color }} aria-hidden />
                  <div className="tile flex items-center gap-3 px-3.5 py-2.5">
                    <span className="w-24 shrink-0 text-xs font-semibold tabular-nums text-[#f0cd79]">
                      {b.start}–{b.end}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--ink)]">{b.title}</p>
                      <p className="truncate text-xs text-[var(--ink-dim)]">{b.why}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <UnplacedList items={plan.unplaced} />
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPlan(null)} disabled={pending} className="mod-chip focus-ring">
              <X size={13} /> Ignorer
            </button>
            {plan.blocks.length > 0 && (
              <button type="button" onClick={accept} disabled={pending} className="mod-chip mod-chip-gold focus-ring">
                <Check size={13} /> Valider le plan
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** What found no slot, said plainly, with a way out. */
function UnplacedList({ items }: { items: Unplaced[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 rounded-2xl border border-[rgba(255,179,163,0.25)] px-3.5 py-3" role="status">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#ffd9a8]">
        <AlertTriangle size={13} aria-hidden /> Sans place ({items.length})
      </p>
      <ul className="mt-1.5 space-y-1 text-xs text-[var(--ink-dim)]">
        {items.slice(0, 8).map((u) => (
          <li key={u.title}>
            <span className="text-[var(--ink)]">{u.title}</span> — {u.reason}
            {u.why ? ` (${u.why})` : ""}.
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[0.7rem] text-[var(--ink-faint)]">Options : raccourcir un bloc, déplacer une tâche flexible, repousser une échéance, ou alléger un autre jour.</p>
    </div>
  );
}
