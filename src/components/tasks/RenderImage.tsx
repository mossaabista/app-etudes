"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A widget render, or a quiet gold placeholder while that render is still being made,
 * never a broken-image icon. The server-rendered img can fail before React attaches
 * onError, so it is checked on mount as well.
 */
export function RenderImage({ src, className, onMissing }: { src: string; className?: string; onMissing?: () => void }) {
  const [missing, setMissing] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) {
      setMissing(true);
      onMissing?.();
    }
  }, [onMissing]);
  if (missing) return <span className="wc-pending" aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a pre-cut local render
    <img
      ref={img}
      src={src}
      alt=""
      draggable={false}
      className={className}
      onError={() => {
        setMissing(true);
        onMissing?.();
      }}
    />
  );
}
