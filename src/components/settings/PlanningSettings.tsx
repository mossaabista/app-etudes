"use client";

import { useState, useTransition } from "react";
import { savePlanningPrefsAction } from "@/server/actions/pilot.actions";
import { WEEKDAYS, WEEKDAY_FR, type PlanningPrefs } from "@/lib/planning-prefs";

const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fromTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const input = "w-full rounded-lg border border-[rgba(255,220,148,0.18)] bg-[rgba(20,12,3,0.4)] px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[#e8bf63]";

/** The limits the Pilot and revision plans work within. */
export function PlanningSettings({ current }: { current: PlanningPrefs }) {
  const [v, setV] = useState(current);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<PlanningPrefs>) => {
    setV((x) => ({ ...x, ...patch }));
    setStatus(null);
  };
  const save = () =>
    start(async () => {
      const r = await savePlanningPrefsAction(v);
      if ("error" in r) return setStatus({ text: r.error ?? "Erreur.", error: true });
      setV(r.saved);
      setStatus({ text: "Enregistré. Les prochains plans respecteront ces limites." });
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-[var(--ink-dim)]">
          Rien avant
          <input type="time" value={toTime(v.dayStart)} onChange={(e) => e.target.value && set({ dayStart: fromTime(e.target.value) })} className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Rien après
          <input type="time" value={toTime(v.dayEnd)} onChange={(e) => e.target.value && set({ dayEnd: fromTime(e.target.value) || 24 * 60 })} className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Travail concentré max / jour (h)
          <input type="number" min={1} max={12} step={0.5} value={v.focusCap / 60} onChange={(e) => set({ focusCap: Math.round(Number(e.target.value) * 60) })} className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Pause après (min d&apos;affilée)
          <input type="number" min={25} max={240} step={5} value={v.streak} onChange={(e) => set({ streak: Number(e.target.value) })} className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Durée de la pause (min)
          <input type="number" min={5} max={60} step={5} value={v.breakMin} onChange={(e) => set({ breakMin: Number(e.target.value) })} className={`${input} mt-1`} />
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Marge autour des rendez-vous (min)
          <input type="number" min={0} max={60} step={5} value={v.buffer} onChange={(e) => set({ buffer: Number(e.target.value) })} className={`${input} mt-1`} />
        </label>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-xs text-[var(--ink-dim)]">Jours de repos (rien n&apos;y est planifié)</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const on = v.restDays.includes(d);
            return (
              <label key={d} className={`mod-chip cursor-pointer ${on ? "ring-1 ring-[#f0cd79]" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => set({ restDays: on ? v.restDays.filter((x) => x !== d) : [...v.restDays, d] })} className="h-3.5 w-3.5 accent-[#e8bf63]" />
                {WEEKDAY_FR[d]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p role="status" aria-live="polite" className={`mr-auto text-xs ${status?.error ? "text-[#ffb3a3]" : "text-[var(--ink-dim)]"}`}>
          {status?.text ?? "Tes cours, rendez-vous et échéances ne bougent jamais : ces limites encadrent seulement ce que le Pilote ajoute."}
        </p>
        <button type="button" onClick={save} disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
