import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import Link from "next/link";
import { labelIn } from "@/lib/labels";
import { getLocale, getMessages } from "@/i18n/server";
import { fmt, INTL } from "@/i18n/config";
import { plural } from "@/i18n/ns/workspace";

const STATUS_TONE: Record<string, BadgeTone> = { NotStarted: "neutral", InProgress: "blue", Completed: "green" };

export async function generateMetadata() {
  return { title: (await getMessages()).nav.projects };
}

export default async function ProjectsPage() {
  const user = await requireUser();
  const [t, locale] = await Promise.all([getMessages(), getLocale()]);
  const w = t.workspace.projects;
  // A project's due date is a calendar day stored at midnight UTC: read it there.
  const day = (d: Date) => new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(d);

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
        title={t.nav.projects}
        description={w.intro}
        action={<ButtonLink href="/projects/new" size="sm">{w.newButton}</ButtonLink>}
      />
      {projects.length === 0 ? (
        <EmptyState
          title={w.emptyTitle}
          description={w.emptyDesc}
          action={<ButtonLink href="/projects/new" size="sm">{w.newButton}</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="glass-card focus-ring group block p-4 transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--ink)]">{p.title}</h3>
                  {p.course && (
                    <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: p.course.color }}>
                      {p.course.code}
                    </span>
                  )}
                </div>
                <Badge tone={STATUS_TONE[p.status] ?? "neutral"}>{labelIn(p.status, locale)}</Badge>
              </div>
              {p.description && <p className="mt-2 line-clamp-2 text-xs text-[var(--ink-dim)]">{p.description}</p>}
              <div className="mt-3">
                <ProgressBar value={p.progress} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--ink-faint)]">
                <span>{plural(locale, p._count.milestones, w.milestoneOne, w.milestoneMany)}</span>
                <span>{plural(locale, p._count.tasks, w.taskOne, w.taskMany)}</span>
                <span>{plural(locale, p._count.members, w.memberOne, w.memberMany)}</span>
              </div>
              {p.dueDate && <p className="mt-1 text-xs text-[var(--ink-faint)]">{fmt(w.dueOn, { date: day(p.dueDate) })}</p>}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
