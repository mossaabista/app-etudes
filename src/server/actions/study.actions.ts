"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { fromISODate, toISODate } from "@/lib/dates";
import { PILOT_NOTE } from "@/server/pilot";
import { STUDY_PREFIX, planStudy, type StudySession } from "@/server/study";

/** Propose a revision plan for some assessments, or for everything coming up. Nothing is saved. */
export async function proposeStudyAction(ids: string[] | "upcoming") {
  const user = await requireUser();
  return planStudy(user.id, ids === "upcoming" ? "upcoming" : ids.slice(0, 12));
}

/**
 * Put an accepted plan on the calendar. A previous plan for the same assessments is
 * replaced (its future sessions only); everything else on the calendar is left alone.
 */
export async function acceptStudyAction(sessions: StudySession[]) {
  const user = await requireUser();
  const ids = [...new Set(sessions.map((s) => s.assessmentId))].slice(0, 12);
  const assessments = await prisma.assessment.findMany({ where: { id: { in: ids }, userId: user.id }, select: { id: true, title: true, courseId: true } });
  const today = fromISODate(toISODate(new Date()))!;
  for (const a of assessments) {
    await prisma.calendarEvent.deleteMany({ where: { userId: user.id, notes: PILOT_NOTE, date: { gte: today }, title: { startsWith: `${STUDY_PREFIX}${a.title}` } } });
  }
  const byId = new Map(assessments.map((a) => [a.id, a]));
  const rows = sessions
    .slice(0, 80)
    .filter((s) => byId.has(s.assessmentId) && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d\d:\d\d$/.test(s.start) && /^\d\d:\d\d$/.test(s.end))
    .map((s) => {
      const a = byId.get(s.assessmentId)!;
      return {
        userId: user.id,
        courseId: a.courseId,
        title: `${STUDY_PREFIX}${a.title} — ${s.topic}`.slice(0, 200),
        type: "Area:travail:taches",
        date: fromISODate(s.date)!,
        startTime: s.start,
        endTime: s.end,
        allDay: false,
        notes: PILOT_NOTE,
      };
    });
  await prisma.calendarEvent.createMany({ data: rows });
  revalidatePath("/", "layout");
  return { ok: true, count: rows.length };
}
