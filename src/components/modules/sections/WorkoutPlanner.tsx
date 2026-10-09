"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Undo2 } from "lucide-react";
import { Block, field } from "@/components/modules/kit";
import { scheduleWorkoutsAction, undoWorkoutsAction } from "@/server/actions/fitness.actions";
import type { WorkoutTime } from "@/server/fitness";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

const WHEN: { key: WorkoutTime; label: "any" | "morning" | "noon" | "evening" }[] = [
  { key: "libre", label: "any" },
  { key: "matin", label: "morning" },
  { key: "midi", label: "noon" },
  { key: "soir", label: "evening" },
];

/** Book the week's sessions in free time, in one tap, with undo. */
export function WorkoutPlanner() {
  const { t, locale } = useI18n();
  const w = t.modulesA.planner;
  const router = useRouter();
  const [count, setCount] = useState(3);
  const [minutes, setMinutes] = useState(60);
  const [when, setWhen] = useState<WorkoutTime>("libre");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ message: string; ids: string[] } | null>(null);

  return (
    <Block
      title={w.title}
      hint={w.hint}
      wide
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-[var(--ink-dim)]">
          {w.sessions}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={`${field} mt-1 block w-24 cursor-pointer appearance-none`}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          {w.duration}
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${field} mt-1 block w-28 cursor-pointer appearance-none`}>
            {[30, 45, 60, 75, 90].map((n) => (
              <option key={n} value={n}>
                {fmt(t.modulesA.minutes, { n })}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[var(--ink-dim)]">
          {w.moment}
          <select value={when} onChange={(e) => setWhen(e.target.value as WorkoutTime)} className={`${field} mt-1 block w-36 cursor-pointer appearance-none`}>
            {WHEN.map((x) => (
              <option key={x.key} value={x.key}>
                {w[x.label]}
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
              // The server words its reply in French (with the days and times); in English, say what happened.
              const n = r.ids.length;
              const message = locale === "fr" ? r.message : n === 0 ? w.noSlot : n === 1 ? fmt(w.bookedOne, { min: minutes }) : fmt(w.bookedMany, { n, min: minutes });
              setResult({ message, ids: r.ids });
              router.refresh();
            } catch {
              setResult({ message: t.common.serverDown, ids: [] });
            }
            setBusy(false);
          }}
          className="mod-chip mod-chip-gold focus-ring"
        >
          <CalendarPlus size={13} /> {busy ? w.searching : w.book}
        </button>
      </div>
      {result && (
        <div role="status" className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--ink)]">
          <span>{result.message}</span>
          {result.ids.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const r = await undoWorkoutsAction(result.ids);
                  setResult({ message: fmt((locale === "fr" ? r.removed <= 1 : r.removed === 1) ? w.undoneOne : w.undoneMany, { n: r.removed }), ids: [] });
                  router.refresh();
                } catch {
                  setResult({ message: t.common.serverDown, ids: result.ids });
                }
              }}
              className="mod-chip focus-ring"
            >
              <Undo2 size={12} /> {t.common.undo}
            </button>
          )}
        </div>
      )}
    </Block>
  );
}
