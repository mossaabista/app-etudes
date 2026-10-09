"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { LiquidLayers } from "@/components/ui/LiquidMetal";

export interface DeckDay {
  iso: string;
  node: React.ReactNode;
}

/** Below this, a horizontal drag counts as a tap rather than a swipe. */
const SWIPE_PX = 45;

/**
 * A day zoomed out of the month grid into the same coverflow deck as Today, one card per
 * day. Unlike Today's three panels it runs in a line rather than a ring: wrapping from the
 * last day of the grid back to the first would read as time going backwards.
 */
export function DayDeck({
  days,
  active,
  onChange,
  onClose,
  label,
}: {
  days: DeckDay[];
  active: number;
  onChange: (index: number) => void;
  onClose: () => void;
  label: (iso: string) => string;
}) {
  const startX = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canBack = active > 0;
  const canForward = active < days.length - 1;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && active > 0) onChange(active - 1);
      else if (e.key === "ArrowRight" && active < days.length - 1) onChange(active + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, days.length, onChange, onClose]);

  function onPointerUp(e: React.PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (dx <= -SWIPE_PX && canForward) onChange(active + 1);
    else if (dx >= SWIPE_PX && canBack) onChange(active - 1);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={label(days[active].iso)} className="day-overlay fixed inset-0 z-[60] flex flex-col">
      <div className="glass-backdrop" aria-hidden />
      <div className="absolute inset-0 bg-[rgba(30,18,4,0.35)] backdrop-blur-sm" aria-hidden />

      <div className="relative flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:px-8 md:pt-6">
        <h2 className="truncate text-lg font-semibold capitalize tracking-tight text-[var(--ink)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.5)]">
          {label(days[active].iso)}
        </h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Fermer et revenir au calendrier" className="lm focus-ring h-11 w-11 shrink-0">
          <LiquidLayers>
            <X size={18} />
          </LiquidLayers>
        </button>
      </div>

      <div className="day-overlay-deck relative flex min-h-0 flex-1 flex-col justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
        <div
          className="deck select-none"
          style={{ height: "min(34rem, calc(100dvh - 12rem))" }}
          onPointerDown={(e) => (startX.current = e.clientX)}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (startX.current = null)}
        >
          {days.map((d, i) => {
            const offset = i - active;
            // Only the neighbourhood is mounted; one step further stays parked at "far"
            // so it has somewhere to slide in from.
            if (Math.abs(offset) > 2) return null;
            const far = Math.abs(offset) > 1;
            return (
              <article
                key={d.iso}
                className="deck-card"
                data-pos={far ? "far" : offset === 0 ? "center" : offset < 0 ? "left" : "right"}
                aria-hidden={offset !== 0}
                onClick={() => offset !== 0 && !far && onChange(i)}
              >
                {d.node}
              </article>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => canBack && onChange(active - 1)}
            disabled={!canBack}
            aria-label="Jour précédent"
            className="lm focus-ring h-11 w-11 shrink-0 disabled:opacity-40"
          >
            <LiquidLayers>
              <ChevronLeft size={18} />
            </LiquidLayers>
          </button>
          <span className="min-w-[7rem] text-center text-xs font-medium text-[var(--ink-dim)]">
            Glisse pour changer de jour
          </span>
          <button
            type="button"
            onClick={() => canForward && onChange(active + 1)}
            disabled={!canForward}
            aria-label="Jour suivant"
            className="lm focus-ring h-11 w-11 shrink-0 disabled:opacity-40"
          >
            <LiquidLayers>
              <ChevronRight size={18} />
            </LiquidLayers>
          </button>
        </div>
      </div>
    </div>
  );
}
