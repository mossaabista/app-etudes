"use client";

import { useActionState } from "react";
import { createAssessmentAction, updateAssessmentAction } from "@/server/actions/assessment.actions";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

const TYPES = ["Assignment", "Quiz", "Midterm", "Final", "Lab", "Project", "Presentation", "Report"];
const STATUSES = ["Upcoming", "Completed", "Overdue"];

type Course = { id: string; code: string; name: string };
type Assessment = {
  id: string; courseId: string; title: string; type: string;
  weight: number | null; dueDate: Date | null; status: string;
  grade: number | null; notes: string | null;
};

export function AssessmentForm({ courses, assessment }: { courses: Course[]; assessment?: Assessment }) {
  const action = assessment ? updateAssessmentAction : createAssessmentAction;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {assessment && <input type="hidden" name="assessmentId" value={assessment.id} />}

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Course" htmlFor="courseId">
          <Select id="courseId" name="courseId" required defaultValue={assessment?.courseId ?? ""}>
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </Select>
        </Field>
        <Field label="Type" htmlFor="type">
          <Select id="type" name="type" required defaultValue={assessment?.type ?? "Assignment"}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" placeholder="Midterm Exam" defaultValue={assessment?.title ?? ""} required />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Weight (%)" htmlFor="weight">
          <Input id="weight" name="weight" type="number" step="0.1" min="0" max="100" placeholder="20" defaultValue={assessment?.weight ?? ""} />
        </Field>
        <Field label="Due date" htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={assessment?.dueDate ? new Date(assessment.dueDate).toISOString().split("T")[0] : ""} />
        </Field>
        {assessment && (
          <Field label="Grade (%)" htmlFor="grade">
            <Input id="grade" name="grade" type="number" step="0.1" min="0" max="100" placeholder="85" defaultValue={assessment?.grade ?? ""} />
          </Field>
        )}
      </div>

      {assessment && (
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={assessment.status}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      )}

      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} placeholder="Optional notes..." defaultValue={assessment?.notes ?? ""} />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : assessment ? "Update" : "Create assessment"}
        </Button>
      </div>
    </form>
  );
}
