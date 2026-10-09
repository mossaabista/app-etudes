"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Mic, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from "lucide-react";
import { resetLayoutAction, saveLayoutAction } from "@/server/actions/layout.actions";
import { LIBRARY, LIBRARY_SUBS, PALETTE, imageSrc, slug, type AreaSpec, type Layout } from "@/lib/layout";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

/**
 * Change the sectors by hand: rename, reorder, remove, add from the library, or start an
 * empty one. Nothing filed anywhere is deleted — a removed section's tasks and records stay
 * in the database and come back with it. Made-to-measure sections are the assistant's job.
 */
export function LayoutEditor({ layout }: { layout: Layout }) {
  const router = useRouter();
  const { t } = useI18n();
  const w = t.workspace.layout;
  const [open, setOpen] = useState(false);
  const [areas, setAreas] = useState<AreaSpec[]>(layout.areas);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const missingAreas = useMemo(() => LIBRARY.filter((l) => !areas.some((a) => a.key === l.key)), [areas]);
  const set = (i: number, patch: Partial<AreaSpec>) => setAreas((as) => as.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const move = (i: number, by: -1 | 1) =>
    setAreas((as) => {
      const j = i + by;
      if (j < 0 || j >= as.length) return as;
      const next = [...as];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () =>
    start(async () => {
      const res = await saveLayoutAction({ areas });
      if ("error" in res) return setError(res.error || w.saveFailed);
      setOpen(false);
      router.refresh();
    });
  const reset = () =>
    start(async () => {
      await resetLayoutAction();
      setOpen(false);
      router.refresh();
    });

  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setAreas(layout.areas);
          setOpen(true);
        }}
        className="mod-chip mod-chip-dark focus-ring"
      >
        <SlidersHorizontal size={13} /> {w.customize}
      </button>
    );

  return (
    <div className="qc-overlay" role="dialog" aria-modal="true" aria-label={w.customizeAria} onClick={() => setOpen(false)}>
      <div className="qc-sheet glass-card max-h-[80dvh] overflow-y-auto" style={{ width: "min(46rem, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <header className="mb-1 flex items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--ink)]">{w.title}</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label={t.common.close} className="ml-auto text-[var(--ink-faint)] hover:text-[var(--ink)]">
            <X size={16} />
          </button>
        </header>
        <p className="mb-4 flex items-start gap-1.5 text-xs leading-5 text-[var(--ink-dim)]">
          <Mic size={13} className="mt-0.5 shrink-0 text-[#f0cd79]" />
          {w.voiceHint}
        </p>

        <ul className="space-y-3">
          {areas.map((a, i) => {
            const missingSubs = LIBRARY_SUBS.filter((s) => !a.subs.some((x) => x.lib === s.id || x.key === s.key) && (s.area === a.key || !areas.some((o) => o.subs.some((x) => x.lib === s.id))));
            return (
              <li key={a.key} className="tile px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="color" value={a.color} onChange={(e) => set(i, { color: e.target.value })} aria-label={fmt(w.colorOf, { name: a.label })} className="h-7 w-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0" />
                  <input value={a.label} onChange={(e) => set(i, { label: e.target.value, front: e.target.value.split(/[\s&]/)[0].slice(0, 12) })} aria-label={w.sectorName} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--ink)] outline-none" />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={w.moveUp} className="focus-ring rounded p-1 text-[var(--ink-dim)] disabled:opacity-25">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === areas.length - 1} aria-label={w.moveDown} className="focus-ring rounded p-1 text-[var(--ink-dim)] disabled:opacity-25">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" onClick={() => setAreas((as) => as.filter((_, j) => j !== i))} aria-label={fmt(w.removeNamed, { name: a.label })} className="focus-ring rounded p-1 text-[var(--ink-faint)] hover:text-[#ff9f8c]">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {a.subs.map((s, k) => (
                    <span key={s.key} className="mod-chip">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageSrc(s.image)} alt="" className="h-4 w-4 object-contain" />
                      {s.label}
                      {s.custom && <span className="text-[10px] text-[#f0cd79]">{w.madeToMeasure}</span>}
                      <button type="button" onClick={() => set(i, { subs: a.subs.filter((_, j) => j !== k) })} aria-label={fmt(w.removeNamed, { name: s.label })} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {missingSubs.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const s = LIBRARY_SUBS.find((x) => x.id === e.target.value);
                        if (s) set(i, { subs: [...a.subs, { key: a.subs.some((x) => x.key === s.key) ? `${s.area}-${s.key}` : s.key, label: s.label, image: s.image, lib: s.id }] });
                      }}
                      aria-label={fmt(w.addSectionTo, { name: a.label })}
                      className="mod-chip cursor-pointer appearance-none bg-transparent"
                    >
                      <option value="">{w.addSection}</option>
                      {missingSubs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                          {s.area !== a.key ? ` (${s.areaLabel})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          {missingAreas.map((l) => (
            <button key={l.key} type="button" onClick={() => setAreas((as) => [...as, l])} className="mod-chip focus-ring">
              <Plus size={12} /> {l.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const label = fmt(w.newSector, { n: areas.length + 1 });
              setAreas((as) => [...as, { key: `${slug(label)}-${Date.now().toString(36).slice(-4)}`, label, front: w.newFront, color: PALETTE[as.length % PALETTE.length], blurb: "", subs: [] }]);
            }}
            className="mod-chip focus-ring"
          >
            <Plus size={12} /> {w.emptySector}
          </button>
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">{error}</p>}
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={reset} disabled={pending} className="mod-chip focus-ring">
            <RotateCcw size={12} /> {w.reset}
          </button>
          <button type="button" onClick={save} disabled={pending || areas.length === 0} className="mod-chip mod-chip-gold focus-ring px-5 py-2.5 text-sm">
            {pending ? w.saving : t.common.save}
          </button>
        </footer>
        <p className="mt-3 text-[0.7rem] text-[var(--ink-faint)]">{w.removeNote}</p>
      </div>
    </div>
  );
}
