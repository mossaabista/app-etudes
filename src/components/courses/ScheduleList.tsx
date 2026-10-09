"use client";

import { labelIn } from "@/lib/labels";
import { deleteScheduleAction } from "@/server/actions/course.actions";
import { useI18n } from "@/i18n/client";

type Schedule = {
  id: string;
  type: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string | null;
};

export function ScheduleList({ schedules, courseId }: { schedules: Schedule[]; courseId: string }) {
  const { t, locale } = useI18n();
  const a = t.academics;

  if (schedules.length === 0) {
    return <p className="text-sm text-[var(--ink-faint)]">{a.noSlots}</p>;
  }

  return (
    <ul className="space-y-2">
      {schedules.map((s) => (
        <li key={s.id} className="tile flex items-center justify-between gap-2 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium text-[var(--ink)]">{labelIn(s.type, locale)}</span>
            <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
            <span className="text-[var(--ink-dim)]">{labelIn(s.day, locale)}</span>
            <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
            <span className="text-[var(--ink-dim)]">{s.startTime} – {s.endTime}</span>
            {s.room && (
              <>
                <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
                <span className="text-[var(--ink-dim)]">{s.room}</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => deleteScheduleAction(s.id, courseId)}
            className="focus-ring shrink-0 text-xs text-[var(--ink-faint)] hover:text-[#ffb3a3]"
          >
            {a.remove}
          </button>
        </li>
      ))}
    </ul>
  );
}
