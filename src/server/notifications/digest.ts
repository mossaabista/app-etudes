import { prisma } from "@/lib/db";
import { addDays, dayName, startOfDay } from "@/lib/dates";

export interface Digest {
  title: string;
  body: string;
  url: string;
}

const MAX_LISTED = 3;
const MAX_TITLE = 42;

/**
 * Notification bodies get truncated hard on iOS, so trim each entry. Brightspace
 * labels quiz items with their type and the name then repeats it — "Questionnaire :
 * Questionnaire 4" — which burns a third of the line before saying anything. Only
 * strips the prefix when the very next word repeats it, and never touches the
 * stored title.
 */
function shortTitle(title: string): string {
  const deduped = title.replace(/^(\p{L}+)\s*:\s*(?=\1\b)/iu, "").trim();
  return deduped.length > MAX_TITLE ? `${deduped.slice(0, MAX_TITLE - 1).trimEnd()}…` : deduped;
}

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
    ...assessments.map((a) => `${shortTitle(a.title)} (${a.course.code})`),
    ...labs.map((l) => `${shortTitle(l.title)} (${l.course.code})`),
    ...tasks.map((t) => shortTitle(t.title)),
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
