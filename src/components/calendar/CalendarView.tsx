"use client";

import { useState, useMemo } from "react";

type Schedule = {
  id: string; type: string; day: string; startTime: string; endTime: string; room: string | null;
  course: { code: string; color: string; name: string };
};
type Assessment = {
  id: string; title: string; type: string; dueDate: Date | string | null;
  course: { code: string; color: string };
};
type Task = {
  id: string; title: string; status: string; dueDate: Date | string | null;
  course: { code: string; color: string } | null;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getWeekDates(offset: number): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const TYPE_ICONS: Record<string, string> = {
  Assignment: "📝", Quiz: "❓", Exam: "📋", Midterm: "📋", Final: "📋", Project: "🔧", Lab: "🔬",
};

export function CalendarView({ schedules, assessments, tasks }: { schedules: Schedule[]; assessments: Assessment[]; tasks: Task[] }) {
  const [view, setView] = useState<"week" | "list">("week");
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0];
  const weekEnd = new Date(weekDates[6]);
  weekEnd.setHours(23, 59, 59, 999);

  const weekLabel = `${weekDates[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" })}`;

  const assessmentsByDay = useMemo(() => {
    const map = new Map<number, Assessment[]>();
    for (const a of assessments) {
      if (!a.dueDate) continue;
      const d = new Date(a.dueDate);
      for (let i = 0; i < 7; i++) {
        if (isSameDay(d, weekDates[i])) {
          const arr = map.get(i) || [];
          arr.push(a);
          map.set(i, arr);
          break;
        }
      }
    }
    return map;
  }, [assessments, weekDates]);

  const tasksByDay = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate || t.status === "Done") continue;
      const d = new Date(t.dueDate);
      for (let i = 0; i < 7; i++) {
        if (isSameDay(d, weekDates[i])) {
          const arr = map.get(i) || [];
          arr.push(t);
          map.set(i, arr);
          break;
        }
      }
    }
    return map;
  }, [tasks, weekDates]);

  const today = new Date();

  if (view === "list") {
    return (
      <div className="p-5">
        <ViewToggle view={view} setView={setView} />
        <WeekNav weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
        <div className="space-y-4">
          {DAYS.map((day, i) => {
            const daySchedules = schedules.filter((s) => s.day === day);
            const dayAssessments = assessmentsByDay.get(i) || [];
            const dayTasks = tasksByDay.get(i) || [];
            if (daySchedules.length === 0 && dayAssessments.length === 0 && dayTasks.length === 0) return null;
            const isToday = isSameDay(weekDates[i], today);
            return (
              <div key={day}>
                <h4 className={`mb-2 text-xs font-semibold uppercase ${isToday ? "text-blue-600" : "text-slate-400"}`}>
                  {day} {weekDates[i].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })}
                  {isToday && <span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white normal-case">Aujourd&apos;hui</span>}
                </h4>
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
                  {dayAssessments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded border border-dashed px-3 py-2 text-sm" style={{ borderColor: a.course.color + "60", backgroundColor: a.course.color + "08" }}>
                      <span className="text-xs">{TYPE_ICONS[a.type] || "📌"}</span>
                      <span className="font-medium text-slate-800">{a.title}</span>
                      <span className="text-xs text-slate-400">{a.course.code}</span>
                      <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: a.course.color + "20", color: a.course.color }}>{a.type}</span>
                    </div>
                  ))}
                  {dayTasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-xs">✅</span>
                      <span className="text-slate-700">{t.title}</span>
                      {t.course && <span className="text-xs text-slate-400">{t.course.code}</span>}
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
      <ViewToggle view={view} setView={setView} />
      <WeekNav weekLabel={weekLabel} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />

      {/* Deadline banners for the week */}
      <DeadlineBanners weekDates={weekDates} assessmentsByDay={assessmentsByDay} tasksByDay={tasksByDay} today={today} />

      <div className="overflow-x-auto">
        <div className="grid min-w-[700px]" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
          {/* Header */}
          <div className="border-b border-slate-100 p-2" />
          {DAYS.map((day, i) => {
            const isToday = isSameDay(weekDates[i], today);
            const dateNum = weekDates[i].getDate();
            const deadlineCount = (assessmentsByDay.get(i)?.length || 0) + (tasksByDay.get(i)?.length || 0);
            return (
              <div key={day} className={`border-b border-l border-slate-100 p-2 text-center ${isToday ? "bg-blue-50" : ""}`}>
                <div className={`text-xs font-semibold ${isToday ? "text-blue-600" : "text-slate-600"}`}>{day.slice(0, 3)}</div>
                <div className={`text-lg font-bold ${isToday ? "text-blue-600" : "text-slate-800"}`}>{dateNum}</div>
                {deadlineCount > 0 && (
                  <div className="mt-0.5 text-[10px] font-medium text-orange-600">{deadlineCount} deadline{deadlineCount > 1 ? "s" : ""}</div>
                )}
              </div>
            );
          })}

          {/* Time slots */}
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="border-b border-slate-50 p-1 pr-2 text-right text-[10px] text-slate-400">
                {hour}:00
              </div>
              {DAYS.map((day, i) => {
                const isToday = isSameDay(weekDates[i], today);
                const slotSchedules = schedules.filter(
                  (s) => s.day === day && timeToMinutes(s.startTime) < (hour + 1) * 60 && timeToMinutes(s.endTime) > hour * 60
                );
                return (
                  <div key={day} className={`relative border-b border-l border-slate-50 p-0.5 ${isToday ? "bg-blue-50/30" : ""}`} style={{ minHeight: 40 }}>
                    {slotSchedules.map((s) => {
                      const isStart = timeToMinutes(s.startTime) >= hour * 60;
                      if (!isStart) return null;
                      const duration = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
                      const heightSlots = duration / 60;
                      return (
                        <div
                          key={s.id}
                          className="absolute inset-x-0.5 z-10 overflow-hidden rounded px-1.5 py-1 text-white"
                          style={{ backgroundColor: s.course.color, top: 2, height: `calc(${heightSlots * 100}% - 4px)` }}
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
    </div>
  );
}

function ViewToggle({ view, setView }: { view: string; setView: (v: "week" | "list") => void }) {
  return (
    <div className="mb-4 flex gap-2">
      <button onClick={() => setView("week")} className={`text-xs ${view === "week" ? "font-medium text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>Week view</button>
      <span className="text-xs text-slate-300">|</span>
      <button onClick={() => setView("list")} className={`text-xs ${view === "list" ? "font-medium text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>List view</button>
    </div>
  );
}

function WeekNav({ weekLabel, weekOffset, setWeekOffset }: { weekLabel: string; weekOffset: number; setWeekOffset: (n: number) => void }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <button onClick={() => setWeekOffset(weekOffset - 1)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">&larr;</button>
      <button onClick={() => setWeekOffset(0)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Today</button>
      <button onClick={() => setWeekOffset(weekOffset + 1)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">&rarr;</button>
      <span className="text-sm font-medium text-slate-700">{weekLabel}</span>
    </div>
  );
}

function DeadlineBanners({ weekDates, assessmentsByDay, tasksByDay, today }: {
  weekDates: Date[]; assessmentsByDay: Map<number, Assessment[]>; tasksByDay: Map<number, Task[]>; today: Date;
}) {
  const allDeadlines: { date: Date; dayIdx: number; items: (Assessment | Task)[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const items = [...(assessmentsByDay.get(i) || []), ...(tasksByDay.get(i) || [])];
    if (items.length > 0) allDeadlines.push({ date: weekDates[i], dayIdx: i, items });
  }
  if (allDeadlines.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {allDeadlines.map(({ date, items }) => {
        const isPast = date < today && !isSameDay(date, today);
        const isToday = isSameDay(date, today);
        return (
          <div key={date.toISOString()} className={`rounded-lg border p-3 ${isToday ? "border-orange-300 bg-orange-50" : isPast ? "border-slate-200 bg-slate-50 opacity-60" : "border-blue-200 bg-blue-50"}`}>
            <div className="mb-1 flex items-center gap-2">
              <span className={`text-xs font-semibold ${isToday ? "text-orange-700" : isPast ? "text-slate-500" : "text-blue-700"}`}>
                {date.toLocaleDateString("fr-CA", { weekday: "short", month: "short", day: "numeric" })}
                {isToday && " — Aujourd'hui"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const isAssessment = "type" in item && "course" in item && item.course;
                const color = isAssessment ? (item as Assessment).course.color : (item as Task).course?.color || "#6b7280";
                const code = isAssessment ? (item as Assessment).course.code : (item as Task).course?.code || "";
                return (
                  <span key={item.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: color }}>
                    {isAssessment && <span>{TYPE_ICONS[(item as Assessment).type] || "📌"}</span>}
                    {code && <span className="opacity-80">{code}</span>}
                    {item.title}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
