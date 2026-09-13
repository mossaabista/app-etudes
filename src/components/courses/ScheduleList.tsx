"use client";

import { deleteScheduleAction } from "@/server/actions/course.actions";

type Schedule = {
  id: string;
  type: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string | null;
};

export function ScheduleList({ schedules, courseId }: { schedules: Schedule[]; courseId: string }) {
  if (schedules.length === 0) {
    return <p className="text-sm text-slate-400">No schedule added yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {schedules.map((s) => (
        <li key={s.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium text-slate-900">{s.type}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-600">{s.day}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            <span className="text-slate-600">{s.startTime} – {s.endTime}</span>
            {s.room && (
              <>
                <span className="mx-1.5 text-slate-300">|</span>
                <span className="text-slate-500">{s.room}</span>
              </>
            )}
          </div>
          <button
            onClick={() => deleteScheduleAction(s.id, courseId)}
            className="text-xs text-slate-400 hover:text-red-500"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
