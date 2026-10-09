import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { CalendarView, type CalDay, type CalItem } from "@/components/calendar/CalendarView";
import { areaOfTag } from "@/lib/task-areas";
import { categoriesFor, categoryOfSection, type CalCategory } from "@/lib/calendar-categories";
import { getProfile } from "@/server/profile";
import { PROFILES, type ProfileType } from "@/lib/profile";
import { PILOT_NOTE } from "@/server/pilot";
import { label as frLabel } from "@/lib/labels";
import { APP_TIMEZONE, addDays, addMonths, dayName, fromISODate, startOfMonth, toISODate } from "@/lib/dates";

// Sunday first, as in the printed échéancier.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];


const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

function assessmentCategory(type: string): CalCategory {
  switch (type) {
    case "Exam":
    case "Midterm":
    case "Final":
      return "examen";
    case "Quiz":
      return "quiz";
    case "Lab":
      return "lab";
    case "Project":
    case "Presentation":
    case "Report":
      return "projet";
    default:
      return "devoir";
  }
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; profil?: string }> }) {
  const user = await requireUser();
  const { m, profil } = await searchParams;
  const profile = await getProfile(user.id);
  // Development only: ?profil=entrepreneur previews another profile's legend, nothing saved.
  const preview = process.env.NODE_ENV !== "production" && PROFILES.some((p) => p.type === profil) ? (profil as ProfileType) : null;
  const { legend, fold } = categoriesFor(preview ?? profile?.type ?? "etudiant");

  const first = (m ? fromISODate(`${m}-01`) : null) ?? startOfMonth(new Date());
  const next = addMonths(first, 1);
  const last = addDays(next, -1);

  // Pad to whole weeks so the grid is a clean rectangle.
  const gridStart = addDays(first, -WEEKDAYS.indexOf(dayName(first)));
  const gridEnd = addDays(last, 7 - WEEKDAYS.indexOf(dayName(last)));
  const window = { gte: gridStart, lt: gridEnd };

  const [courses, assessments, labs, tasks, personal, schedules] = await Promise.all([
    prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.assessment.findMany({
      where: { userId: user.id, dueDate: window },
      include: { course: { select: { id: true, code: true } } },
    }),
    prisma.labSession.findMany({
      where: { userId: user.id, dueDate: window },
      include: { course: { select: { id: true, code: true } } },
    }),
    prisma.task.findMany({
      where: { userId: user.id, parentId: null, status: { not: "Done" }, dueDate: window },
      include: { course: { select: { id: true, code: true } } },
    }),
    prisma.calendarEvent.findMany({ where: { userId: user.id, date: window } }),
    prisma.courseSchedule.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { id: true, code: true } } },
    }),
  ]);


  // The printed calendar tags each block "GNG", "CHM" or "4144": the subject letters when
  // only one course has them, otherwise the number. A full code leaves no room for the title.
  const letters = (code: string) => code.replace(/\s/g, "").match(/^[A-Za-z]+/)?.[0] ?? code;
  const short = new Map(
    courses.map((c) => {
      const l = letters(c.code);
      const unique = courses.filter((o) => letters(o.code) === l).length === 1;
      return [c.code, unique ? l : c.code.replace(/\s/g, "").slice(l.length) || c.code];
    })
  );
  // The same thing captured as a task and an event shows once, as the event.
  const eventKeys = new Set(personal.map((e) => `${e.title.toLowerCase()}|${toISODate(e.date)}`));
  const sectionCategory = (tag: string | null | undefined): CalCategory | null => {
    const t = areaOfTag(tag);
    return t ? categoryOfSection(t.area.key, t.sub?.key) : null;
  };

  const items: CalItem[] = [
    ...assessments.map((a) => ({
      id: `a${a.id}`,
      date: toISODate(a.dueDate!),
      time: hhmm(a.dueDate!),
      title: a.title,
      code: a.course.code,
      short: short.get(a.course.code),
      category: fold(assessmentCategory(a.type)),
      detail: [frLabel(a.type), a.weight != null ? `${String(a.weight).replace(".", ",")} %` : null].filter(Boolean).join(" · "),
      done: a.status === "Completed",
    })),
    ...labs.map((l) => ({
      id: `l${l.id}`,
      date: toISODate(l.dueDate!),
      time: hhmm(l.dueDate!),
      title: l.title,
      code: l.course.code,
      short: short.get(l.course.code),
      category: fold("lab"),
      detail: "Laboratoire",
      done: l.status === "Completed" || l.status === "Submitted",
    })),
    ...tasks
      .filter((t) => !eventKeys.has(`${t.title.toLowerCase()}|${toISODate(t.dueDate!)}`))
      .map((t) => {
        const tag = areaOfTag(t.category);
        const time = hhmm(t.dueDate!);
        return {
          id: `t${t.id}`,
          date: toISODate(t.dueDate!),
          time: time === "23:59" ? null : time,
          title: t.title,
          code: t.course?.code ?? tag?.area.front,
          short: t.course ? short.get(t.course.code) : undefined,
          category: fold(t.course ? "devoir" : (sectionCategory(t.category) ?? "tache")),
          detail: tag?.sub?.label ?? "Tâche",
        };
      }),
    ...personal.map((e) => {
      const tag = areaOfTag(e.type);
      const pilot = e.notes === PILOT_NOTE;
      return {
        id: `e${e.id}`,
        date: toISODate(e.date),
        time: e.startTime,
        end: e.endTime ?? undefined,
        title: e.title,
        code: pilot ? undefined : tag?.area.front,
        category: fold(pilot ? "pilote" : (sectionCategory(e.type) ?? (e.type === "Meeting" ? "reunion" : "perso"))),
        detail: pilot ? "Planifié par le Pilote" : [tag?.sub?.label, e.notes].filter(Boolean).join(" · ") || undefined,
      };
    }),
  ];

  const days: CalDay[] = [];
  const todayIso = toISODate(new Date());
  const monthPrefix = toISODate(first).slice(0, 7);
  for (let d = gridStart; d < gridEnd; d = addDays(d, 1)) {
    const iso = toISODate(d);
    days.push({ iso, day: Number(iso.slice(8)), inMonth: iso.startsWith(monthPrefix), isToday: iso === todayIso });

    // The timetable is a weekly pattern, so it is laid onto each matching day here.
    for (const s of schedules) {
      if (s.day !== dayName(d)) continue;
      items.push({
        id: `s${s.id}-${iso}`,
        date: iso,
        time: s.startTime,
        end: s.endTime,
        title: frLabel(s.type),
        code: s.course.code,
        short: short.get(s.course.code),
        category: fold("cours"),
        detail: s.room ?? undefined,
        recurring: true,
      });
    }
  }

  const monthLabel = new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, month: "long", year: "numeric" }).format(first);
  const href = (d: Date) => `/calendar?m=${toISODate(d).slice(0, 7)}`;
  const isCurrentMonth = todayIso.startsWith(monthPrefix);

  return (
    <>
      <div className="glass-backdrop" aria-hidden />

      <div className="mb-6 flex items-center gap-2.5">
        <Link href={href(addMonths(first, -1))} aria-label="Mois précédent" className="lm focus-ring h-11 w-11 shrink-0">
          <LiquidLayers>
            <ChevronLeft size={18} />
          </LiquidLayers>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-[var(--ink)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.5)]">
            {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
          </h1>
          {!isCurrentMonth && (
            <Link href="/calendar" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)]">
              Revenir à ce mois-ci
            </Link>
          )}
        </div>
        <Link href={href(next)} aria-label="Mois suivant" className="lm focus-ring h-11 w-11 shrink-0">
          <LiquidLayers>
            <ChevronRight size={18} />
          </LiquidLayers>
        </Link>
      </div>

      <CalendarView key={monthPrefix} days={days} items={items} legend={legend} />
    </>
  );
}
