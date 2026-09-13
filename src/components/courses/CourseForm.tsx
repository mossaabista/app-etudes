"use client";

import { useActionState } from "react";
import { createCourseAction, updateCourseAction } from "@/server/actions/course.actions";
import { Field, Input, Select } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

const COLORS = [
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#10b981", label: "Emerald" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#f97316", label: "Orange" },
  { value: "#6366f1", label: "Indigo" },
];

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

  return (
    <form action={formAction} className="space-y-4">
      {course && <input type="hidden" name="courseId" value={course.id} />}

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Course code" htmlFor="code">
          <Input id="code" name="code" placeholder="CHM1711" defaultValue={course?.code ?? ""} required />
        </Field>
        <Field label="Course name" htmlFor="name">
          <Input id="name" name="name" placeholder="Organic Chemistry" defaultValue={course?.name ?? ""} required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Professor" htmlFor="professor">
          <Input id="professor" name="professor" placeholder="Dr. Smith" defaultValue={course?.professor ?? ""} />
        </Field>
        <Field label="Professor email" htmlFor="email">
          <Input id="email" name="email" type="email" placeholder="smith@uni.ca" defaultValue={course?.email ?? ""} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Room" htmlFor="room">
          <Input id="room" name="room" placeholder="MNT 263" defaultValue={course?.room ?? ""} />
        </Field>
        <Field label="Term" htmlFor="term">
          <Input id="term" name="term" placeholder="Fall 2026" defaultValue={course?.term ?? ""} />
        </Field>
      </div>

      <Field label="Color" htmlFor="color">
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <label key={c.value} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c.value}
                defaultChecked={course ? course.color === c.value : c.value === "#3b82f6"}
                className="peer sr-only"
              />
              <span
                className="block h-8 w-8 rounded-full border-2 border-transparent peer-checked:border-slate-900 peer-checked:ring-2 peer-checked:ring-slate-900/20"
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            </label>
          ))}
        </div>
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : course ? "Update course" : "Create course"}
        </Button>
      </div>
    </form>
  );
}
