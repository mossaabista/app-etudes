import { cache } from "react";
import { prisma } from "@/lib/db";
import { DEFAULT_AUTONOMY, sanitizeAutonomy, type Autonomy } from "@/lib/risk";

/** Stored with the other settings rows, under a module of its own. */
export const AUTONOMY_MODULE = "app:assistant";

/** How much the assistant may do without asking. Never set: the balanced default. */
export const getAutonomy = cache(async (userId: string): Promise<Autonomy> => {
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: AUTONOMY_MODULE, kind: "autonomy" }, orderBy: { updatedAt: "desc" } });
  return row ? sanitizeAutonomy(row.data) : DEFAULT_AUTONOMY;
});

export async function saveAutonomy(userId: string, input: unknown): Promise<Autonomy> {
  const data = sanitizeAutonomy(input);
  const json = JSON.parse(JSON.stringify(data));
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: AUTONOMY_MODULE, kind: "autonomy" } });
  if (row) await prisma.trackerEntry.update({ where: { id: row.id }, data: { data: json } });
  else await prisma.trackerEntry.create({ data: { userId, module: AUTONOMY_MODULE, kind: "autonomy", data: json } });
  return data;
}
