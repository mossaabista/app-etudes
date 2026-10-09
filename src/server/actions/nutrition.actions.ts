"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { COURSES, addGroceries } from "@/server/groceries";

/** Put a menu's groceries on the shopping list in one go; returns the new rows so they can be taken back. */
export async function addGroceriesAction(items: { food: string; grams: number }[]): Promise<{ ok: true; added: number; skipped: number; ids: string[] } | { error: string }> {
  const user = await requireUser();
  const r = await addGroceries(user.id, items);
  if ("error" in r) return r;
  revalidatePath("/tasks/[area]/[sub]", "page");
  return { ok: true, ...r };
}

/** Take back groceries just added from a menu (only those still unchecked). */
export async function removeGroceriesAction(ids: string[]) {
  const user = await requireUser();
  const list = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string").slice(0, 80);
  // Only rows this feature created: an id of something the user typed is left alone.
  const mine = await prisma.trackerEntry.findMany({ where: { id: { in: list }, userId: user.id, module: COURSES, done: false }, select: { id: true, data: true } });
  const ours = mine.filter((r) => (r.data as { from?: string } | null)?.from === "nutrition").map((r) => r.id);
  const { count } = ours.length ? await prisma.trackerEntry.deleteMany({ where: { id: { in: ours }, userId: user.id } }) : { count: 0 };
  revalidatePath("/tasks/[area]/[sub]", "page");
  return { removed: count };
}
