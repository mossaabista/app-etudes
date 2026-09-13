"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";

export async function createAssessmentAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();

  const courseId = formData.get("courseId") as string;
  const title = (formData.get("title") as string)?.trim();
  const type = formData.get("type") as string;
  const weight = formData.get("weight") ? parseFloat(formData.get("weight") as string) : null;
  const dueDate = formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!courseId || !title || !type) {
    return { error: "Course, title, and type are required." };
  }

  await prisma.assessment.create({
    data: { userId: user.id, courseId, title, type, weight, dueDate, notes },
  });

  revalidatePath("/assessments");
  revalidatePath(`/courses/${courseId}`);
  redirect("/assessments");
}

export async function updateAssessmentAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const id = formData.get("assessmentId") as string;

  const courseId = formData.get("courseId") as string;
  const title = (formData.get("title") as string)?.trim();
  const type = formData.get("type") as string;
  const weight = formData.get("weight") ? parseFloat(formData.get("weight") as string) : null;
  const dueDate = formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null;
  const status = formData.get("status") as string;
  const grade = formData.get("grade") ? parseFloat(formData.get("grade") as string) : null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!title || !type) {
    return { error: "Title and type are required." };
  }

  await prisma.assessment.update({
    where: { id, userId: user.id },
    data: { courseId, title, type, weight, dueDate, status, grade, notes },
  });

  revalidatePath("/assessments");
  revalidatePath(`/courses/${courseId}`);
  redirect("/assessments");
}

export async function deleteAssessmentAction(id: string) {
  const user = await requireUser();
  const assessment = await prisma.assessment.findFirst({ where: { id, userId: user.id } });
  if (!assessment) return;
  await prisma.assessment.delete({ where: { id } });
  revalidatePath("/assessments");
  revalidatePath(`/courses/${assessment.courseId}`);
}

export async function toggleAssessmentStatusAction(id: string) {
  const user = await requireUser();
  const assessment = await prisma.assessment.findFirst({ where: { id, userId: user.id } });
  if (!assessment) return;

  const newStatus = assessment.status === "Completed" ? "Upcoming" : "Completed";
  await prisma.assessment.update({ where: { id }, data: { status: newStatus } });
  revalidatePath("/assessments");
  revalidatePath(`/courses/${assessment.courseId}`);
  revalidatePath("/today");
}
