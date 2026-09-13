import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody } from "@/components/ui/Card";
import { TaskRow } from "@/components/tasks/TaskRow";
import { TaskForm } from "@/components/tasks/TaskForm";
import { AddTaskButton } from "@/components/tasks/AddTaskButton";

export default async function TasksPage() {
  const user = await requireUser();

  const [tasks, courses] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, parentId: null },
      include: { course: { select: { code: true, color: true } } },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
    }),
    prisma.course.findMany({
      where: { userId: user.id },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const todo = tasks.filter((t) => t.status !== "Done");
  const done = tasks.filter((t) => t.status === "Done");

  return (
    <>
      <PageHeader
        title="Tasks"
        description="All your tasks across courses and projects."
        action={<AddTaskButton courses={courses} />}
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create tasks to track your work."
          action={<AddTaskButton courses={courses} />}
        />
      ) : (
        <div className="space-y-6">
          {todo.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">To Do ({todo.length})</h3>
              <div className="space-y-2">
                {todo.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Done ({done.length})</h3>
              <div className="space-y-2">
                {done.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
