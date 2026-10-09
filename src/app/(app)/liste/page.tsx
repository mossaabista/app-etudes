import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { getLayout } from "@/server/layout";
import { startOfDay, toISODate } from "@/lib/dates";
import { parseTaskQuery, sortTasks, taskWhere } from "@/lib/task-list";
import { PageHeader } from "@/components/ui/PageHeader";
import { TaskList, type ListTask } from "@/components/tasks/TaskList";
import { getMessages } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).workspace.list.title };
}

const LIMIT = 200;

export default async function TaskListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const query = parseTaskQuery(await searchParams);
  const today = startOfDay(new Date());
  const [t, layout, rows, total] = await Promise.all([
    getMessages(),
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
  const tasks: ListTask[] = sortTasks(rows, query.sort).map((r) => {
    const [area] = (r.category ?? "").split(":");
    return {
      id: r.id,
      title: r.title,
      done: r.status === "Done",
      priority: r.priority,
      due: r.dueDate ? toISODate(r.dueDate) : null,
      overdue: !!r.dueDate && r.dueDate < today && r.status !== "Done",
      where: r.course?.code ?? (r.category ? (subLabel.get(r.category) ?? areaLabel.get(area) ?? null) : null),
    };
  });
  return (
    <div className="area-enter mx-auto max-w-4xl">
      <PageHeader title={t.workspace.list.title} description={t.workspace.list.intro} />
      <TaskList query={query} tasks={tasks} total={total} limit={LIMIT} areas={layout.areas.map((a) => ({ key: a.key, label: a.label }))} />
    </div>
  );
}
