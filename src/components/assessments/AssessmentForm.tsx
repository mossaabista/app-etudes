"use client";

import Link from "next/link";
import { labelIn } from "@/lib/labels";
import { useI18n } from "@/i18n/client";
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
  const { t, locale } = useI18n();
  const a = t.academics;

  return (
    <form action={formAction} className="space-y-4">
      {assessment && <input type="hidden" name="assessmentId" value={assessment.id} />}

      {state?.error && (
        <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-sm text-[#ffd9cf]">{state.error}</p>
      )}

      {courses.length === 0 && (
        <p className="text-sm text-[var(--ink-dim)]">
          {a.noCoursesHint}{" "}
          <Link href="/courses/new" className="text-[#f0cd79] underline-offset-4 hover:underline">
            {a.addCourseFirst}
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label={a.course} htmlFor="courseId">
          <Select id="courseId" name="courseId" required defaultValue={assessment?.courseId ?? ""}>
            <option value="">{a.chooseCourse}</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </Select>
        </Field>
        <Field label={a.type} htmlFor="type">
          <Select id="type" name="type" required defaultValue={assessment?.type ?? "Assignment"}>
            {TYPES.map((x) => <option key={x} value={x}>{labelIn(x, locale)}</option>)}
          </Select>
        </Field>
      </div>

      <Field label={a.title} htmlFor="title">
        <Input id="title" name="title" placeholder={a.titlePh} defaultValue={assessment?.title ?? ""} required />
      </Field>

      <div className="grid grid-cols-3 gap-4">
        <Field label={a.weightPct} htmlFor="weight">
          <Input id="weight" name="weight" type="number" step="0.1" min="0" max="100" placeholder="20" defaultValue={assessment?.weight ?? ""} />
        </Field>
        <Field label={a.dueDate} htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={assessment?.dueDate ? new Date(assessment.dueDate).toISOString().split("T")[0] : ""} />
        </Field>
        {assessment && (
          <Field label={a.gradePct} htmlFor="grade">
            <Input id="grade" name="grade" type="number" step="0.1" min="0" max="100" placeholder="85" defaultValue={assessment?.grade ?? ""} />
          </Field>
        )}
      </div>

      {assessment && (
        <Field label={a.status} htmlFor="status">
          <Select id="status" name="status" defaultValue={assessment.status}>
            {STATUSES.map((s) => <option key={s} value={s}>{labelIn(s, locale)}</option>)}
          </Select>
        </Field>
      )}

      <Field label={a.notes} htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} placeholder={a.notesPh} defaultValue={assessment?.notes ?? ""} />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? a.saving : assessment ? t.common.save : a.createAssessment}
        </Button>
      </div>
    </form>
  );
}
