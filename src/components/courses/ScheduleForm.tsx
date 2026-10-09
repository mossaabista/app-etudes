"use client";

import { label } from "@/lib/labels";
import { useActionState } from "react";
import { addScheduleAction } from "@/server/actions/course.actions";
import { Field, Input, Select } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TYPES = ["Lecture", "Tutorial", "Lab"];

export function ScheduleForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(addScheduleAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <p className="text-xs font-medium text-slate-700">Ajouter un créneau</p>

      {state?.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="type">
          <Select id="type" name="type" required>
            {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </Select>
        </Field>
        <Field label="Jour" htmlFor="day">
          <Select id="day" name="day" required>
            {DAYS.map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Début" htmlFor="startTime">
          <Input id="startTime" name="startTime" type="time" required />
        </Field>
        <Field label="Fin" htmlFor="endTime">
          <Input id="endTime" name="endTime" type="time" required />
        </Field>
        <Field label="Local" htmlFor="scheduleRoom">
          <Input id="scheduleRoom" name="room" placeholder="MNT 263" />
        </Field>
      </div>

      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter"}
      </Button>
    </form>
  );
}
