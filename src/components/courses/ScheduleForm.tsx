"use client";

import { labelIn } from "@/lib/labels";
import { useActionState } from "react";
import { addScheduleAction } from "@/server/actions/course.actions";
import { Field, Input, Select } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/client";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TYPES = ["Lecture", "Tutorial", "Lab"];

export function ScheduleForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(addScheduleAction, null);
  const { t, locale } = useI18n();
  const a = t.academics;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <p className="text-xs font-medium text-[var(--ink-dim)]">{a.addSlot}</p>

      {state?.error && (
        <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={a.type} htmlFor="type">
          <Select id="type" name="type" required>
            {TYPES.map((x) => <option key={x} value={x}>{labelIn(x, locale)}</option>)}
          </Select>
        </Field>
        <Field label={a.day} htmlFor="day">
          <Select id="day" name="day" required>
            {DAYS.map((d) => <option key={d} value={d}>{labelIn(d, locale)}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={a.start} htmlFor="startTime">
          <Input id="startTime" name="startTime" type="time" required />
        </Field>
        <Field label={a.end} htmlFor="endTime">
          <Input id="endTime" name="endTime" type="time" required />
        </Field>
        <Field label={a.room} htmlFor="scheduleRoom">
          <Input id="scheduleRoom" name="room" placeholder="MNT 263" />
        </Field>
      </div>

      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? a.adding : a.add}
      </Button>
    </form>
  );
}
