"use client";

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
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <Field label="Title" htmlFor="taskTitle">
        <Input id="taskTitle" name="title" placeholder="What needs to be done?" defaultValue={task?.title ?? ""} required />
      </Field>

      <Field label="Description" htmlFor="taskDesc">
        <Textarea id="taskDesc" name="description" rows={2} placeholder="Optional details..." defaultValue={task?.description ?? ""} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Course" htmlFor="taskCourse">
          <Select id="taskCourse" name="courseId" defaultValue={task?.courseId ?? ""}>
            <option value="">No course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="taskPriority">
          <Select id="taskPriority" name="priority" defaultValue={task?.priority ?? "Medium"}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {task && (
          <Field label="Status" htmlFor="taskStatus">
            <Select id="taskStatus" name="status" defaultValue={task.status}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Due date" htmlFor="taskDue">
          <Input id="taskDue" name="dueDate" type="date" defaultValue={task?.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""} />
        </Field>
        <Field label="Est. time (min)" htmlFor="taskEst">
          <Input id="taskEst" name="estimatedTime" type="number" min="0" placeholder="30" defaultValue={task?.estimatedTime ?? ""} />
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : task ? "Update" : "Add task"}
        </Button>
      </div>
    </form>
  );
}
