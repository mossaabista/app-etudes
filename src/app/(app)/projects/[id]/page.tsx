import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/Badge";
import { MilestoneSection } from "@/components/projects/MilestoneSection";
import { MemberSection } from "@/components/projects/MemberSection";
import { TaskRow } from "@/components/tasks/TaskRow";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id, userId: user.id },
    include: {
      course: { select: { code: true, color: true } },
      milestones: { orderBy: { sortOrder: "asc" } },
      members: true,
      tasks: {
        where: { parentId: null },
        include: { course: { select: { code: true, color: true } } },
        orderBy: [{ status: "asc" }, { priority: "desc" }],
      },
    },
  });

  if (!project) notFound();

  return (
    <>
      <PageHeader
        title={project.title}
        description={project.description ?? undefined}
        action={
          <div className="flex gap-2">
            <ButtonLink href={`/projects/${id}/edit`} variant="secondary" size="sm">Edit</ButtonLink>
            <DeleteProjectButton projectId={id} />
          </div>
        }
      />

      <div className="mb-6 flex items-center gap-4">
        <StatusBadge status={project.status} />
        {project.course && (
          <span className="rounded px-1.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: project.course.color }}>
            {project.course.code}
          </span>
        )}
        {project.dueDate && <span className="text-xs text-slate-500">Due {new Date(project.dueDate).toLocaleDateString("en-CA")}</span>}
        <div className="flex-1 max-w-xs">
          <ProgressBar value={project.progress} />
        </div>
        <span className="text-xs text-slate-500">{project.progress}%</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Milestones" />
          <CardBody>
            <MilestoneSection milestones={project.milestones} projectId={id} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Team Members" />
          <CardBody>
            <MemberSection members={project.members} projectId={id} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Tasks" />
          <CardBody>
            {project.tasks.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks linked to this project yet.</p>
            ) : (
              <div className="space-y-2">
                {project.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
