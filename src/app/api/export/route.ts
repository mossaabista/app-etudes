import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/server/auth/session";

export const runtime = "nodejs";

/**
 * Everything the account holds, as one JSON file. Read-only. The password hash, push keys
 * and the private calendar feed address are left out: they are credentials, not content.
 */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, courses, assessments, tasks, projects, events, labs, syllabi, entries] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, createdAt: true } }),
    prisma.course.findMany({ where: { userId }, include: { schedules: true } }),
    prisma.assessment.findMany({ where: { userId } }),
    prisma.task.findMany({ where: { userId } }),
    prisma.project.findMany({ where: { userId }, include: { milestones: true, members: true } }),
    prisma.calendarEvent.findMany({ where: { userId } }),
    prisma.labSession.findMany({ where: { userId } }),
    prisma.syllabus.findMany({ where: { userId }, select: { fileName: true, courseId: true, parsed: true, rawData: true, createdAt: true } }),
    prisma.trackerEntry.findMany({ where: { userId } }),
  ]);

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), app: "OROM", user, courses, assessments, tasks, projects, events, labs, syllabi, entries }, null, 2);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="orom-export-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
