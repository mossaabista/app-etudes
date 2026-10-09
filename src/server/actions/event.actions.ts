"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { fromISODate, toISODate, wallTimeToUtc } from "@/lib/dates";
import type { Undo } from "@/server/actions/capture.actions";

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

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const refresh = () => {
  revalidatePath("/today");
  revalidatePath("/calendar");
};

export interface EventPatch {
  title: string;
  date: string;
  start: string | null;
  end: string | null;
  notes: string | null;
}

/** Change one of the user's events; returns what undoes the change. */
export async function updateEventAction(id: string, patch: EventPatch): Promise<{ ok: true; undo: Undo } | { error: string }> {
  const user = await requireUser();
  const title = String(patch?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const date = String(patch?.date ?? "");
  const start = patch?.start ? String(patch.start) : null;
  const end = patch?.end ? String(patch.end) : null;
  if (!title) return { error: "Donne un titre à l'événement." };
  if (!DATE.test(date) || !fromISODate(date)) return { error: "Date invalide." };
  if ((start && !TIME.test(start)) || (end && !TIME.test(end))) return { error: "Heure invalide." };
  if (end && !start) return { error: "Une heure de fin demande une heure de début." };
  if (start && end && end <= start) return { error: "L'heure de fin doit suivre l'heure de début." };
  const current = await prisma.calendarEvent.findFirst({ where: { id: String(id), userId: user.id } });
  if (!current) return { error: "Événement introuvable." };
  const undo: Undo = { t: "event-was", id: current.id, date: toISODate(current.date), startTime: current.startTime, endTime: current.endTime, title: current.title, notes: current.notes };
  await prisma.calendarEvent.update({
    where: { id: current.id },
    data: { title, date: fromISODate(date)!, startTime: start, endTime: end, allDay: !start, notes: patch.notes ? String(patch.notes).trim().slice(0, 2000) || null : null },
  });
  refresh();
  return { ok: true, undo };
}

/** Delete one of the user's events; returns what brings it back. */
export async function deleteEventAction(id: string): Promise<{ ok: true; undo: Undo } | { error: string }> {
  const user = await requireUser();
  const e = await prisma.calendarEvent.findFirst({ where: { id: String(id), userId: user.id } });
  if (!e) return { error: "Événement introuvable." };
  await prisma.calendarEvent.deleteMany({ where: { id: e.id, userId: user.id } });
  refresh();
  return {
    ok: true,
    undo: { t: "restore-event", data: { title: e.title, type: e.type, date: toISODate(e.date), startTime: e.startTime, endTime: e.endTime, allDay: e.allDay, notes: e.notes, courseId: e.courseId } },
  };
}
