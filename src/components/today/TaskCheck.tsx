"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTaskStatusAction } from "@/server/actions/task.actions";

/** Tick a to-do straight from Today. The tick shows at once; the server catches up. */
export function TaskCheck({ id, done, label }: { id: string; done: boolean; label: string }) {
  const [pending, start] = useTransition();
  const [checked, setChecked] = useOptimistic(done);
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          setChecked(!checked);
          await toggleTaskStatusAction(id);
        })
      }
      disabled={pending}
      aria-pressed={checked}
      aria-label={checked ? `Rouvrir « ${label} »` : `Marquer « ${label} » comme fait`}
      className="check focus-ring mt-0.5"
      data-checked={checked || undefined}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  );
}
