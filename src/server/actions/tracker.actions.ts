"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { fromISODate, wallTimeToUtc } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma";

/** What a section page sends to record a row. Dates travel as "YYYY-MM-DD" (Ottawa days). */
export interface EntryInput {
  module: string;
  kind: string;
  day?: string;
  text?: string | null;
  value?: number | null;
  done?: boolean;
  data?: Record<string, unknown> | null;
}

function refresh(module: string) {
  const [area, sub] = module.split(":");
  revalidatePath(`/tasks/${area}/${sub}`);
  revalidatePath("/tasks/[area]/[sub]", "page");
}

// Rows are pinned to noon of their day, so the Ottawa date reads the same in any zone.
function dayToDate(day?: string) {
  if (!day) return new Date();
  const d = fromISODate(day);
  if (!d) return new Date();
  const [y, m, dd] = day.split("-").map(Number);
  return wallTimeToUtc([y, m, dd, 12, 0, 0]);
}

const clean = (data?: Record<string, unknown> | null) =>
  data ? (JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue) : undefined;

export async function addEntryAction(input: EntryInput) {
  const user = await requireUser();
  if (!input.module || !input.kind) return { error: "Section inconnue." };
  const text = input.text?.toString().trim().slice(0, 4000) || null;
  const entry = await prisma.trackerEntry.create({
    data: {
      userId: user.id,
      module: input.module,
      kind: input.kind,
      date: dayToDate(input.day),
      text,
      value: input.value ?? null,
      done: input.done ?? false,
      data: clean(input.data),
    },
  });
  refresh(input.module);
  return { id: entry.id };
}

export async function updateEntryAction(id: string, patch: Partial<Omit<EntryInput, "module" | "kind">>) {
  const user = await requireUser();
  const current = await prisma.trackerEntry.findFirst({ where: { id, userId: user.id } });
  if (!current) return { error: "Introuvable." };
  await prisma.trackerEntry.update({
    where: { id },
    data: {
      ...(patch.day !== undefined ? { date: dayToDate(patch.day) } : {}),
      ...(patch.text !== undefined ? { text: patch.text?.toString().trim().slice(0, 4000) || null } : {}),
      ...(patch.value !== undefined ? { value: patch.value } : {}),
      ...(patch.done !== undefined ? { done: patch.done } : {}),
      ...(patch.data !== undefined
        ? { data: clean({ ...((current.data as Record<string, unknown>) ?? {}), ...(patch.data ?? {}) }) }
        : {}),
    },
  });
  refresh(current.module);
  return { ok: true };
}

export async function deleteEntryAction(id: string) {
  const user = await requireUser();
  const current = await prisma.trackerEntry.findFirst({ where: { id, userId: user.id } });
  if (!current) return;
  await prisma.trackerEntry.delete({ where: { id } });
  refresh(current.module);
}

/** Put something on the personal calendar: it then shows on Today and in the Calendar. */
export async function scheduleAction(input: {
  title: string;
  day: string;
  start?: string | null;
  end?: string | null;
  notes?: string | null;
  module?: string;
}) {
  const user = await requireUser();
  const title = input.title.trim().slice(0, 200);
  const date = fromISODate(input.day);
  if (!title || !date) return { error: "Titre ou date manquant." };
  await prisma.calendarEvent.create({
    data: {
      userId: user.id,
      title,
      // Tagged with its section so Today and the Calendar can colour it.
      type: input.module ? `Area:${input.module}` : "Personal",
      date,
      startTime: input.start || null,
      endTime: input.end || null,
      allDay: !input.start,
      notes: input.notes?.slice(0, 2000) || null,
    },
  });
  revalidatePath("/today");
  revalidatePath("/calendar");
  if (input.module) refresh(input.module);
  return { ok: true };
}
