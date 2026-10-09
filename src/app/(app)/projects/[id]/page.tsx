import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { MilestoneSection } from "@/components/projects/MilestoneSection";
import { MemberSection } from "@/components/projects/MemberSection";
import { TaskRow } from "@/components/tasks/TaskRow";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import { getLayout, findArea } from "@/server/layout";
import { labelIn } from "@/lib/labels";
import { getLocale, getMessages } from "@/i18n/server";
import { fmt, INTL } from "@/i18n/config";

const STATUS_TONE: Record<string, BadgeTone> = { NotStarted: "neutral", InProgress: "blue", Completed: "green" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const project = await prisma.project.findFirst({ where: { id, userId: user.id }, select: { title: true } });
  return { title: project?.title ?? (await getMessages()).nav.projects };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [t, locale, layout] = await Promise.all([getMessages(), getLocale(), getLayout(user.id)]);
  const w = t.workspace.projects;

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
  // Project tasks are added from the project's own section, when the Projects sector is shown.
  const tasksHref = findArea(layout, "projets") ? `/tasks/projets?s=${id}` : null;
  // A project's due date is a calendar day stored at midnight UTC: read it there.
  const due = project.dueDate ? new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(project.dueDate) : null;

  return (
    <>
      <PageHeader
        title={project.title}
        description={project.description ?? undefined}
        action={
          <div className="flex gap-2">
            <ButtonLink href={`/projects/${id}/edit`} variant="secondary" size="sm">{t.common.edit}</ButtonLink>
            <DeleteProjectButton projectId={id} />
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Badge tone={STATUS_TONE[project.status] ?? "neutral"}>{labelIn(project.status, locale)}</Badge>
        {project.course && (
          <span className="rounded px-1.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: project.course.color }}>
            {project.course.code}
          </span>
        )}
        {due && <span className="text-xs text-on-gold">{fmt(w.dueOn, { date: due })}</span>}
        <div className="max-w-xs flex-1">
          <ProgressBar value={project.progress} />
        </div>
        <span className="text-xs text-on-gold">{project.progress}%</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={w.milestones} />
          <CardBody>
            <MilestoneSection milestones={project.milestones} projectId={id} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={w.team} />
          <CardBody>
            <MemberSection members={project.members} projectId={id} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={w.tasks} action={tasksHref ? <ButtonLink href={tasksHref} variant="secondary" size="sm">{w.addTasks}</ButtonLink> : undefined} />
          <CardBody>
            {project.tasks.length === 0 ? (
              <p className="text-sm text-[var(--ink-dim)]">
                {w.noTasks} {tasksHref ? "" : w.askJarvis}
              </p>
            ) : (
              <div className="space-y-2">
                {project.tasks.map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
