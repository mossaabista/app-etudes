"use client";

import { labelIn } from "@/lib/labels";
import { useI18n } from "@/i18n/client";
import { useActionState } from "react";
import { createTaskAction, updateTaskAction } from "@/server/actions/task.actions";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["ToDo", "InProgress", "Done", "Deferred"];

type Course = { id: string; code: string; name: string };
type Task = {
  id: string; title: string; description: string | null; courseId: string | null;
  priority: string; status: string; dueDate: Date | null; estimatedTime: number | null; category: string | null;
};

export function TaskForm({ courses, task, onDone }: { courses: Course[]; task?: Task; onDone?: () => void }) {
  const { t, locale } = useI18n();
  const w = t.workspace.task;
  const action = task ? updateTaskAction : createTaskAction;
  const [state, formAction, pending] = useActionState(async (prev: unknown, formData: FormData) => {
    const result = await action(prev, formData);
    if (result && "success" in result && result.success && onDone) onDone();
    return result;
  }, null);

  return (
    <form action={formAction} className="space-y-4">
      {task && <input type="hidden" name="taskId" value={task.id} />}

      {state?.error && (
        <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-sm text-[#ffd9cf]">{state.error}</p>
      )}

      <Field label={w.title} htmlFor="taskTitle">
        <Input id="taskTitle" name="title" placeholder={w.titlePlaceholder} defaultValue={task?.title ?? ""} required />
      </Field>

      <Field label={w.description} htmlFor="taskDesc">
        <Textarea id="taskDesc" name="description" rows={2} placeholder={w.descriptionPlaceholder} defaultValue={task?.description ?? ""} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={w.course} htmlFor="taskCourse">
          <Select id="taskCourse" name="courseId" defaultValue={task?.courseId ?? ""}>
            <option value="">{w.noCourse}</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label={w.priority} htmlFor="taskPriority">
          <Select id="taskPriority" name="priority" defaultValue={task?.priority ?? "Medium"}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{labelIn(p, locale)}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {task && (
          <Field label={w.status} htmlFor="taskStatus">
            <Select id="taskStatus" name="status" defaultValue={task.status}>
              {STATUSES.map((s) => <option key={s} value={s}>{labelIn(s, locale)}</option>)}
            </Select>
          </Field>
        )}
        <Field label={w.due} htmlFor="taskDue">
          <Input id="taskDue" name="dueDate" type="date" defaultValue={task?.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""} />
        </Field>
        <Field label={w.estimate} htmlFor="taskEst">
          <Input id="taskEst" name="estimatedTime" type="number" min="0" placeholder="30" defaultValue={task?.estimatedTime ?? ""} />
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? w.saving : task ? t.common.save : w.add}
        </Button>
      </div>
    </form>
  );
}
