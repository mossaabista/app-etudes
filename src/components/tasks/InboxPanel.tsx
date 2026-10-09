"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { deleteTaskAction, setTaskCategoryAction } from "@/server/actions/task.actions";

export interface CategoryGroup {
  label: string;
  options: { value: string; label: string }[];
}

/** Tasks that have not been filed into a folder yet, each with a picker to file it. */
export function InboxPanel({ tasks, groups }: { tasks: { id: string; title: string }[]; groups: CategoryGroup[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <section className="glass-card p-5" aria-busy={pending}>
      <header className="mb-1 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-[var(--ink)]">À classer</h2>
        <span className="text-xs text-[var(--ink-dim)]">{tasks.length}</span>
      </header>
      <p className="mb-3 text-xs text-[var(--ink-faint)]">Choisis un dossier pour chaque tâche : elle ira se ranger dedans.</p>

      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="tile flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
            <span className="min-w-0 flex-1 basis-48 text-sm text-[var(--ink)]">{t.title}</span>
            <select
              aria-label={`Ranger « ${t.title} »`}
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                const value = e.target.value;
                if (value) startTransition(() => setTaskCategoryAction(t.id, value));
              }}
              className="glass-pill focus-ring max-w-[13rem] cursor-pointer appearance-none px-3 py-1.5 text-xs text-[var(--ink)]"
            >
              <option value="" disabled>
                Ranger dans…
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
              aria-label={`Supprimer « ${t.title} »`}
              disabled={pending}
              onClick={() => startTransition(() => deleteTaskAction(t.id))}
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
