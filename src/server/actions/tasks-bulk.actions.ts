"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { MASS_DELETE } from "@/lib/risk";
import type { Undo } from "@/server/actions/capture.actions";

const ids = (list: unknown) => [...new Set((Array.isArray(list) ? list : []).filter((x): x is string => typeof x === "string"))].slice(0, 200);
const refresh = () => revalidatePath("/", "layout");

/** Mark the chosen tasks done, at once; returns what puts each back as it was. */
export async function bulkCompleteAction(list: string[]): Promise<{ ok: true; count: number; undo: Undo | null } | { error: string }> {
  const user = await requireUser();
  const chosen = await prisma.task.findMany({ where: { id: { in: ids(list) }, userId: user.id, status: { not: "Done" } }, select: { id: true, status: true } });
  if (!chosen.length) return { error: "Aucune tâche à cocher." };
  const undo: Undo = { t: "many", list: chosen.map((t) => ({ t: "task-status", id: t.id, status: t.status })) };
  await prisma.task.updateMany({ where: { id: { in: chosen.map((t) => t.id) }, userId: user.id }, data: { status: "Done" } });
  refresh();
  return { ok: true, count: chosen.length, undo };
}

/**
 * Delete the chosen tasks. Right away for a few; past MASS_DELETE, only once confirmed.
 * Tasks with sub-tasks are left alone: undo could not put the sub-tasks back under them.
 */
export async function bulkDeleteAction(list: string[], confirmed = false): Promise<{ ok: true; count: number; kept: number; undo: Undo | null } | { confirm: string } | { error: string }> {
  const user = await requireUser();
  const chosen = await prisma.task.findMany({ where: { id: { in: ids(list) }, userId: user.id } });
  if (!chosen.length) return { error: "Aucune tâche à supprimer." };
  const withSubtasks = new Set((await prisma.task.findMany({ where: { userId: user.id, parentId: { in: chosen.map((t) => t.id) } }, select: { parentId: true } })).map((s) => s.parentId));
  const doomed = chosen.filter((t) => !withSubtasks.has(t.id));
  if (doomed.length > MASS_DELETE && !confirmed) return { confirm: `Supprimer ${doomed.length} tâches d'un coup ?` };
  if (doomed.length) await prisma.task.deleteMany({ where: { id: { in: doomed.map((t) => t.id) }, userId: user.id } });
  refresh();
  return {
    ok: true,
    count: doomed.length,
    kept: chosen.length - doomed.length,
    undo: doomed.length
      ? {
          t: "many",
          list: doomed.map((t) => ({
            t: "restore-task",
            data: { title: t.title, description: t.description, category: t.category, dueDate: t.dueDate?.toISOString() ?? null, estimatedTime: t.estimatedTime, priority: t.priority, status: t.status, courseId: t.courseId, projectId: t.projectId },
          })),
        }
      : null,
  };
}
