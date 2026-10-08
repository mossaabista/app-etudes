"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LiquidLayers } from "@/components/ui/LiquidMetal";

export interface DeckCard {
  key: string;
  label: string;
  node: React.ReactNode;
}

/** Below this, a horizontal drag counts as a swipe rather than a tap. */
const SWIPE_PX = 45;

export function CardDeck({ cards, initial = 1 }: { cards: DeckCard[]; initial?: number }) {
  const [active, setActive] = useState(initial);
  const startX = useRef<number | null>(null);
  const n = cards.length;

  // The deck wraps, so there is always a card either side. Clamping instead would leave
  // the ends showing two cards and a gap.
  const go = (step: number) => setActive((i) => (i + step + n) % n);

  /** Signed distance on the ring: for three cards this is always -1, 0 or 1. */
  function ringOffset(index: number) {
    const forward = (index - active + n) % n;
    return forward > n / 2 ? forward - n : forward;
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) >= SWIPE_PX) go(dx < 0 ? 1 : -1);
  }

  return (
    <div className="select-none">
      <div
        className="deck"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (startX.current = null)}
      >
        {cards.map((card, i) => {
          const offset = ringOffset(i);
          const far = Math.abs(offset) > 1;
          return (
            <article
              key={card.key}
              className="deck-card"
              data-pos={far ? "far" : offset === 0 ? "center" : offset < 0 ? "left" : "right"}
              aria-hidden={offset !== 0}
              // A side card is a target, not a sibling to tab through.
              onClick={() => offset !== 0 && !far && go(offset)}
            >
              {card.node}
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          onClick={() => go(-1)}
          aria-label="Carte précédente"
          className="lm focus-ring h-11 w-11 shrink-0"
        >
          <LiquidLayers>
            <ChevronLeft size={18} />
          </LiquidLayers>
        </button>

        <div className="flex items-center gap-2">
          {cards.map((c, i) => (
            <button
              key={c.key}
              onClick={() => setActive(i)}
              aria-label={c.label}
              aria-current={i === active}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-7 bg-slate-800" : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          aria-label="Carte suivante"
          className="lm focus-ring h-11 w-11 shrink-0"
        >
          <LiquidLayers>
            <ChevronRight size={18} />
          </LiquidLayers>
        </button>
      </div>

      <p className="mt-2 text-center text-xs font-medium text-slate-500">{cards[active]?.label}</p>
    </div>
  );
}
