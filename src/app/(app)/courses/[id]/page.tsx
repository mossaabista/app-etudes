import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, FileText, FlaskConical, GraduationCap, Mail, MapPin, PencilLine, Target, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { APP_TIMEZONE, toISODate } from "@/lib/dates";
import { label } from "@/lib/labels";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { DeleteCourseButton } from "@/components/courses/DeleteCourseButton";
import { ScheduleForm } from "@/components/courses/ScheduleForm";
import { ScheduleList } from "@/components/courses/ScheduleList";
import { CourseAssessments } from "@/components/courses/CourseAssessments";
import { StudyPlanner } from "@/components/courses/StudyPlanner";
import { TaskCheck } from "@/components/today/TaskCheck";

const WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fr = (t: string) => t.replace(/^0/, "").replace(":00", " h").replace(":", " h ");
const pct = (n: number) => `${(Math.round(n * 10) / 10).toString().replace(".", ",")} %`;

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
  const nowDay = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, weekday: "long" }).format(now);
  const nowTime = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const nextClass = course.schedules
    .map((s) => {
      let d = (WEEK.indexOf(s.day) - WEEK.indexOf(nowDay) + 7) % 7;
      if (d === 0 && s.startTime <= nowTime) d = 7;
      return { s, d };
    })
    .sort((a, b) => a.d - b.d || a.s.startTime.localeCompare(b.s.startTime))[0];

  const fmtDue = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(d);

  return (
    <>
      <div className="glass-backdrop" aria-hidden />
      <div className="area-enter mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-3">
          <Link href="/courses" aria-label="Retour aux cours" className="lm focus-ring h-11 w-11 shrink-0">
            <LiquidLayers>
              <ChevronLeft size={18} />
            </LiquidLayers>
          </Link>
          <p className="text-xs font-medium uppercase tracking-wide text-on-gold">Cours</p>
          <div className="ml-auto flex gap-2">
            <Link href={`/courses/${id}/edit`} className="mod-chip focus-ring">
              <PencilLine size={13} /> Modifier
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
                <p className="text-[0.68rem] uppercase tracking-wide text-[var(--ink-faint)]">Prochain cours</p>
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {nextClass.d === 0 ? "Aujourd'hui" : nextClass.d === 1 ? "Demain" : label(nextClass.s.day)} · {fr(nextClass.s.startTime)}
                </p>
                <p className="text-xs text-[var(--ink-dim)]">
                  {label(nextClass.s.type)}
                  {nextClass.s.room ? ` · ${nextClass.s.room}` : ""}
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Key figures */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<Target size={14} />} label="Moyenne actuelle" value={average != null ? pct(average) : "—"} sub={gradedWeight ? `sur ${pct(gradedWeight)} évalués` : "aucune note encore"} gold />
          <Kpi icon={<FileText size={14} />} label="Évaluations" value={`${course.assessments.filter((a) => a.status === "Completed").length} / ${course.assessments.length}`} sub="faites" />
          <Kpi icon={<Clock size={14} />} label="Prochaine" value={next ? (days! <= 1 ? (days === 0 ? "Aujourd'hui" : "Demain") : `${days} jours`) : "—"} sub={next ? `${next.title}` : "rien à venir"} />
          <Kpi
            icon={<Target size={14} />}
            label="Pour finir à 80 %"
            value={!gradedWeight || need80 == null ? "—" : need80 <= 0 ? "Acquis" : need80 > 100 ? "Hors d'atteinte" : pct(need80)}
            sub={gradedWeight && need80 != null && need80 > 0 && need80 <= 100 ? `de moyenne sur les ${pct(remaining)} restants` : gradedWeight ? "" : "entre tes notes pour le savoir"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <StudyPlanner
              targets={upcoming.slice(0, 6).map((a) => ({ id: a.id, title: a.title, type: a.type, due: toISODate(a.dueDate!), weight: a.weight, code: course.code }))}
              title={next ? `Plan de révision · ${next.title}` : "Plan de révision"}
            />

            <section className="glass-card p-5">
              <header className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--ink)]">Évaluations</h2>
                <span className="text-xs text-[var(--ink-dim)]">{pct(totalWeight)} au total</span>
              </header>
              {course.assessments.length === 0 ? (
                <Empty>
                  Aucune évaluation. <Link href="/syllabus" className="text-[#f0cd79] underline-offset-4 hover:underline">Importe le syllabus</Link> : elles se rangent toutes seules.
                </Empty>
              ) : (
                <CourseAssessments
                  items={course.assessments.map((a) => ({ id: a.id, title: a.title, type: a.type, weight: a.weight, due: a.dueDate?.toISOString() ?? null, done: a.status === "Completed", grade: a.grade }))}
                />
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="glass-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Horaire</h2>
              <ScheduleList schedules={course.schedules} courseId={id} />
              <div className="mt-4 border-t border-[rgba(255,220,148,0.1)] pt-4">
                <ScheduleForm courseId={id} />
              </div>
            </section>

            {course.labs.length > 0 && (
              <section className="glass-card p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <FlaskConical size={14} className="text-[#f0cd79]" /> Laboratoires
                </h2>
                <ul className="space-y-1.5">
                  {course.labs.map((l) => (
                    <li key={l.id} className={`flex items-center gap-2 text-sm ${l.status === "Completed" || l.status === "Submitted" ? "opacity-55" : ""}`}>
                      <span className="w-12 shrink-0 text-xs font-semibold text-[var(--ink-dim)]">Lab {l.labNumber}</span>
                      <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{l.deliverable ?? l.title}</span>
                      <span className="shrink-0 text-xs text-[var(--ink-dim)]">{l.dueDate ? fmtDue(l.dueDate).replace(/^\w+ /, "") : "—"}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/labs" className="mt-3 inline-block text-xs text-[#f0cd79] underline-offset-4 hover:underline">
                  Gérer les labos
                </Link>
              </section>
            )}

            <section className="glass-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Tâches du cours</h2>
              {course.tasks.length === 0 ? (
                <Empty>Rien pour ce cours. Dis au micro : « ajoute réviser le chapitre 2 de {course.code} demain ».</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {course.tasks.map((t) => (
                    <li key={t.id} className={`flex items-start gap-2.5 ${t.status === "Done" ? "opacity-55" : ""}`}>
                      <TaskCheck id={t.id} done={t.status === "Done"} label={t.title} />
                      <span className={`min-w-0 flex-1 text-sm text-[var(--ink)] ${t.status === "Done" ? "line-through" : ""}`}>{t.title}</span>
                      {t.dueDate && <span className="shrink-0 text-xs text-[var(--ink-dim)]">{new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, day: "numeric", month: "short" }).format(t.dueDate)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass-card p-5">
              <h2 className="mb-2 text-sm font-semibold text-[var(--ink)]">Syllabus</h2>
              {course.syllabi[0] ? (
                <p className="text-xs text-[var(--ink-dim)]">
                  {course.syllabi[0].fileName} · importé le {new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long" }).format(course.syllabi[0].createdAt)}
                </p>
              ) : (
                <p className="text-xs text-[var(--ink-dim)]">Pas encore de syllabus : avec lui, le plan de révision connaît les chapitres.</p>
              )}
              <Link href="/syllabus" className="mod-chip focus-ring mt-3">
                <Upload size={13} /> {course.syllabi[0] ? "Réimporter" : "Importer le syllabus"}
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
