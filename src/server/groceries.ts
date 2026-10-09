import { prisma } from "@/lib/db";
import { FOODS, gramsLabel } from "@/lib/nutrition";

export const COURSES = "quotidien:courses";

/**
 * Put foods of the nutrition table on the user's shopping list in one go: label and
 * aisle come from the table, and a food already waiting on the list is not added twice.
 */
export async function addGroceries(userId: string, items: { food: string; grams: number }[]): Promise<{ added: number; skipped: number; ids: string[] } | { error: string }> {
  const wanted = (Array.isArray(items) ? items : []).filter((i) => i && typeof i.food === "string" && FOODS[i.food] && Number.isFinite(i.grams) && i.grams > 0).slice(0, 80);
  if (!wanted.length) return { error: "Rien à ajouter." };
  const waiting = await prisma.trackerEntry.findMany({ where: { userId, module: COURSES, kind: "item", done: false }, select: { text: true } });
  const has = (label: string) => waiting.some((w) => (w.text ?? "").toLowerCase().startsWith(label.toLowerCase()));
  const fresh = wanted.filter((i) => !has(FOODS[i.food].label));
  const rows = await prisma.$transaction(
    fresh.map((i) =>
      prisma.trackerEntry.create({
        data: { userId, module: COURSES, kind: "item", date: new Date(), text: `${FOODS[i.food].label} — ${gramsLabel(Math.round(i.grams))}`, done: false, data: { aisle: FOODS[i.food].aisle, from: "nutrition" } },
        select: { id: true },
      })
    )
  );
  return { added: rows.length, skipped: wanted.length - fresh.length, ids: rows.map((r) => r.id) };
}
