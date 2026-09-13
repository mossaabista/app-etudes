import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeleteCourseButton } from "@/components/courses/DeleteCourseButton";
import { ScheduleForm } from "@/components/courses/ScheduleForm";
import { ScheduleList } from "@/components/courses/ScheduleList";

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const course = await prisma.course.findFirst({
    where: { id, userId: user.id },
    include: {
      schedules: { orderBy: [{ day: "asc" }, { startTime: "asc" }] },
      assessments: { orderBy: { dueDate: "asc" }, take: 5 },
      tasks: { where: { parentId: null }, orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!course) notFound();

  return (
    <>
      <PageHeader
        title={course.code}
        description={course.name}
        action={
          <div className="flex gap-2">
            <ButtonLink href={`/courses/${id}/edit`} variant="secondary" size="sm">Edit</ButtonLink>
            <DeleteCourseButton courseId={id} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Course Info */}
        <Card>
          <CardHeader title="Course Info" />
          <CardBody className="space-y-3">
            <InfoRow label="Code" value={course.code} />
            <InfoRow label="Name" value={course.name} />
            <InfoRow label="Professor" value={course.professor} />
            <InfoRow label="Email" value={course.email} />
            <InfoRow label="Room" value={course.room} />
            <InfoRow label="Term" value={course.term} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Color</span>
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: course.color }} />
            </div>
          </CardBody>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader title="Schedule" />
          <CardBody>
            <ScheduleList schedules={course.schedules} courseId={id} />
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ScheduleForm courseId={id} />
            </div>
          </CardBody>
        </Card>

        {/* Assessments */}
        <Card>
          <CardHeader
            title="Assessments"
            action={<ButtonLink href={`/assessments?course=${id}`} variant="ghost" size="sm">View all</ButtonLink>}
          />
          <CardBody>
            {course.assessments.length === 0 ? (
              <p className="text-sm text-slate-400">No assessments yet.</p>
            ) : (
              <ul className="space-y-2">
                {course.assessments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{a.title}</span>
                    <Badge tone="neutral">{a.type}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Tasks */}
        <Card>
          <CardHeader
            title="Tasks"
            action={<ButtonLink href={`/tasks?course=${id}`} variant="ghost" size="sm">View all</ButtonLink>}
          />
          <CardBody>
            {course.tasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {course.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{t.title}</span>
                    <Badge tone={t.status === "Done" ? "green" : "neutral"}>{t.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-slate-500 w-16 shrink-0">{label}</span>
      <span className="text-sm text-slate-900">{value}</span>
    </div>
  );
}
