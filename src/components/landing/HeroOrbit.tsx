"use client";

import { useRef } from "react";

const RING = ["heart", "dumbbells", "cap", "cart", "beads", "coins", "book", "clock", "apple", "moon"];

/**
 * The hero: the hourglass at the centre, the sections' objects orbiting it on a tilted
 * ring. The pointer leans the whole stage a few degrees; nothing re-renders, the
 * position goes straight into two CSS variables.
 */
export function HeroOrbit() {
  const stage = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = stage.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };

  return (
    <div ref={stage} className="ld-stage" onPointerMove={onMove} aria-hidden>
      <div className="ld-tilt">
        <div className="ld-halo" />
        <div className="ld-ring">
          {RING.map((name, i) => (
            <div key={name} className="ld-sat" style={{ "--a": `${(360 / RING.length) * i}deg` } as React.CSSProperties}>
              <div className="ld-sat-face">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/widgets/${name}.webp`} alt="" draggable={false} />
              </div>
            </div>
          ))}
        </div>
        <div className="ld-core">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/widgets/hourglass.webp" alt="" draggable={false} />
        </div>
      </div>
    </div>
  );
}
