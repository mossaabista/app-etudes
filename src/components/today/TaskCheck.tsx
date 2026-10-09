"use client";

import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";
import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleTaskStatusAction } from "@/server/actions/task.actions";

/** Tick a to-do straight from Today. The tick shows at once; the server catches up. */
export function TaskCheck({ id, done, label }: { id: string; done: boolean; label: string }) {
  const { t } = useI18n();
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
      aria-label={fmt(checked ? t.today.reopenTask : t.today.completeTask, { title: label })}
      className="check focus-ring mt-0.5"
      data-checked={checked || undefined}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  );
}
