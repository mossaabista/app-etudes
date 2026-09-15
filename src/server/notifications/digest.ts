import { prisma } from "@/lib/db";
import { addDays, dayName, startOfDay } from "@/lib/dates";

export interface Digest {
  title: string;
  body: string;
  url: string;
}

const MAX_LISTED = 4;

/** What the user has to do today. Returns null on a day with nothing at all. */
export async function buildDailyDigest(userId: string): Promise<Digest | null> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = addDays(dayStart, 1);
  const weekday = dayName(now);

  const dueToday = { gte: dayStart, lt: dayEnd };

  const [schedules, assessments, tasks, labs] = await Promise.all([
    prisma.courseSchedule.findMany({
      where: { course: { userId }, day: weekday },
      include: { course: { select: { code: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.assessment.findMany({
      where: { userId, status: { not: "Completed" }, dueDate: dueToday },
      include: { course: { select: { code: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: { userId, parentId: null, status: { not: "Done" }, dueDate: dueToday },
      orderBy: { priority: "desc" },
    }),
    prisma.labSession.findMany({
      where: { userId, status: { notIn: ["Completed", "Submitted"] }, dueDate: dueToday },
      include: { course: { select: { code: true } } },
    }),
  ]);

  const deadlines = [
    ...assessments.map((a) => `${a.title} (${a.course.code})`),
    ...labs.map((l) => `${l.title} (${l.course.code})`),
    ...tasks.map((t) => t.title),
  ];

  // A day with no classes and nothing due is not worth a notification.
  if (deadlines.length === 0 && schedules.length === 0) return null;

  const lines: string[] = [];
  if (deadlines.length > 0) {
    const shown = deadlines.slice(0, MAX_LISTED).join(" · ");
    const rest = deadlines.length - MAX_LISTED;
    lines.push(rest > 0 ? `${shown} +${rest}` : shown);
  }
  if (schedules.length > 0) {
    lines.push(
      "Cours : " +
        schedules.map((s) => `${s.course.code} ${s.startTime.replace(":", "h")}`).join(" · ")
    );
  }

  const title =
    deadlines.length === 0
      ? "Aujourd'hui · aucune échéance"
      : `Aujourd'hui · ${deadlines.length} à rendre`;

  return { title, body: lines.join("\n"), url: "/today" };
}
