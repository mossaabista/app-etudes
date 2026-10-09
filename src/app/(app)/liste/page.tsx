import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { getLayout } from "@/server/layout";
import { startOfDay, toISODate } from "@/lib/dates";
import { parseTaskQuery, sortTasks, taskWhere } from "@/lib/task-list";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskList, type ListTask } from "@/components/tasks/TaskList";

export const metadata = { title: "Toutes mes tâches" };

const LIMIT = 200;

export default async function TaskListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const query = parseTaskQuery(await searchParams);
  const today = startOfDay(new Date());
  const [layout, rows, total] = await Promise.all([
    getLayout(user.id),
    prisma.task.findMany({
      where: taskWhere(user.id, query, today),
      select: { id: true, title: true, status: true, priority: true, dueDate: true, category: true, createdAt: true, course: { select: { code: true } } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    prisma.task.count({ where: taskWhere(user.id, query, today) }),
  ]);
  const areaLabel = new Map(layout.areas.map((a) => [a.key, a.label]));
  const subLabel = new Map<string, string>(layout.areas.flatMap((a) => a.subs.map((s) => [`${a.key}:${s.key}`, s.label] as [string, string])));
  const tasks: ListTask[] = sortTasks(rows, query.sort).map((t) => {
    const [area] = (t.category ?? "").split(":");
    return {
      id: t.id,
      title: t.title,
      done: t.status === "Done",
      priority: t.priority,
      due: t.dueDate ? toISODate(t.dueDate) : null,
      overdue: !!t.dueDate && t.dueDate < today && t.status !== "Done",
      where: t.course?.code ?? (t.category ? (subLabel.get(t.category) ?? areaLabel.get(area) ?? null) : null),
    };
  });
  return (
    <div className="area-enter mx-auto max-w-4xl">
      <PageHeader title="Toutes mes tâches" description="Tous secteurs confondus : cherche, filtre, coche ou supprime en lot." />
      <TaskList query={query} tasks={tasks} total={total} limit={LIMIT} areas={layout.areas.map((a) => ({ key: a.key, label: a.label }))} />
    </div>
  );
}
