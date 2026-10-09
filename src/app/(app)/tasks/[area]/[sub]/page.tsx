import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { toISODate } from "@/lib/dates";
import { PROJECT_VISUAL } from "@/lib/task-areas";
import { imageSrc, type SubSpec } from "@/lib/layout";
import { findArea, getLayout } from "@/server/layout";
import { ModuleShell } from "@/components/modules/ModuleShell";
import { relatedModules } from "@/components/modules/related";
import type { Entry } from "@/components/modules/kit";
import type { AreaTask } from "@/components/tasks/AreaView";

export default async function SectionPage({ params }: { params: Promise<{ area: string; sub: string }> }) {
  const { area: areaKey, sub: subKey } = await params;
  const user = await requireUser();
  const area = findArea(await getLayout(user.id), areaKey);
  if (!area) notFound();
  let spec: SubSpec | null = null;

  // A Projets section is one of the user's projects; every other one is a fixed section.
  let label: string;
  let src: string;
  let project: { id: string; title: string; description: string | null; progress: number; dueDate: Date | null; status: string } | null = null;
  if (area.key === "projets" && subKey !== "general") {
    project = await prisma.project.findFirst({
      where: { id: subKey, userId: user.id },
      select: { id: true, title: true, description: true, progress: true, dueDate: true, status: true },
    });
    if (!project) notFound();
    label = project.title;
    src = PROJECT_VISUAL.src;
  } else {
    const sub = area.subs.find((s) => s.key === subKey);
    if (!sub) notFound();
    spec = sub;
    label = sub.label;
    src = imageSrc(sub.image);
  }

  // Data lives under the library section's key wherever it is filed; a made-to-measure
  // section keeps its own. Tasks are filed under the place the section sits.
  const category = `${area.key}:${subKey}`;
  const section = spec?.lib ?? category;
  const extra = relatedModules[section] ?? [];
  const [rows, tasks] = await Promise.all([
    prisma.trackerEntry.findMany({
      where: { userId: user.id, module: { in: [section, ...extra] } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 2000,
    }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        parentId: null,
        OR: [{ category }, ...(project ? [{ projectId: project.id }] : [])],
      },
      select: { id: true, title: true, status: true, dueDate: true, category: true, projectId: true, priority: true, estimatedTime: true, subtasks: { select: { id: true, title: true, status: true }, orderBy: { createdAt: "asc" } } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const toEntry = (r: (typeof rows)[number]): Entry => ({
    id: r.id,
    kind: r.kind,
    day: toISODate(r.date),
    text: r.text,
    value: r.value,
    done: r.done,
    data: (r.data as Record<string, unknown>) ?? {},
  });
  const related: Record<string, Entry[]> = Object.fromEntries(extra.map((m) => [m, rows.filter((r) => r.module === m).map(toEntry)]));

  const taskRows: AreaTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.status === "Done",
    due: t.dueDate?.toISOString() ?? null,
    sub: t.category?.split(":")[1] ?? t.projectId ?? "general",
  }));

  return (
    <ModuleShell
      areaKey={area.key}
      areaLabel={area.label}
      subKey={subKey}
      section={section}
      custom={spec?.custom ?? null}
      label={label}
      src={src}
      today={toISODate(new Date())}
      entries={rows.filter((r) => r.module === section).map(toEntry)}
      related={related}
      tasks={taskRows}
      category={category}
      richTasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        done: t.status === "Done",
        due: t.dueDate ? toISODate(t.dueDate) : null,
        priority: t.priority,
        minutes: t.estimatedTime,
        subtasks: t.subtasks.map((x) => ({ id: x.id, title: x.title, done: x.status === "Done" })),
      }))}
      project={project ? { ...project, dueDate: project.dueDate ? toISODate(project.dueDate) : null } : null}
    />
  );
}
