"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";

export async function createProjectAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const courseId = (formData.get("courseId") as string) || null;
  const dueDate = formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null;

  if (!title) return { error: "Title is required." };

  const project = await prisma.project.create({
    data: { userId: user.id, title, description, courseId: courseId || null, dueDate },
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const id = formData.get("projectId") as string;

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const courseId = (formData.get("courseId") as string) || null;
  const status = (formData.get("status") as string) || "InProgress";
  const dueDate = formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null;
  const progress = formData.get("progress") ? parseInt(formData.get("progress") as string) : 0;

  if (!title) return { error: "Title is required." };

  await prisma.project.update({
    where: { id, userId: user.id },
    data: { title, description, courseId: courseId || null, status, dueDate, progress },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function deleteProjectAction(id: string) {
  const user = await requireUser();
  await prisma.project.delete({ where: { id, userId: user.id } });
  revalidatePath("/projects");
  redirect("/projects");
}

export async function addMilestoneAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const projectId = formData.get("projectId") as string;
  const title = (formData.get("title") as string)?.trim();
  const dueDate = formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null;

  if (!title) return { error: "Title is required." };

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!project) return { error: "Project not found." };

  const count = await prisma.projectMilestone.count({ where: { projectId } });
  await prisma.projectMilestone.create({
    data: { projectId, title, dueDate, sortOrder: count },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function toggleMilestoneAction(id: string, projectId: string) {
  const milestone = await prisma.projectMilestone.findFirst({ where: { id, projectId } });
  if (!milestone) return;

  await prisma.projectMilestone.update({
    where: { id },
    data: { status: milestone.status === "Completed" ? "Pending" : "Completed" },
  });

  const total = await prisma.projectMilestone.count({ where: { projectId } });
  const completed = await prisma.projectMilestone.count({ where: { projectId, status: "Completed" } });
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  await prisma.project.update({ where: { id: projectId }, data: { progress } });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteMilestoneAction(id: string, projectId: string) {
  await prisma.projectMilestone.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}

export async function addMemberAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const projectId = formData.get("projectId") as string;
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim() || null;
  const role = (formData.get("role") as string)?.trim() || null;

  if (!name) return { error: "Name is required." };

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!project) return { error: "Project not found." };

  await prisma.projectMember.create({ data: { projectId, name, email, role } });
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteMemberAction(id: string, projectId: string) {
  await prisma.projectMember.delete({ where: { id } });
  revalidatePath(`/projects/${projectId}`);
}
