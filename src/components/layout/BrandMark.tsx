import { useId } from "react";

/**
 * The OROM mark: a gold ring around a small gold core, on a dark disc — an "O" that reads
 * as an eye that listens. Each instance
 * gets its own gradient id: the sidebar's copy is display:none on phones, and a gradient
 * defined inside a hidden SVG paints nothing for the visible ones that point at it.
 */
export function BrandMark({ size = 26 }: { size?: number }) {
  const gold = `brand-gold-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0bd" />
          <stop offset="0.45" stopColor="#e8bf63" />
          <stop offset="1" stopColor="#9a6b1c" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="#140d04" stroke={`url(#${gold})`} strokeWidth="1.4" />
      <circle cx="16" cy="16" r="7.4" fill="none" stroke={`url(#${gold})`} strokeWidth="2.6" />
      <circle cx="16" cy="16" r="2.3" fill={`url(#${gold})`} />
    </svg>
  );
}
