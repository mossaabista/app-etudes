"use client";

import { useEffect } from "react";

// Kept across client-side navigations: an item seen once on any page never lands twice.
const seen = new Set<string>();
// Only what appears just after an action lands; a new page or a new month just appears.
let armedUntil = 0;

/** Call right before a change (an assistant command, an accepted plan) to animate what it adds. */
export function expectLanding(ms = 6000) {
  armedUntil = Date.now() + ms;
}

/**
 * Anything new that appears on screen — a block the assistant just put in the calendar, a
 * task added from Today — drops into place with a short gold glow, so a spoken command is
 * seen to happen. Items opt in with data-land="<stable id>"; the first scan only takes note
 * of what is already there.
 */
export function LandWatcher() {
  useEffect(() => {
    const scan = () => {
      const animate = Date.now() < armedUntil;
      document.querySelectorAll<HTMLElement>("[data-land]").forEach((el) => {
        const id = el.dataset.land!;
        if (seen.has(id)) return;
        seen.add(id);
        if (!animate) return;
        el.classList.remove("land-in");
        void el.offsetWidth;
        el.classList.add("land-in");
        el.addEventListener("animationend", () => el.classList.remove("land-in"), { once: true });
      });
    };
    scan();
    let frame = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
