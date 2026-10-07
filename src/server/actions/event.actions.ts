"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { wallTimeToUtc } from "@/lib/dates";

export type EventState = { error?: string; success?: boolean } | null;

/** "2026-10-09" + "21:00" in Ottawa, stored as the UTC instant it names. */
function toInstant(isoDate: string, time: string | null) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [h, mi] = (time ?? "00:00").split(":").map(Number);
  return wallTimeToUtc([y, m, d, h, mi, 0]);
}

export async function createEvent(_prev: EventState, formData: FormData): Promise<EventState> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim() || null;
  const endTime = String(formData.get("endTime") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!title) return { error: "Donne un titre à l'événement." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Date invalide." };
  if (endTime && startTime && endTime < startTime) {
    return { error: "L'heure de fin précède l'heure de début." };
  }

  await prisma.calendarEvent.create({
    data: {
      userId: user.id,
      title,
      type: "Personal",
      date: toInstant(date, startTime),
      startTime,
      endTime,
      allDay: !startTime,
      notes,
    },
  });

  revalidatePath("/today");
  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteEvent(id: string) {
  const user = await requireUser();
  // Scoped to the caller so an id from the client cannot reach another account's row.
  await prisma.calendarEvent.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/today");
  revalidatePath("/calendar");
}
