"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      // Keep Tab inside the dialog while it is open.
      if (e.key === "Tab" && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus moves into the dialog when it opens, and back where it was when it closes.
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const target = dialog.current?.querySelector<HTMLElement>("input:not([type=radio]):not([disabled]), select, textarea, button:not([aria-label='Fermer'])") ?? dialog.current;
      target?.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      before?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(14,8,1,0.6)] p-4 pt-16 backdrop-blur-sm">
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="glass-card w-full max-w-lg outline-none">
        <div className="flex items-center justify-between border-b border-[rgba(255,220,148,0.1)] px-5 py-4">
          <h2 className="text-sm font-semibold text-[var(--ink)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--ink-faint)] hover:bg-[var(--row-hover)] hover:text-[var(--ink)] focus-ring"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
