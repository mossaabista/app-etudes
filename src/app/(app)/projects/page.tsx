import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusBadge } from "@/components/ui/Badge";
import Link from "next/link";

export default async function ProjectsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    include: {
      course: { select: { code: true, color: true } },
      _count: { select: { tasks: true, milestones: true, members: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Projects"
        description="Manage your group projects and individual work."
        action={<ButtonLink href="/projects/new" size="sm">+ New Project</ButtonLink>}
      />
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to track deliverables, milestones, and team members."
          action={<ButtonLink href="/projects/new" size="sm">+ New Project</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group block rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-slate-700">{p.title}</h3>
                  {p.course && (
                    <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: p.course.color }}>
                      {p.course.code}
                    </span>
                  )}
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.description && <p className="mt-2 text-xs text-slate-500 line-clamp-2">{p.description}</p>}
              <div className="mt-3">
                <ProgressBar value={p.progress} />
              </div>
              <div className="mt-2 flex gap-3 text-xs text-slate-400">
                <span>{p._count.milestones} milestones</span>
                <span>{p._count.tasks} tasks</span>
                <span>{p._count.members} members</span>
              </div>
              {p.dueDate && <p className="mt-1 text-xs text-slate-400">Due {new Date(p.dueDate).toLocaleDateString("en-CA")}</p>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
