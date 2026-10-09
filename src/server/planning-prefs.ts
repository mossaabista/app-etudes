import { cache } from "react";
import { prisma } from "@/lib/db";
import { DEFAULT_PLANNING, sanitizePlanning, type PlanningPrefs } from "@/lib/planning-prefs";

export const PLANNING_MODULE = "app:planning";

/** The user's planning limits; the long-standing defaults when never set. */
export const getPlanningPrefs = cache(async (userId: string): Promise<PlanningPrefs> => {
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: PLANNING_MODULE, kind: "prefs" }, orderBy: { updatedAt: "desc" } });
  return row ? sanitizePlanning(row.data) : DEFAULT_PLANNING;
});

export async function savePlanningPrefs(userId: string, input: unknown): Promise<PlanningPrefs> {
  const prefs = sanitizePlanning(input);
  const data = JSON.parse(JSON.stringify(prefs));
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: PLANNING_MODULE, kind: "prefs" } });
  if (row) await prisma.trackerEntry.update({ where: { id: row.id }, data: { data } });
  else await prisma.trackerEntry.create({ data: { userId, module: PLANNING_MODULE, kind: "prefs", data } });
  return prefs;
}
