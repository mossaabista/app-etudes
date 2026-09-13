"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";

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

  revalidatePath("/tasks");
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

  revalidatePath("/tasks");
  revalidatePath("/today");
  return { success: true };
}

export async function toggleTaskStatusAction(id: string) {
  const user = await requireUser();
  const task = await prisma.task.findFirst({ where: { id, userId: user.id } });
  if (!task) return;

  const newStatus = task.status === "Done" ? "ToDo" : "Done";
  await prisma.task.update({ where: { id }, data: { status: newStatus } });
  revalidatePath("/tasks");
  revalidatePath("/today");
}

export async function deleteTaskAction(id: string) {
  const user = await requireUser();
  await prisma.task.delete({ where: { id, userId: user.id } });
  revalidatePath("/tasks");
  revalidatePath("/today");
}
