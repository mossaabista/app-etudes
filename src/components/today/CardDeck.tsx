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

export function CardDeck({
  cards,
  initial = 1,
  active: controlled,
  onActiveChange,
}: {
  cards: DeckCard[];
  initial?: number;
  /** Pass to drive the deck from outside (the keyboard on a task area, for one). */
  active?: number;
  onActiveChange?: (index: number) => void;
}) {
  const [own, setOwn] = useState(initial);
  const active = controlled ?? own;
  const setActive = (index: number) => {
    if (controlled === undefined) setOwn(index);
    onActiveChange?.(index);
  };
  const startX = useRef<number | null>(null);
  // A swipe ends with a click on whatever is under the finger. When the card is a link,
  // that click would open it, so it is swallowed once a swipe has fired.
  const swiped = useRef(false);
  const n = cards.length;

  // The deck wraps, so there is always a card either side. Clamping instead would leave
  // the ends showing two cards and a gap.
  const go = (step: number) => setActive((active + step + n) % n);

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
    swiped.current = Math.abs(dx) >= SWIPE_PX;
    if (swiped.current) go(dx < 0 ? 1 : -1);
  }

  return (
    // The side cards swing out past the page edge on narrow screens; clip sideways only,
    // so the cards keep their room above and below.
    <div className="select-none overflow-x-clip">
      <div
        className="deck"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (startX.current = null)}
        onClickCapture={(e) => {
          if (!swiped.current) return;
          swiped.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
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
              className={`focus-ring h-1.5 rounded-full transition-all ${
                i === active ? "w-7 bg-[#f0cd79]" : "w-1.5 bg-[rgba(255,220,148,0.35)] hover:bg-[rgba(255,220,148,0.6)]"
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

      <p className="mt-2 text-center text-xs font-medium text-[var(--ink-dim)]">{cards[active]?.label}</p>
    </div>
  );
}
