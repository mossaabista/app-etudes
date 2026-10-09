"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { WORKOUT_NOTE, scheduleWorkouts, type WorkoutOpts } from "@/server/fitness";

const refresh = () => {
  revalidatePath("/today");
  revalidatePath("/calendar");
  revalidatePath("/tasks/[area]/[sub]", "page");
};

/** Book the week's sessions in free time, right away; the reply says where, and can be undone. */
export async function scheduleWorkoutsAction(opts: Partial<WorkoutOpts>) {
  const user = await requireUser();
  const r = await scheduleWorkouts(user.id, opts ?? {});
  refresh();
  return { ok: true as const, message: r.message, ids: r.ids };
}

/** Take back sessions this feature booked (only those, only this user's). */
export async function undoWorkoutsAction(ids: string[]) {
  const user = await requireUser();
  const list = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string").slice(0, 14);
  const { count } = await prisma.calendarEvent.deleteMany({ where: { id: { in: list }, userId: user.id, notes: WORKOUT_NOTE } });
  refresh();
  return { removed: count };
}
