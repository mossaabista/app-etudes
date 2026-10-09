"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { fromISODate } from "@/lib/dates";
import { PILOT_NOTE, planDay, type PlanBlock } from "@/server/pilot";

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
  await prisma.calendarEvent.createMany({
    data: blocks.slice(0, 30).map((b) => ({
      userId: user.id,
      title: b.title.slice(0, 200),
      type: b.tag.startsWith("Area:") ? b.tag : "Area:travail:taches",
      date,
      startTime: b.start,
      endTime: b.end,
      allDay: false,
      notes: PILOT_NOTE,
    })),
  });
  revalidatePath("/", "layout");
  return { ok: true, count: blocks.length };
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
