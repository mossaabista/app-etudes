"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createEvent } from "@/server/actions/event.actions";

/** `isoDate` is the day currently shown, so a new event lands where the user is looking. */
export function AddEvent({ isoDate }: { isoDate: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Awaiting the action inside the transition lets the panel close on success without
  // an effect watching the result.
  function submit(formData: FormData) {
    start(async () => {
      const result = await createEvent(null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      formRef.current?.reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass-pill glass-prism focus-ring relative flex h-9 w-9 items-center justify-center text-slate-600"
        aria-label="Ajouter un événement"
      >
        <Plus size={17} />
      </button>
    );
  }

  return (
    <form ref={formRef} action={submit} className="w-full space-y-3 pt-1">
      <input type="hidden" name="date" value={isoDate} />

      <div className="flex items-center gap-2">
        <input
          name="title"
          required
          autoFocus
          placeholder="Sport, prière, sortie…"
          className="glass-pill focus-ring min-w-0 flex-1 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="glass-pill focus-ring flex h-9 w-9 shrink-0 items-center justify-center text-slate-500"
          aria-label="Annuler"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          name="startTime"
          type="time"
          aria-label="Heure de début"
          className="glass-pill focus-ring px-3 py-2 text-sm text-slate-700"
        />
        <span className="text-xs text-slate-400">→</span>
        <input
          name="endTime"
          type="time"
          aria-label="Heure de fin"
          className="glass-pill focus-ring px-3 py-2 text-sm text-slate-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="glass-pill glass-pill-active glass-prism focus-ring relative ml-auto px-4 py-2 text-xs font-medium disabled:opacity-60"
        >
          {pending ? "…" : "Ajouter"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
