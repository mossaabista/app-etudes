"use client";

import { useActionState } from "react";
import { createCourseAction, updateCourseAction } from "@/server/actions/course.actions";
import { Field, Input } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/client";

const COLORS = [
  { value: "#3b82f6", label: "blue" },
  { value: "#8b5cf6", label: "purple" },
  { value: "#ec4899", label: "pink" },
  { value: "#f59e0b", label: "amber" },
  { value: "#10b981", label: "emerald" },
  { value: "#06b6d4", label: "cyan" },
  { value: "#f97316", label: "orange" },
  { value: "#6366f1", label: "indigo" },
] as const;

type Course = {
  id: string;
  code: string;
  name: string;
  professor: string | null;
  email: string | null;
  room: string | null;
  color: string;
  term: string | null;
};

export function CourseForm({ course }: { course?: Course }) {
  const action = course ? updateCourseAction : createCourseAction;
  const [state, formAction, pending] = useActionState(action, null);
  const { t } = useI18n();
  const a = t.academics;

  return (
    <form action={formAction} className="space-y-4">
      {course && <input type="hidden" name="courseId" value={course.id} />}

      {state?.error && (
        <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-sm text-[#ffd9cf]">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label={a.code} htmlFor="code">
          <Input id="code" name="code" placeholder="CHM1711" defaultValue={course?.code ?? ""} required />
        </Field>
        <Field label={a.name} htmlFor="name">
          <Input id="name" name="name" placeholder={a.namePh} defaultValue={course?.name ?? ""} required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={a.professor} htmlFor="professor">
          <Input id="professor" name="professor" placeholder="Dr Tremblay" defaultValue={course?.professor ?? ""} />
        </Field>
        <Field label={a.professorEmail} htmlFor="email">
          <Input id="email" name="email" type="email" placeholder="prof@uottawa.ca" defaultValue={course?.email ?? ""} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={a.room} htmlFor="room">
          <Input id="room" name="room" placeholder="MNT 263" defaultValue={course?.room ?? ""} />
        </Field>
        <Field label={a.term} htmlFor="term">
          <Input id="term" name="term" placeholder={a.termPh} defaultValue={course?.term ?? ""} />
        </Field>
      </div>

      <Field label={a.color} htmlFor="color">
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <label key={c.value} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c.value}
                defaultChecked={course ? course.color === c.value : c.value === "#3b82f6"}
                aria-label={a.colors[c.label]}
                className="peer sr-only"
              />
              <span
                className="block h-8 w-8 rounded-full border-2 border-transparent peer-checked:border-[#f0cd79] peer-checked:ring-2 peer-checked:ring-[rgba(240,205,121,0.35)] peer-focus-visible:ring-2 peer-focus-visible:ring-[#f0cd79]"
                style={{ backgroundColor: c.value }}
                title={a.colors[c.label]}
              />
            </label>
          ))}
        </div>
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? a.saving : course ? t.common.save : a.createCourse}
        </Button>
      </div>
    </form>
  );
}
