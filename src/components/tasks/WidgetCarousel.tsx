"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { RenderImage } from "@/components/tasks/RenderImage";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

export interface CarouselItem {
  key: string;
  label: string;
  src: string;
  /** Open tasks in the section. */
  count: number;
  /** The section's own page, opened by tapping the item in front. */
  href: string;
}

/**
 * A row of section objects that scrolls natively (finger, trackpad, wheel) and snaps each
 * one to the centre. Items are restyled from their live distance to the centre on every
 * scroll frame, so the one in front grows and the others recede smoothly rather than
 * jumping between states.
 */
export function WidgetCarousel({
  items,
  active,
  onActiveChange,
}: {
  items: CarouselItem[];
  active: number;
  onActiveChange: (index: number) => void;
}) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  // The index the scroll position itself settled on. When `active` changes to something
  // else (an arrow, a dot, a tap on a side item) the track has to be scrolled there.
  const fromScroll = useRef(active);
  const frame = useRef(0);
  // While the code itself is sliding the row to an item, the items it passes are not
  // selections: only restyle them, and settle once the slide ends.
  const steering = useRef(false);
  const steerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function paint() {
    const el0 = track.current;
    if (!el0) return;
    const mid = el0.scrollLeft + el0.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    Array.from(el0.children).forEach((node, i) => {
      const el = node as HTMLElement;
      const d = (el.offsetLeft + el.offsetWidth / 2 - mid) / el.offsetWidth;
      const k = Math.min(Math.abs(d), 1.4);
      el.style.setProperty("--s", (1 - Math.min(k, 1) * 0.3).toFixed(3));
      el.style.setProperty("--o", (1 - Math.min(k, 1) * 0.55).toFixed(3));
      el.style.setProperty("--r", `${(Math.max(-1, Math.min(1, d)) * -22).toFixed(2)}deg`);
      if (Math.abs(d) < best) {
        best = Math.abs(d);
        nearest = i;
      }
    });
    return nearest;
  }

  function onScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const nearest = paint();
      if (steering.current) return;
      if (nearest !== undefined && nearest !== fromScroll.current) {
        fromScroll.current = nearest;
        onActiveChange(nearest);
      }
    });
  }

  function centre(index: number, smooth: boolean) {
    const tr = track.current;
    const el = tr?.children[index] as HTMLElement | undefined;
    if (!tr || !el) return;
    if (smooth) {
      steering.current = true;
      clearTimeout(steerTimer.current);
      // scrollend is not everywhere yet; the timer covers the rest.
      steerTimer.current = setTimeout(() => (steering.current = false), 700);
    }
    tr.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - tr.clientWidth / 2, behavior: smooth ? "smooth" : "auto" });
  }

  // First paint: land on the requested item without an animated sweep across the row.
  useLayoutEffect(() => {
    centre(active, false);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    if (active !== fromScroll.current) {
      fromScroll.current = active;
      centre(active, true);
    }
  }, [active]);

  useEffect(() => {
    const onResize = () => {
      centre(fromScroll.current, false);
      paint();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const go = (step: number) => onActiveChange((active + step + items.length) % items.length);

  return (
    <div className="wc">
      <div
        ref={track}
        className="wc-track"
        onScroll={onScroll}
        onScrollEnd={() => {
          steering.current = false;
          clearTimeout(steerTimer.current);
        }}
        role="tablist"
        aria-label={t.workspace.area.sections}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          else if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {items.map((item, i) => (
          <WidgetItem key={item.key} item={item} index={i} active={i === active} onSelect={() => onActiveChange(i)} />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(-1)} aria-label={t.workspace.area.prevSection} className="lm focus-ring h-11 w-11 shrink-0">
          <LiquidLayers>
            <ChevronLeft size={18} />
          </LiquidLayers>
        </button>
        <div className="flex items-center gap-2">
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onActiveChange(i)}
              aria-label={item.label}
              aria-current={i === active}
              className={`focus-ring h-1.5 rounded-full transition-all ${
                i === active ? "w-7 bg-[#f0cd79]" : "w-1.5 bg-[rgba(255,220,148,0.35)] hover:bg-[rgba(255,220,148,0.6)]"
              }`}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} aria-label={t.workspace.area.nextSection} className="lm focus-ring h-11 w-11 shrink-0">
          <LiquidLayers>
            <ChevronRight size={18} />
          </LiquidLayers>
        </button>
      </div>
    </div>
  );
}

function WidgetItem({ item, index, active, onSelect }: { item: CarouselItem; index: number; active: boolean; onSelect: () => void }) {
  const router = useRouter();
  const { t } = useI18n();
  const w = t.workspace.area;
  const stage = useRef<HTMLSpanElement>(null);
  // Warm the section page while its item is in front, so the tap opens it at once.
  useEffect(() => {
    if (active) router.prefetch(item.href);
  }, [active, item.href, router]);
  // A render not made yet shows a placeholder; the glint then has nothing to sweep.
  const [missing, setMissing] = useState(false);

  // The object leans towards the pointer: parallax that reads as depth.
  function onMove(e: React.PointerEvent) {
    const el = stage.current;
    if (!el || !active || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--tx", `${(((e.clientX - r.left) / r.width - 0.5) * 24).toFixed(2)}deg`);
    el.style.setProperty("--ty", `${((0.5 - (e.clientY - r.top) / r.height) * 18).toFixed(2)}deg`);
  }
  function onLeave() {
    stage.current?.style.removeProperty("--tx");
    stage.current?.style.removeProperty("--ty");
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-active={active || undefined}
      // A side item comes to the front; the one in front opens its page.
      onClick={() => (active ? router.push(item.href) : onSelect())}
      aria-label={active ? fmt(w.openNamed, { name: item.label }) : item.label}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="wc-item focus-ring"
      style={{ "--i": index } as React.CSSProperties}
    >
      <span ref={stage} className="wc-stage">
        <span className="wc-shadow" aria-hidden />
        <span className="wc-float">
          <span className="wc-tilt">
            <RenderImage src={item.src} className="wc-img" onMissing={() => setMissing(true)} />
            {!missing && (
              // A band of warm light that sweeps across the object, clipped to its silhouette.
              <span className="wc-glint" style={{ "--mask": `url("${item.src}")` } as React.CSSProperties} aria-hidden />
            )}
          </span>
        </span>
      </span>
      <span className="wc-label">{item.label}</span>
      <span className="wc-meta">{item.count ? fmt(t.workspace.sectors.openCount, { n: item.count }) : w.upToDate}</span>
      <span className="wc-open" aria-hidden>
        {w.open} <ArrowRight size={12} />
      </span>
    </button>
  );
}
