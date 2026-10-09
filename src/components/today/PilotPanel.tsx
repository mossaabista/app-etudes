"use client";

import { expectLanding } from "@/components/layout/LandWatcher";
import { useState, useTransition } from "react";
import { Check, HelpCircle, Sparkles, Undo2, X } from "lucide-react";
import { acceptPlanAction, proposePlanAction, undoPlanAction } from "@/server/actions/pilot.actions";
import type { PlanBlock } from "@/server/pilot";

const hours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`);

/**
 * The Pilot: one tap fills the free time of the day with what matters most, shown first as
 * a proposal; accepted blocks land on the calendar in their section's colour.
 */
export function PilotPanel({ day, planned }: { day: string; planned: number }) {
  const [pending, start] = useTransition();
  const [plan, setPlan] = useState<{ blocks: PlanBlock[]; left: number; free: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const isToday = day === new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

  const propose = () =>
    start(async () => {
      const res = await proposePlanAction(day);
      if ("error" in res) return setNote(res.error ?? null);
      setPlan(res);
      setNote(null);
    });
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
            {plan
              ? `${hours(plan.free)} de libre ${isToday ? "aujourd'hui" : "ce jour-là"} · ${plan.blocks.length} bloc${plan.blocks.length > 1 ? "s" : ""} proposé${plan.blocks.length > 1 ? "s" : ""}${plan.left ? ` · ${plan.left} autre${plan.left > 1 ? "s" : ""} en attente d'un créneau` : ""}`
              : planned
                ? `Plan actif : ${planned} bloc${planned > 1 ? "s" : ""} au calendrier.`
                : "Range tes tâches et tes révisions dans les trous de ta journée, entre tes cours et tes rendez-vous."}
          </p>
        </div>
        <button type="button" onClick={() => setHelp((h) => !h)} aria-expanded={help} aria-label="Comment marche le Pilote" className="focus-ring rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]">
          <HelpCircle size={16} />
        </button>
        {!plan && (
          <div className="flex gap-2">
            {planned > 0 && (
              <button type="button" onClick={undo} disabled={pending} className="mod-chip focus-ring">
                <Undo2 size={13} /> Défaire
              </button>
            )}
            <button type="button" onClick={propose} disabled={pending} className="mod-chip mod-chip-gold focus-ring">
              <Sparkles size={13} /> {pending ? "Calcul…" : planned ? "Replanifier" : "Planifier ma journée"}
            </button>
          </div>
        )}
      </header>

      {help && (
        <ul className="mt-4 space-y-1.5 rounded-2xl bg-[rgba(255,220,148,0.05)] px-4 py-3 text-xs leading-5 text-[var(--ink-dim)]">
          <li>· Il ne place rien sur tes cours, tes rendez-vous ni tes repas (12 h–13 h, 18 h 30–19 h 30), et jamais dans le passé.</li>
          <li>· Pour chaque évaluation à venir, il estime le temps de préparation (un quiz ≈ 1 h 30, un examen ≈ 6 h, ajusté au poids) et le répartit sur les jours qui restent.</li>
          <li>· La révision finit toujours au moins 30 min avant l&apos;examen ou le quiz, et une heure avant une remise.</li>
          <li>· Les tâches passent avant leur échéance, les plus urgentes et les plus lourdes d&apos;abord ; le sport et les courses plutôt en fin de journée.</li>
          <li>· Une pause de 15 min après 1 h 30 d&apos;affilée, et pas plus de 6 h de travail concentré par jour.</li>
          <li>· Rien n&apos;est ajouté avant que tu valides, et « Défaire » retire uniquement ses blocs.</li>
        </ul>
      )}

      {note && !plan && <p className="mt-3 text-xs text-[#f0cd79]">{note}</p>}

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
