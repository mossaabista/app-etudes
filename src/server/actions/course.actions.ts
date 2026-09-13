"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";

const COURSE_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#06b6d4", "#f97316", "#6366f1",
];

export async function createCourseAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();

  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const professor = (formData.get("professor") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const room = (formData.get("room") as string)?.trim() || null;
  const color = (formData.get("color") as string) || COURSE_COLORS[0];
  const term = (formData.get("term") as string)?.trim() || null;

  if (!code || !name) {
    return { error: "Course code and name are required." };
  }

  await prisma.course.create({
    data: { userId: user.id, code, name, professor, email, room, color, term },
  });

  revalidatePath("/courses");
  redirect("/courses");
}

export async function updateCourseAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const courseId = formData.get("courseId") as string;

  const code = (formData.get("code") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const professor = (formData.get("professor") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;
  const room = (formData.get("room") as string)?.trim() || null;
  const color = (formData.get("color") as string) || COURSE_COLORS[0];
  const term = (formData.get("term") as string)?.trim() || null;

  if (!code || !name) {
    return { error: "Course code and name are required." };
  }

  await prisma.course.update({
    where: { id: courseId, userId: user.id },
    data: { code, name, professor, email, room, color, term },
  });

  revalidatePath("/courses");
  redirect(`/courses/${courseId}`);
}

export async function deleteCourseAction(courseId: string) {
  const user = await requireUser();
  await prisma.course.delete({
    where: { id: courseId, userId: user.id },
  });
  revalidatePath("/courses");
  redirect("/courses");
}

export async function addScheduleAction(_prev: unknown, formData: FormData) {
  const user = await requireUser();
  const courseId = formData.get("courseId") as string;

  const type = (formData.get("type") as string)?.trim();
  const day = formData.get("day") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const room = (formData.get("room") as string)?.trim() || null;

  if (!type || !day || !startTime || !endTime) {
    return { error: "All schedule fields are required." };
  }

  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return { error: "Course not found." };

  await prisma.courseSchedule.create({
    data: { courseId, type, day, startTime, endTime, room },
  });

  revalidatePath(`/courses/${courseId}`);
  return { success: true };
}

export async function deleteScheduleAction(scheduleId: string, courseId: string) {
  const user = await requireUser();
  const course = await prisma.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return;

  await prisma.courseSchedule.delete({ where: { id: scheduleId } });
  revalidatePath(`/courses/${courseId}`);
}
