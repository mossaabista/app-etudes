import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function CalendarPage() {
  const user = await requireUser();

  const [schedules, assessments, tasks] = await Promise.all([
    prisma.courseSchedule.findMany({
      where: { course: { userId: user.id } },
      include: { course: { select: { code: true, color: true, name: true } } },
    }),
    prisma.assessment.findMany({
      where: { userId: user.id, dueDate: { not: null } },
      include: { course: { select: { code: true, color: true } } },
    }),
    prisma.task.findMany({
      where: { userId: user.id, dueDate: { not: null }, parentId: null },
      include: { course: { select: { code: true, color: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Calendar" description="View your schedule, deadlines, and events." />
      <Card>
        <CardBody className="p-0">
          <CalendarView schedules={schedules} assessments={assessments} tasks={tasks} />
        </CardBody>
      </Card>
    </>
  );
}
