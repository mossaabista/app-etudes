"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The opening, after the wallet reference: a squash (0.15s), the flap springs open and the
 * contents burst out (to ~0.8s), a beat to see them, then the hand-over to the area page.
 */
const OPEN_MS = 1050;

/**
 * A folder link that plays its opening before it navigates. The animation itself is CSS
 * keyed off data-opening; this only holds the navigation back until it has played.
 */
export function OpeningFolder({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);

  // Fetch the area page while the folder is still on screen, so it is ready when the
  // dive ends rather than leaving the reader on an empty frame.
  useEffect(() => {
    router.prefetch(href);
  }, [router, href]);

  // Coming back through history can restore this component mid-dive.
  useEffect(() => {
    if (!opening) return;
    const reset = setTimeout(() => setOpening(false), OPEN_MS + 1200);
    return () => clearTimeout(reset);
  }, [opening]);

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Leave new-tab and new-window clicks to the browser.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (opening) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setOpening(true);
    setTimeout(() => router.push(href), reduce ? 0 : OPEN_MS);
  }

  return (
    <a href={href} draggable={false} onClick={onClick} data-opening={opening || undefined} className={className}>
      {children}
    </a>
  );
}
