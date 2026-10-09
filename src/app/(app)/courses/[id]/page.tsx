import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, FileText, FlaskConical, GraduationCap, Mail, MapPin, PencilLine, Target, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { currentZone, toISODate } from "@/lib/dates";
import { labelIn } from "@/lib/labels";
import { getLocale, getMessages } from "@/i18n/server";
import { INTL, fmt, type Locale } from "@/i18n/config";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { DeleteCourseButton } from "@/components/courses/DeleteCourseButton";
import { ScheduleForm } from "@/components/courses/ScheduleForm";
import { ScheduleList } from "@/components/courses/ScheduleList";
import { CourseAssessments } from "@/components/courses/CourseAssessments";
import { StudyPlanner } from "@/components/courses/StudyPlanner";
import { TaskCheck } from "@/components/today/TaskCheck";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** "09:30" → "9 h 30" in French, "9:30" in English. */
const clock = (t: string, locale: Locale) => (locale === "fr" ? t.replace(/^0/, "").replace(":00", " h").replace(":", " h ") : t.replace(/^0/, ""));
const pct = (n: number, locale: Locale) => `${new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 1 }).format(Math.round(n * 10) / 10)}${locale === "fr" ? " %" : "%"}`;

export async function generateMetadata() {
  return { title: (await getMessages()).academics.courseMeta };
}

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const course = await prisma.course.findFirst({
    where: { id, userId: user.id },
    include: {
      schedules: { orderBy: [{ day: "asc" }, { startTime: "asc" }] },
      assessments: { orderBy: { dueDate: "asc" } },
      tasks: { where: { parentId: null }, orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 20 },
      labs: { orderBy: { labNumber: "asc" } },
      syllabi: { orderBy: { createdAt: "desc" }, take: 1, select: { fileName: true, createdAt: true } },
    },
  });
  if (!course) notFound();
  const t = await getMessages();
  const a = t.academics;
  const locale = await getLocale();
  const p = (n: number) => pct(n, locale);

  const now = new Date();
  // Grades: the weighted average of what is graded, and what the rest must average to
  // finish at 80 %.
  const graded = course.assessments.filter((a) => a.grade != null && a.weight != null);
  const gradedWeight = graded.reduce((s, a) => s + a.weight!, 0);
  const earned = graded.reduce((s, a) => s + (a.grade! * a.weight!) / 100, 0);
  const totalWeight = course.assessments.reduce((s, a) => s + (a.weight ?? 0), 0) || 100;
  const remaining = Math.max(0, totalWeight - gradedWeight);
  const average = gradedWeight > 0 ? (earned / gradedWeight) * 100 : null;
  const needFor = (target: number) => (remaining > 0 ? ((target / 100) * totalWeight - earned) / remaining * 100 : null);
  const need80 = needFor(80);

  const upcoming = course.assessments.filter((a) => a.dueDate && a.dueDate > now && a.status !== "Completed");
  const next = upcoming[0];
  // Calendar days, not 24-hour periods: due tomorrow at 23:59 is "Demain".
  const days = next ? Math.round((new Date(`${toISODate(next.dueDate!)}T12:00:00Z`).getTime() - new Date(`${toISODate(now)}T12:00:00Z`).getTime()) / 86400000) : null;

  // The next class: this week's pattern laid on the calendar from now.
  const nowDay = new Intl.DateTimeFormat("en-US", { timeZone: currentZone(), weekday: "long" }).format(now);
  const nowTime = new Intl.DateTimeFormat("en-GB", { timeZone: currentZone(), hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const nextClass = course.schedules
    .map((s) => {
      let d = (WEEK.indexOf(s.day) - WEEK.indexOf(nowDay) + 7) % 7;
      if (d === 0 && s.startTime <= nowTime) d = 7;
      return { s, d };
    })
    .sort((a, b) => a.d - b.d || a.s.startTime.localeCompare(b.s.startTime))[0];

  const fmtDay = (d: Date) => new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "long" }).format(d);

  return (
    <>
      <div className="glass-backdrop" aria-hidden />
      <div className="area-enter mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/courses" aria-label={a.backToCourses} className="lm focus-ring h-11 w-11 shrink-0">
            <LiquidLayers>
              <ChevronLeft size={18} />
            </LiquidLayers>
          </Link>
          <p className="text-xs font-medium uppercase tracking-wide text-on-gold">{a.courseEyebrow}</p>
          <div className="ml-auto flex gap-2">
            <Link href={`/courses/${id}/edit`} className="mod-chip focus-ring">
              <PencilLine size={13} /> {t.common.edit}
            </Link>
            <DeleteCourseButton courseId={id} />
          </div>
        </div>

        {/* Hero */}
        <header className="course-hero glass-card mb-4 overflow-hidden p-6" style={{ "--c": course.color } as React.CSSProperties}>
          <div className="relative flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f0cd79]">{course.code}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">{course.name}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-dim)]">
                {course.professor && (
                  <span className="course-meta">
                    <GraduationCap size={13} /> {course.professor}
                  </span>
                )}
                {course.email && (
                  <a href={`mailto:${course.email}`} className="course-meta hover:text-[var(--ink)]">
                    <Mail size={13} /> {course.email}
                  </a>
                )}
                {course.room && (
                  <span className="course-meta">
                    <MapPin size={13} /> {course.room}
                  </span>
                )}
                {course.term && <span className="course-meta">{course.term}</span>}
              </div>
            </div>
            {nextClass && (
              <div className="text-right">
                <p className="text-[0.68rem] uppercase tracking-wide text-[var(--ink-faint)]">{a.nextClass}</p>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {nextClass.d === 0 ? a.today : nextClass.d === 1 ? a.tomorrow : labelIn(nextClass.s.day, locale)} · {clock(nextClass.s.startTime, locale)}
                </p>
                <p className="text-xs text-[var(--ink-dim)]">
                  {labelIn(nextClass.s.type, locale)}
                  {nextClass.s.room ? ` · ${nextClass.s.room}` : ""}
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Key figures */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Target size={14} />} label={a.kpiAverage} value={average != null ? p(average) : "—"} sub={gradedWeight ? fmt(a.kpiAverageSub, { pct: p(gradedWeight) }) : a.noGradeYet} gold />
          <Kpi icon={<FileText size={14} />} label={a.kpiAssessments} value={`${course.assessments.filter((x) => x.status === "Completed").length} / ${course.assessments.length}`} sub={a.kpiDone} />
          <Kpi icon={<Clock size={14} />} label={a.kpiNext} value={next ? (days! <= 1 ? (days === 0 ? a.today : a.tomorrow) : fmt(a.inDays, { n: days! })) : "—"} sub={next ? `${next.title}` : a.nothingAhead} />
          <Kpi
            icon={<Target size={14} />}
            label={a.kpiTarget}
            value={!gradedWeight || need80 == null ? "—" : need80 <= 0 ? a.secured : need80 > 100 ? a.outOfReach : p(need80)}
            sub={gradedWeight && need80 != null && need80 > 0 && need80 <= 100 ? fmt(a.targetSub, { pct: p(remaining) }) : gradedWeight ? "" : a.targetHint}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <StudyPlanner
              targets={upcoming.slice(0, 6).map((u) => ({ id: u.id, title: u.title, type: u.type, due: toISODate(u.dueDate!), weight: u.weight, code: course.code }))}
              title={next ? fmt(a.studyPlanFor, { title: next.title }) : a.studyPlan}
            />

            <section className="glass-card p-5">
              <header className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--ink)]">{a.assessmentsTitle}</h2>
                <span className="text-xs text-[var(--ink-dim)]">{fmt(a.totalWeight, { pct: p(totalWeight) })}</span>
              </header>
              {course.assessments.length === 0 ? (
                <Empty>
                  {a.noAssessments}{" "}
                  <Link href="/syllabus" className="text-[#f0cd79] underline-offset-4 hover:underline">
                    {a.importTheSyllabus}
                  </Link>
                  {a.noAssessmentsAfter}
                </Empty>
              ) : (
                <CourseAssessments
                  items={course.assessments.map((x) => ({ id: x.id, title: x.title, type: x.type, weight: x.weight, due: x.dueDate?.toISOString() ?? null, done: x.status === "Completed", grade: x.grade }))}
                />
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="glass-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">{a.schedule}</h2>
              <ScheduleList schedules={course.schedules} courseId={id} />
              <div className="mt-4 border-t border-[rgba(255,220,148,0.1)] pt-4">
                <ScheduleForm courseId={id} />
              </div>
            </section>

            {course.labs.length > 0 && (
              <section className="glass-card p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <FlaskConical size={14} className="text-[#f0cd79]" /> {a.labsTitle}
                </h2>
                <ul className="space-y-1.5">
                  {course.labs.map((l) => (
                    <li key={l.id} className={`flex items-center gap-2 text-sm ${l.status === "Completed" || l.status === "Submitted" ? "opacity-55" : ""}`}>
                      <span className="w-12 shrink-0 text-xs font-semibold text-[var(--ink-dim)]">{fmt(a.labN, { n: l.labNumber })}</span>
                      <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{l.deliverable ?? l.title}</span>
                      <span className="shrink-0 text-xs text-[var(--ink-dim)]">{l.dueDate ? fmtDay(l.dueDate) : "—"}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/labs" className="mt-3 inline-block text-xs text-[#f0cd79] underline-offset-4 hover:underline">
                  {a.manageLabs}
                </Link>
              </section>
            )}

            <section className="glass-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">{a.courseTasks}</h2>
              {course.tasks.length === 0 ? (
                <Empty>{fmt(a.noTasks, { code: course.code })}</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {course.tasks.map((task) => (
                    <li key={task.id} className={`flex items-start gap-2.5 ${task.status === "Done" ? "opacity-55" : ""}`}>
                      <TaskCheck id={task.id} done={task.status === "Done"} label={task.title} />
                      <span className={`min-w-0 flex-1 text-sm text-[var(--ink)] ${task.status === "Done" ? "line-through" : ""}`}>{task.title}</span>
                      {task.dueDate && <span className="shrink-0 text-xs text-[var(--ink-dim)]">{new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "short" }).format(task.dueDate)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass-card p-5">
              <h2 className="mb-2 text-sm font-semibold text-[var(--ink)]">{a.syllabus}</h2>
              {course.syllabi[0] ? (
                <p className="text-xs text-[var(--ink-dim)]">
                  {fmt(a.syllabusImported, { file: course.syllabi[0].fileName, date: fmtDay(course.syllabi[0].createdAt) })}
                </p>
              ) : (
                <p className="text-xs text-[var(--ink-dim)]">{a.noSyllabus}</p>
              )}
              <Link href="/syllabus" className="mod-chip focus-ring mt-3">
                <Upload size={13} /> {course.syllabi[0] ? a.reimport : a.importSyllabus}
              </Link>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, sub, gold }: { icon: React.ReactNode; label: string; value: string; sub?: string; gold?: boolean }) {
  return (
    <div className="glass-card p-4">
      <p className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
        <span className="text-[#f0cd79]">{icon}</span>
        {label}
      </p>
      <p className={`mt-1.5 truncate text-xl font-semibold ${gold ? "text-[#f0cd79]" : "text-[var(--ink)]"}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-[var(--ink-dim)]">{sub}</p>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-xs leading-5 text-[var(--ink-faint)]">{children}</p>;
}
