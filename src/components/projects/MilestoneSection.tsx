"use client";

import { useActionState } from "react";
import { Check, X } from "lucide-react";
import { addMilestoneAction, toggleMilestoneAction, deleteMilestoneAction } from "@/server/actions/project.actions";
import { Field, Input } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/client";
import { fmt, INTL } from "@/i18n/config";

type Milestone = { id: string; title: string; dueDate: Date | null; status: string };

export function MilestoneSection({ milestones, projectId }: { milestones: Milestone[]; projectId: string }) {
  const [state, formAction, pending] = useActionState(addMilestoneAction, null);
  const { t, locale } = useI18n();
  const w = t.workspace.projects;
  // A milestone's date is a calendar day stored at midnight UTC: read it there.
  const day = (d: Date) => new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

  return (
    <div>
      {milestones.length > 0 && (
        <ul className="mb-4 space-y-2">
          {milestones.map((m) => {
            const done = m.status === "Completed";
            return (
              <li key={m.id} className={`tile flex items-center gap-3 px-3 py-2 ${done ? "opacity-55" : ""}`}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={fmt(done ? w.reopenMilestone : w.toggleMilestone, { title: m.title })}
                  onClick={() => toggleMilestoneAction(m.id, projectId)}
                  className="check focus-ring"
                  data-checked={done || undefined}
                >
                  {done && <Check size={12} strokeWidth={3} />}
                </button>
                <span className={`flex-1 text-sm text-[var(--ink)] ${done ? "line-through" : ""}`}>{m.title}</span>
                {m.dueDate && <span className="text-xs text-[var(--ink-dim)]">{day(m.dueDate)}</span>}
                <button
                  type="button"
                  onClick={() => deleteMilestoneAction(m.id, projectId)}
                  aria-label={fmt(w.deleteNamed, { title: m.title })}
                  className="focus-ring rounded-full p-1 text-[var(--ink-faint)] hover:text-[#ffb3a3]"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form action={formAction} className="flex items-end gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex-1">
          <Field label={w.newMilestone} htmlFor="msTitle">
            <Input id="msTitle" name="title" placeholder={w.milestonePlaceholder} required />
          </Field>
        </div>
        <div className="w-36">
          <Field label={t.workspace.task.due} htmlFor="msDue">
            <Input id="msDue" name="dueDate" type="date" />
          </Field>
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>{w.add}</Button>
      </form>
      {state?.error && <p role="alert" className="mt-2 rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">{state.error}</p>}
    </div>
  );
}
