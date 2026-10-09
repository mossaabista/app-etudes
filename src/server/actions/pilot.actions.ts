"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { addDays, fromISODate, toISODate } from "@/lib/dates";
import { PILOT_NOTE, planDay, planWeek, type PlanBlock } from "@/server/pilot";
import { savePlanningPrefs } from "@/server/planning-prefs";
import type { PlanningPrefs } from "@/lib/planning-prefs";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Blocks coming back from the browser: only well-formed ones, as calendar rows. */
function rows(userId: string, date: Date, blocks: PlanBlock[]) {
  return (Array.isArray(blocks) ? blocks : [])
    .filter((b) => b && typeof b.title === "string" && b.title.trim() && TIME.test(b.start) && TIME.test(b.end) && b.end > b.start)
    .slice(0, 30)
    .map((b) => ({
      userId,
      title: b.title.trim().slice(0, 200),
      type: typeof b.tag === "string" && /^Area:[a-z0-9-]+:[a-z0-9-]+$/.test(b.tag) ? b.tag : "Area:travail:taches",
      date,
      startTime: b.start,
      endTime: b.end,
      allDay: false,
      notes: PILOT_NOTE,
    }));
}

export async function proposePlanAction(day: string) {
  const user = await requireUser();
  if (!fromISODate(day)) return { error: "Jour invalide." };
  return planDay(user.id, day);
}

/** Put the accepted blocks on the calendar. */
export async function acceptPlanAction(day: string, blocks: PlanBlock[]) {
  const user = await requireUser();
  const date = fromISODate(day);
  if (!date) return { error: "Jour invalide." };
  const data = rows(user.id, date, blocks);
  await prisma.calendarEvent.createMany({ data });
  revalidatePath("/", "layout");
  return { ok: true, count: data.length };
}

/** Take back what the Pilot put on that day (only its own blocks). */
export async function undoPlanAction(day: string) {
  const user = await requireUser();
  const date = fromISODate(day);
  if (!date) return { error: "Jour invalide." };
  const { count } = await prisma.calendarEvent.deleteMany({ where: { userId: user.id, date, notes: PILOT_NOTE } });
  revalidatePath("/", "layout");
  return { ok: true, count };
}

/** Propose seven days of blocks from a day. Nothing is saved. */
export async function proposeWeekAction(from: string) {
  const user = await requireUser();
  if (!fromISODate(from)) return { error: "Jour invalide." };
  return planWeek(user.id, from < toISODate(new Date()) ? toISODate(new Date()) : from);
}

/** Put an accepted week on the calendar, day by day. */
export async function acceptWeekAction(days: { day: string; blocks: PlanBlock[] }[]) {
  const user = await requireUser();
  const data = (Array.isArray(days) ? days : []).slice(0, 7).flatMap((d) => {
    const date = typeof d?.day === "string" ? fromISODate(d.day) : null;
    return date ? rows(user.id, date, d.blocks) : [];
  });
  await prisma.calendarEvent.createMany({ data });
  revalidatePath("/", "layout");
  return { ok: true, count: data.length };
}

/** Take back the Pilot's blocks over the seven days from a day. */
export async function undoWeekAction(from: string) {
  const user = await requireUser();
  const date = fromISODate(from);
  if (!date) return { error: "Jour invalide." };
  const { count } = await prisma.calendarEvent.deleteMany({ where: { userId: user.id, notes: PILOT_NOTE, date: { gte: date, lt: addDays(date, 7) } } });
  revalidatePath("/", "layout");
  return { ok: true, count };
}

/** Save the user's planning limits (clamped to sensible ranges). */
export async function savePlanningPrefsAction(input: PlanningPrefs) {
  const user = await requireUser();
  try {
    const saved = await savePlanningPrefs(user.id, input);
    revalidatePath("/", "layout");
    return { ok: true as const, saved };
  } catch {
    return { error: "Impossible d'enregistrer ces préférences." };
  }
}
