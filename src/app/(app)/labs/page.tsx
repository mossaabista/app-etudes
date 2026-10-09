import { labelIn } from "@/lib/labels";
import { prisma } from "@/lib/db";
import { currentZone } from "@/lib/dates";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { LabActions } from "@/components/labs/LabActions";
import { getLocale, getMessages } from "@/i18n/server";
import { INTL, fmt } from "@/i18n/config";

const TONE: Record<string, BadgeTone> = { Upcoming: "blue", Completed: "green", Submitted: "green", Overdue: "red" };

export async function generateMetadata() {
  return { title: (await getMessages()).academics.labsTitle };
}

export default async function LabsPage() {
  const user = await requireUser();
  const k = (await getMessages()).academics;
  const locale = await getLocale();
  const shortDate = new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "short" });
  const fullDate = new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "short", year: "numeric" });
  const pct = (n: number) => `${new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 2 }).format(n)}${locale === "fr" ? " %" : "%"}`;

  const coursesWithLabs = await prisma.course.findMany({
    where: {
      userId: user.id,
      schedules: { some: { type: "Lab" } },
    },
    include: {
      schedules: { where: { type: "Lab" } },
      labs: { orderBy: { labNumber: "asc" } },
    },
  });

  const allLabs = await prisma.labSession.findMany({
    where: { userId: user.id },
    include: { course: { select: { code: true, color: true, name: true } } },
    orderBy: [{ date: "asc" }, { labNumber: "asc" }],
  });

  const now = new Date();
  const upcoming = allLabs.filter((l) => l.status !== "Completed" && l.status !== "Submitted" && l.dueDate && new Date(l.dueDate) >= now);
  const overdue = allLabs.filter((l) => l.status !== "Completed" && l.status !== "Submitted" && l.dueDate && new Date(l.dueDate) < now);

  return (
    <>
      <PageHeader title={k.labsTitle} description={k.labsDesc} />

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div className="mb-6 rounded-xl bg-[rgba(220,60,40,0.18)] p-4 text-[#ffd9cf]">
          <h3 className="mb-2 text-sm font-semibold">{fmt(k.overdueN, { n: overdue.length })}</h3>
          <div className="space-y-1">
            {overdue.map((lab) => (
              <div key={lab.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lab.course.color }} />
                <span className="font-medium">{lab.course.code} — {fmt(k.labN, { n: lab.labNumber })}</span>
                <span className="opacity-80">{lab.deliverable}</span>
                {lab.dueDate && <span className="ml-auto text-xs">{fullDate.format(new Date(lab.dueDate))}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming summary */}
      {upcoming.length > 0 && (
        <div className="glass-card mb-6 p-4">
          <h3 className="mb-2 text-sm font-semibold text-[#f0cd79]">{fmt(k.upcomingDeliverables, { n: upcoming.length })}</h3>
          <div className="space-y-1">
            {upcoming.slice(0, 5).map((lab) => (
              <div key={lab.id} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lab.course.color }} />
                <span className="font-medium text-[var(--ink)]">{lab.course.code} — {fmt(k.labN, { n: lab.labNumber })}</span>
                <span className="text-[var(--ink-dim)]">{lab.deliverable}</span>
                {lab.dueDate && <span className="ml-auto text-xs text-[var(--ink-dim)]">{fullDate.format(new Date(lab.dueDate))}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-course lab sections */}
      {coursesWithLabs.length === 0 ? (
        <EmptyState
          title={k.noLabCoursesTitle}
          description={k.noLabCoursesDesc}
          action={
            <ButtonLink href="/courses" size="sm" className="mt-2">
              {k.seeCourses}
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-6">
          {coursesWithLabs.map((course) => (
            <Card key={course.id}>
              <CardHeader
                title={
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: course.color }} />
                    <span>{course.code} — {course.name}</span>
                  </div>
                }
              />
              <CardBody>
                {/* Lab schedule info */}
                {course.schedules.map((s) => (
                  <div key={s.id} className="tile mb-4 flex items-center gap-2 px-3 py-2 text-xs text-[var(--ink-dim)]">
                    <span className="font-medium text-[var(--ink)]">{k.scheduleLabel}</span>
                    <span>{labelIn(s.day, locale)} {s.startTime}–{s.endTime}</span>
                    {s.room && <span className="text-[var(--ink-faint)]">({s.room})</span>}
                  </div>
                ))}

                {/* Lab sessions table */}
                {course.labs.length === 0 ? (
                  <p className="text-sm text-[var(--ink-faint)]">{k.noLabSessions}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[rgba(255,220,148,0.12)] text-left text-xs font-medium text-[var(--ink-faint)]">
                          <th className="pb-2 pr-4">#</th>
                          <th className="pb-2 pr-4">{k.colDate}</th>
                          <th className="pb-2 pr-4">{k.colTopic}</th>
                          <th className="pb-2 pr-4">{k.colDeliverable}</th>
                          <th className="pb-2 pr-4">{k.colDue}</th>
                          <th className="pb-2 pr-4">{k.colStatus}</th>
                          <th className="pb-2 pr-4">{k.colGrade}</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {course.labs.map((lab) => {
                          const isOverdue = lab.dueDate && new Date(lab.dueDate) < now && lab.status !== "Completed" && lab.status !== "Submitted";
                          return (
                            <tr key={lab.id} className={`border-b border-[rgba(255,220,148,0.06)] ${isOverdue ? "bg-[rgba(220,60,40,0.1)]" : ""}`}>
                              <td className="py-2.5 pr-4 font-medium text-[var(--ink)]">{fmt(k.labN, { n: lab.labNumber })}</td>
                              <td className="py-2.5 pr-4 text-[var(--ink-dim)]">{lab.date ? shortDate.format(new Date(lab.date)) : "—"}</td>
                              <td className="py-2.5 pr-4 text-[var(--ink)]">{lab.topic || "—"}</td>
                              <td className="py-2.5 pr-4 text-[var(--ink-dim)]">{lab.deliverable || "—"}</td>
                              <td className={`py-2.5 pr-4 text-xs ${isOverdue ? "font-medium text-[#ffb3a3]" : "text-[var(--ink-dim)]"}`}>
                                {lab.dueDate ? fullDate.format(new Date(lab.dueDate)) : "—"}
                              </td>
                              <td className="py-2.5 pr-4">
                                <Badge tone={TONE[lab.status] ?? "neutral"}>{labelIn(lab.status, locale)}</Badge>
                              </td>
                              <td className="py-2.5 pr-4 text-[var(--ink-dim)]">{lab.grade != null ? pct(lab.grade) : "—"}</td>
                              <td className="py-2.5">
                                <LabActions labId={lab.id} currentStatus={lab.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
