import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/server/auth/session";

export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const courseId = formData.get("courseId") as string;
  const file = formData.get("file") as File;

  if (!courseId || !file) {
    return NextResponse.json({ error: "Course and file are required." }, { status: 400 });
  }

  if (!file.name.endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 400 });
  }

  const course = await prisma.course.findFirst({ where: { id: courseId, userId } });
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  // Store file as base64 data URL for now (no external storage needed)
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString("base64");
  const dataUrl = `data:application/pdf;base64,${base64}`;

  const syllabus = await prisma.syllabus.create({
    data: {
      userId,
      courseId,
      fileName: file.name,
      fileUrl: dataUrl.slice(0, 500), // Store truncated URL as placeholder
      parsed: false,
    },
  });

  return NextResponse.json({ id: syllabus.id, fileName: syllabus.fileName });
}
