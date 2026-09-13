import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaskRow } from "@/components/tasks/TaskRow";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const todayName = DAY_NAMES[now.getDay()];
  const todayStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
  const endOfWeek = new Date(startOfDay.getTime() + 7 * 86400000);

  const [schedules, urgentTasks, todayTasks, upcomingAssessments] = await Promise.all([
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
      where: { userId: user.id, parentId: null, status: { not: "Done" }, dueDate: { gte: startOfDay, lt: endOfDay } },
      include: { course: { select: { code: true, color: true } } },
      orderBy: [{ priority: "desc" }],
    }),
    prisma.assessment.findMany({
      where: { userId: user.id, status: { not: "Completed" }, dueDate: { gte: startOfDay, lt: endOfWeek } },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);

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
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">{s.course.code}</span>
                      <span className="ml-2 text-xs text-slate-500">{s.type}</span>
                    </div>
                    <span className="text-xs text-slate-600">{s.startTime} – {s.endTime}</span>
                    {s.room && <span className="text-xs text-slate-400">{s.room}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Due Today */}
        <Card>
          <CardHeader title="Due Today" action={<ButtonLink href="/tasks" variant="ghost" size="sm">All tasks</ButtonLink>} />
          <CardBody>
            {todayTasks.length === 0 ? (
              <EmptyState title="Nothing due today" description="Tasks with today's due date will appear here." />
            ) : (
              <div className="space-y-2">
                {todayTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Upcoming Assessments */}
        <Card>
          <CardHeader title="Upcoming This Week" action={<ButtonLink href="/assessments" variant="ghost" size="sm">All assessments</ButtonLink>} />
          <CardBody>
            {upcomingAssessments.length === 0 ? (
              <EmptyState title="No assessments this week" description="Assessments due in the next 7 days will appear here." />
            ) : (
              <div className="space-y-2">
                {upcomingAssessments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 rounded-md border border-slate-100 px-4 py-3">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: a.course.color }} />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900">{a.title}</span>
                      <div className="mt-0.5 flex gap-2 text-xs text-slate-500">
                        <span>{a.course.code}</span>
                        <span>{a.type}</span>
                      </div>
                    </div>
                    {a.dueDate && (
                      <span className="text-xs text-slate-500">{new Date(a.dueDate).toLocaleDateString("en-CA")}</span>
                    )}
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
