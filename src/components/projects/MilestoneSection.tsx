"use client";

import { useActionState } from "react";
import { addMilestoneAction, toggleMilestoneAction, deleteMilestoneAction } from "@/server/actions/project.actions";
import { Field, Input } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

type Milestone = { id: string; title: string; dueDate: Date | null; status: string };

export function MilestoneSection({ milestones, projectId }: { milestones: Milestone[]; projectId: string }) {
  const [state, formAction, pending] = useActionState(addMilestoneAction, null);

  return (
    <div>
      {milestones.length > 0 && (
        <ul className="mb-4 space-y-2">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2">
              <button
                onClick={() => toggleMilestoneAction(m.id, projectId)}
                className={`h-4 w-4 shrink-0 rounded border-2 transition-colors ${
                  m.status === "Completed"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 hover:border-slate-400"
                }`}
              >
                {m.status === "Completed" && <span className="flex items-center justify-center text-[10px]">✓</span>}
              </button>
              <span className={`flex-1 text-sm ${m.status === "Completed" ? "line-through text-slate-400" : "text-slate-700"}`}>
                {m.title}
              </span>
              {m.dueDate && (
                <span className="text-xs text-slate-400">{new Date(m.dueDate).toLocaleDateString("en-CA")}</span>
              )}
              <button onClick={() => deleteMilestoneAction(m.id, projectId)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex gap-2 items-end">
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex-1">
          <Field label="New milestone" htmlFor="msTitle">
            <Input id="msTitle" name="title" placeholder="e.g. Submit draft" required />
          </Field>
        </div>
        <div className="w-36">
          <Field label="Due" htmlFor="msDue">
            <Input id="msDue" name="dueDate" type="date" />
          </Field>
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>Add</Button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
