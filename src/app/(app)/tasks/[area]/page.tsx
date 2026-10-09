import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { AreaView, type AreaTask } from "@/components/tasks/AreaView";
import { getLayout, findArea } from "@/server/layout";
import { getMessages } from "@/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }) {
  const { area: key } = await params;
  const user = await requireUser();
  const area = findArea(await getLayout(user.id), key);
  return { title: area?.label ?? (await getMessages()).nav.sectors };
}

export default async function TaskAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const [{ area: key }, { s }] = await Promise.all([params, searchParams]);
  const user = await requireUser();
  const area = findArea(await getLayout(user.id), key);
  if (!area) notFound();
  const splitCategory = (c: string | null) => {
    const [a, sub] = (c ?? "").split(":");
    return a === area.key && sub ? { area: a, sub } : null;
  };

  const isProjects = area.key === "projets";
  const [tasks, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId: user.id,
        parentId: null,
        OR: [
          { category: { startsWith: `${area.key}:` } },
          // Project tasks made from the Projects pages were never given a category.
          ...(isProjects ? [{ category: null, projectId: { not: null } }] : []),
        ],
      },
      select: { id: true, title: true, status: true, dueDate: true, category: true, projectId: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    isProjects
      ? prisma.project.findMany({ where: { userId: user.id }, select: { id: true, title: true }, orderBy: { createdAt: "asc" } })
      : Promise.resolve([]),
  ]);

  const rows: AreaTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    done: t.status === "Done",
    due: t.dueDate?.toISOString() ?? null,
    sub: splitCategory(t.category)?.sub ?? t.projectId ?? "general",
  }));

  return <AreaView area={area} projects={projects} tasks={rows} initialSub={s} />;
}
