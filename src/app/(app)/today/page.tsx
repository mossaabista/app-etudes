import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/tasks/TaskRow";
import { AssessmentRow } from "@/components/assessments/AssessmentRow";
import { ButtonLink } from "@/components/ui/Button";
import { addDays, dayName, formatLongDate, startOfDay } from "@/lib/dates";

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const todayName = dayName(now);
  const todayStr = formatLongDate(now);

  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const upcomingEnd = addDays(dayStart, 15);

  const [schedules, urgentTasks, todayTasks, todayAssessments, upcomingAssessments] = await Promise.all([
    prisma.courseSchedule.findMany({
      where: { course: { userId: user.id }, day: todayName },
      include: { course: { select: { code: true, color: true, name: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: user.id, parentId: null, status: { not: "Done" }, priority: { in: ["High", "Critical"] } },
      include: { course: { select: { code: true, color: true } } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 5,
    }),
    prisma.task.findMany({
      where: { userId: user.id, parentId: null, status: { not: "Done" }, dueDate: { gte: dayStart, lt: dayEnd } },
      include: { course: { select: { code: true, color: true } } },
      orderBy: [{ priority: "desc" }],
    }),
    prisma.assessment.findMany({
      where: { userId: user.id, status: { not: "Completed" }, dueDate: { gte: dayStart, lt: dayEnd } },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.assessment.findMany({
      where: { userId: user.id, status: { not: "Completed" }, dueDate: { gte: dayEnd, lt: upcomingEnd } },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const dueTodayCount = todayTasks.length + todayAssessments.length;

  return (
    <>
      <PageHeader title="Today" description={todayStr} />

      <div className="space-y-6">
        {/* Priority */}
        <Card>
          <CardHeader title="Priority" />
          <CardBody>
            {urgentTasks.length === 0 ? (
              <EmptyState title="No urgent tasks" description="Tasks marked as High or Critical priority will appear here." />
            ) : (
              <div className="space-y-2">
                {urgentTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader title="Today's Schedule" />
          <CardBody>
            {schedules.length === 0 ? (
              <EmptyState title="No classes today" description="Add course schedules to see your daily timetable." />
            ) : (
              <div className="space-y-2">
                {schedules.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-md px-3 py-2" style={{ backgroundColor: s.course.color + "12" }}>
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.course.color }} />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900">{s.course.code}</span>
                      <span className="ml-2 text-xs text-slate-500">{s.type}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="whitespace-nowrap text-xs text-slate-600">{s.startTime} – {s.endTime}</div>
                      {s.room && <div className="text-[11px] text-slate-400">{s.room}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Due Today */}
        <Card>
          <CardHeader
            title="Due Today"
            subtitle={dueTodayCount > 0 ? `${dueTodayCount} item${dueTodayCount > 1 ? "s" : ""}` : undefined}
            action={<ButtonLink href="/tasks" variant="ghost" size="sm">All tasks</ButtonLink>}
          />
          <CardBody>
            {dueTodayCount === 0 ? (
              <EmptyState title="Nothing due today" description="Tasks and assessments due today will appear here." />
            ) : (
              <div className="space-y-2">
                {todayAssessments.map((a) => <AssessmentRow key={a.id} a={a} />)}
                {todayTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Upcoming Assessments */}
        <Card>
          <CardHeader title="Upcoming (2 weeks)" action={<ButtonLink href="/assessments" variant="ghost" size="sm">All assessments</ButtonLink>} />
          <CardBody>
            {upcomingAssessments.length === 0 ? (
              <EmptyState title="No upcoming assessments" description="Assessments due in the next 2 weeks will appear here." />
            ) : (
              <div className="space-y-2">
                {upcomingAssessments.map((a) => <AssessmentRow key={a.id} a={a} />)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
