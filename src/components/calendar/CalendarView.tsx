"use client";

import { useState } from "react";

type Schedule = {
  id: string; type: string; day: string; startTime: string; endTime: string; room: string | null;
  course: { code: string; color: string; name: string };
};
type Assessment = {
  id: string; title: string; type: string; dueDate: Date | null;
  course: { code: string; color: string };
};
type Task = {
  id: string; title: string; status: string; dueDate: Date | null;
  course: { code: string; color: string } | null;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8am to 9pm

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function CalendarView({ schedules, assessments, tasks }: { schedules: Schedule[]; assessments: Assessment[]; tasks: Task[] }) {
  const [view, setView] = useState<"week" | "list">("week");

  if (view === "list") {
    return (
      <div className="p-5">
        <div className="mb-4 flex gap-2">
          <button onClick={() => setView("week")} className="text-xs text-slate-500 hover:text-slate-700">Week view</button>
          <span className="text-xs text-slate-300">|</span>
          <button className="text-xs font-medium text-slate-900">List view</button>
        </div>
        <div className="space-y-4">
          {DAYS.map((day) => {
            const daySchedules = schedules.filter((s) => s.day === day);
            if (daySchedules.length === 0) return null;
            return (
              <div key={day}>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-400">{day}</h4>
                <div className="space-y-1">
                  {daySchedules.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 rounded px-3 py-2 text-sm" style={{ backgroundColor: s.course.color + "15" }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.course.color }} />
                      <span className="font-medium">{s.course.code}</span>
                      <span className="text-slate-500">{s.type}</span>
                      <span className="ml-auto text-xs text-slate-500">{s.startTime} – {s.endTime}</span>
                      {s.room && <span className="text-xs text-slate-400">{s.room}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex gap-2">
        <button className="text-xs font-medium text-slate-900">Week view</button>
        <span className="text-xs text-slate-300">|</span>
        <button onClick={() => setView("list")} className="text-xs text-slate-500 hover:text-slate-700">List view</button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[700px]" style={{ gridTemplateColumns: "60px repeat(5, 1fr)" }}>
          {/* Header */}
          <div className="border-b border-slate-100 p-2" />
          {DAYS.map((day) => (
            <div key={day} className="border-b border-l border-slate-100 p-2 text-center text-xs font-semibold text-slate-600">
              {day}
            </div>
          ))}

          {/* Time slots */}
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-slate-50 p-1 pr-2 text-right text-[10px] text-slate-400">
                {hour}:00
              </div>
              {DAYS.map((day) => {
                const slotSchedules = schedules.filter(
                  (s) => s.day === day && timeToMinutes(s.startTime) < (hour + 1) * 60 && timeToMinutes(s.endTime) > hour * 60
                );
                return (
                  <div key={day} className="relative border-b border-l border-slate-50 p-0.5" style={{ minHeight: 40 }}>
                    {slotSchedules.map((s) => {
                      const isStart = timeToMinutes(s.startTime) >= hour * 60;
                      if (!isStart) return null;
                      const duration = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
                      const heightSlots = duration / 60;
                      return (
                        <div
                          key={s.id}
                          className="absolute inset-x-0.5 z-10 overflow-hidden rounded px-1.5 py-1 text-white"
                          style={{
                            backgroundColor: s.course.color,
                            top: 2,
                            height: `calc(${heightSlots * 100}% - 4px)`,
                          }}
                        >
                          <p className="text-[10px] font-semibold leading-tight">{s.course.code}</p>
                          <p className="text-[9px] opacity-80">{s.type} {s.room ? `· ${s.room}` : ""}</p>
                          <p className="text-[9px] opacity-70">{s.startTime}–{s.endTime}</p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming deadlines */}
      {assessments.length > 0 && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase text-slate-400">Upcoming Deadlines</h4>
          <div className="space-y-1">
            {assessments.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.course.color }} />
                <span className="text-slate-700">{a.title}</span>
                <span className="text-xs text-slate-400">{a.course.code}</span>
                {a.dueDate && <span className="ml-auto text-xs text-slate-500">{new Date(a.dueDate).toLocaleDateString("en-CA")}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
