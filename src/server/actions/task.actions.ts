"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { wallTimeToUtc } from "@/lib/dates";

function revalidateTasks() {
  // Tasks show on Today, the calendar, every sector and section page and the courses:
  // refresh the whole app rather than chase each path.
  revalidatePath("/", "layout");
}

export async function createTaskAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const courseId = (formData.get("courseId") as string) || null;
  const projectId = (formData.get("projectId") as string) || null;
  const assessmentId = (formData.get("assessmentId") as string) || null;
  const parentId = (formData.get("parentId") as string) || null;
  const priority = (formData.get("priority") as string) || "Medium";
  const status = (formData.get("status") as string) || "ToDo";
  const dueDate = formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null;
  const estimatedTime = formData.get("estimatedTime") ? parseInt(formData.get("estimatedTime") as string) : null;
  const category = (formData.get("category") as string)?.trim() || null;

  if (!title) {
    return { error: "Title is required." };
  }

  await prisma.task.create({
    data: {
      userId: user.id, title, description, courseId: courseId || null,
      projectId: projectId || null, assessmentId: assessmentId || null,
      parentId: parentId || null, priority, status, dueDate, estimatedTime, category,
    },
  });

  revalidateTasks();
  revalidatePath("/today");
  if (courseId) revalidatePath(`/courses/${courseId}`);
  return { success: true };
}

export async function updateTaskAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const id = formData.get("taskId") as string;

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const courseId = (formData.get("courseId") as string) || null;
  const priority = (formData.get("priority") as string) || "Medium";
  const status = (formData.get("status") as string) || "ToDo";
  const dueDate = formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null;
  const estimatedTime = formData.get("estimatedTime") ? parseInt(formData.get("estimatedTime") as string) : null;
  const category = (formData.get("category") as string)?.trim() || null;

  if (!title) {
    return { error: "Title is required." };
  }

  await prisma.task.update({
    where: { id, userId: user.id },
    data: { title, description, courseId: courseId || null, priority, status, dueDate, estimatedTime, category },
  });

  revalidateTasks();
  revalidatePath("/today");
  return { success: true };
}

export async function toggleTaskStatusAction(id: string) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return;

  const newStatus = task.status === "Done" ? "ToDo" : "Done";
  await prisma.task.update({ where: { id }, data: { status: newStatus } });
  revalidateTasks();
  revalidatePath("/today");
}

export async function deleteTaskAction(id: string) {
  const user = await requireUser();
  // Its steps go with it rather than surfacing as loose tasks.
  await prisma.task.deleteMany({ where: { parentId: id, userId: user.id } });
  await prisma.task.delete({ where: { id, userId: user.id } });
  revalidateTasks();
  revalidatePath("/today");
}

/** File a task under "area:sub" (or clear it back to the unsorted tray with null). */
export async function setTaskCategoryAction(id: string, category: string | null) {
  const user = await requireUser();
  const [area, sub] = category?.split(":") ?? [];
  // A project sub-section is the project itself, so the link to it is kept in step.
  const projectId =
    area === "projets" && sub && sub !== "general"
      ? (await prisma.project.findFirst({ where: { id: sub, userId: user.id }, select: { id: true } }))?.id ?? null
      : undefined;
  await prisma.task.update({
    where: { id, userId: user.id },
    data: { category, ...(projectId !== undefined ? { projectId } : {}) },
  });
  revalidateTasks();
}

/** Add a task from a section's own list: title, and optionally a day, priority, length or parent. */
export async function quickTaskAction(input: { title: string; category: string; due?: string | null; priority?: string; minutes?: number | null; parentId?: string | null; courseId?: string | null }) {
  const user = await requireUser();
  const title = input.title.trim().slice(0, 200);
  if (!title) return { error: "Titre requis." };
  const parent = input.parentId ? await prisma.task.findFirst({ where: { id: input.parentId, userId: user.id }, select: { id: true, category: true, dueDate: true } }) : null;
  const due = input.due && /^\d{4}-\d{2}-\d{2}$/.test(input.due) ? input.due : null;
  const [y, m, d] = (due ?? "").split("-").map(Number);
  await prisma.task.create({
    data: {
      userId: user.id,
      title,
      category: parent?.category ?? input.category.slice(0, 60),
      parentId: parent?.id ?? null,
      priority: ["Low", "Medium", "High", "Critical"].includes(input.priority ?? "") ? input.priority! : "Medium",
      dueDate: due ? wallTimeToUtc([y, m, d, 23, 59, 0]) : parent?.dueDate ?? null,
      estimatedTime: input.minutes && input.minutes > 0 ? Math.round(input.minutes) : null,
      courseId: input.courseId ?? null,
      status: "ToDo",
    },
  });
  revalidateTasks();
  return { ok: true };
}

export async function updateTaskFieldsAction(id: string, patch: { priority?: string; due?: string | null; minutes?: number | null; title?: string }) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!task) return { error: "Introuvable." };
  const data: { priority?: string; dueDate?: Date | null; estimatedTime?: number | null; title?: string } = {};
  if (patch.priority && ["Low", "Medium", "High", "Critical"].includes(patch.priority)) data.priority = patch.priority;
  if (patch.due !== undefined) {
    if (patch.due && /^\d{4}-\d{2}-\d{2}$/.test(patch.due)) {
      const [y, m, d] = patch.due.split("-").map(Number);
      data.dueDate = wallTimeToUtc([y, m, d, 23, 59, 0]);
    } else data.dueDate = null;
  }
  if (patch.minutes !== undefined) data.estimatedTime = patch.minutes && patch.minutes > 0 ? Math.round(patch.minutes) : null;
  if (patch.title?.trim()) data.title = patch.title.trim().slice(0, 200);
  await prisma.task.update({ where: { id }, data });
  revalidateTasks();
  return { ok: true };
}
