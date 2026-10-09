"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { deleteTaskAction, setTaskCategoryAction } from "@/server/actions/task.actions";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

export interface CategoryGroup {
  label: string;
  options: { value: string; label: string }[];
}

/** Tasks that have not been filed into a folder yet, each with a picker to file it. */
export function InboxPanel({ tasks, groups }: { tasks: { id: string; title: string }[]; groups: CategoryGroup[] }) {
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();
  const w = t.workspace.sectors;

  return (
    <section className="glass-card p-5" aria-busy={pending}>
      <header className="mb-1 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-[var(--ink)]">{w.inboxTitle}</h2>
        <span className="text-xs text-[var(--ink-dim)]">{tasks.length}</span>
      </header>
      <p className="mb-3 text-xs text-[var(--ink-faint)]">{w.inboxIntro}</p>

      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="tile flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
            <span className="min-w-0 flex-1 basis-48 text-sm text-[var(--ink)]">{task.title}</span>
            <select
              aria-label={fmt(w.fileNamed, { title: task.title })}
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                const value = e.target.value;
                if (value) startTransition(() => setTaskCategoryAction(task.id, value));
              }}
              className="glass-pill focus-ring max-w-[13rem] cursor-pointer appearance-none px-3 py-1.5 text-xs text-[var(--ink)]"
            >
              <option value="" disabled>
                {w.fileIn}
              </option>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              aria-label={fmt(t.workspace.area.deleteNamed, { title: task.title })}
              disabled={pending}
              onClick={() => startTransition(() => deleteTaskAction(task.id))}
              className="focus-ring rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
