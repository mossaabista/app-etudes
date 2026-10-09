"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Undo2 } from "lucide-react";
import { Block, field } from "@/components/modules/kit";
import { scheduleWorkoutsAction, undoWorkoutsAction } from "@/server/actions/fitness.actions";
import type { WorkoutTime } from "@/server/fitness";

const WHEN: { key: WorkoutTime; label: string }[] = [
  { key: "libre", label: "Peu importe" },
  { key: "matin", label: "Le matin" },
  { key: "midi", label: "Le midi" },
  { key: "soir", label: "Le soir" },
];

/** Book the week's sessions in free time, in one tap, with undo. */
export function WorkoutPlanner() {
  const router = useRouter();
  const [count, setCount] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [when, setWhen] = useState<WorkoutTime>("libre");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; ids: string[] } | null>(null);

  return (
    <Block
      title="Planifier mes séances de la semaine"
      hint="Dans ton temps libre des sept prochains jours : autour des cours, rendez-vous et repas, jamais un jour de repos ni un jour où tu t'entraînes déjà, avec un jour de récupération entre deux séances quand c'est possible."
      wide
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--ink-dim)]">
          Séances
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={`${field} mt-1 block w-24 cursor-pointer appearance-none`}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Durée
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${field} mt-1 block w-28 cursor-pointer appearance-none`}>
            {[30, 45, 60, 75, 90].map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          Moment
          <select value={when} onChange={(e) => setWhen(e.target.value as WorkoutTime)} className={`${field} mt-1 block w-36 cursor-pointer appearance-none`}>
            {WHEN.map((w) => (
              <option key={w.key} value={w.key}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await scheduleWorkoutsAction({ count, minutes, when });
              setResult({ message: r.message, ids: r.ids });
              router.refresh();
            } catch {
              setResult({ message: "Je n'ai pas pu joindre le serveur : rien n'a été ajouté.", ids: [] });
            }
            setBusy(false);
          }}
          className="mod-chip mod-chip-gold focus-ring"
        >
          <CalendarPlus size={13} /> {busy ? "Je cherche…" : "Trouver les créneaux et réserver"}
        </button>
      </div>
      {result && (
        <div role="status" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
          <span>{result.message}</span>
          {result.ids.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                const r = await undoWorkoutsAction(result.ids);
                setResult({ message: `Annulé : ${r.removed} séance${r.removed > 1 ? "s" : ""} retirée${r.removed > 1 ? "s" : ""} du calendrier.`, ids: [] });
                router.refresh();
              }}
              className="mod-chip focus-ring"
            >
              <Undo2 size={12} /> Annuler
            </button>
          )}
        </div>
      )}
    </Block>
  );
}
