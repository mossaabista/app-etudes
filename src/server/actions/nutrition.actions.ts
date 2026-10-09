"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { FOODS, gramsLabel } from "@/lib/nutrition";

const COURSES = "quotidien:courses";

/**
 * Put a menu's groceries on the shopping list in one go. Only foods of the nutrition
 * table are accepted (the label and aisle come from it, not from the browser), and a food
 * already waiting on the list is not added twice. Returns the new rows so they can be
 * taken back.
 */
export async function addGroceriesAction(items: { food: string; grams: number }[]): Promise<{ ok: true; added: number; skipped: number; ids: string[] } | { error: string }> {
  const user = await requireUser();
  const wanted = (Array.isArray(items) ? items : [])
    .filter((i) => i && typeof i.food === "string" && FOODS[i.food] && Number.isFinite(i.grams) && i.grams > 0)
    .slice(0, 80);
  if (!wanted.length) return { error: "Rien à ajouter." };
  const waiting = await prisma.trackerEntry.findMany({ where: { userId: user.id, module: COURSES, kind: "item", done: false }, select: { text: true } });
  const has = (label: string) => waiting.some((w) => (w.text ?? "").toLowerCase().startsWith(label.toLowerCase()));
  const fresh = wanted.filter((i) => !has(FOODS[i.food].label));
  const rows = await prisma.$transaction(
    fresh.map((i) =>
      prisma.trackerEntry.create({
        data: { userId: user.id, module: COURSES, kind: "item", date: new Date(), text: `${FOODS[i.food].label} — ${gramsLabel(Math.round(i.grams))}`, done: false, data: { aisle: FOODS[i.food].aisle, from: "nutrition" } },
        select: { id: true },
      })
    )
  );
  revalidatePath("/tasks/[area]/[sub]", "page");
  return { ok: true, added: rows.length, skipped: wanted.length - fresh.length, ids: rows.map((r) => r.id) };
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
