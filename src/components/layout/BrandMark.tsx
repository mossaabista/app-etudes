import { useId } from "react";

/**
 * The Aurum mark: a gold "A" cut as a chevron over a bar, on a dark disc. Each instance
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
      <path d="M9.5 23 L16 8.5 L22.5 23" fill="none" stroke={`url(#${gold})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.2 18.2 H19.8" stroke={`url(#${gold})`} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
