import { cache } from "react";
import { prisma } from "@/lib/db";
import { layoutForRoles, sanitizeLayout, type AreaSpec, type Layout } from "@/lib/layout";
import { getProfile } from "@/server/profile";

export const LAYOUT_MODULE = "app:layout";

/** The user's sectors: their own if they changed anything, otherwise their roles' set. */
export const getLayout = cache(async (userId: string): Promise<Layout> => {
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: LAYOUT_MODULE, kind: "layout" }, orderBy: { updatedAt: "desc" } });
  const own = row ? sanitizeLayout(row.data) : null;
  if (own) return own;
  const profile = await getProfile(userId);
  return layoutForRoles(profile?.type ?? "etudiant", profile?.roles ?? ["etudiant"]);
});

export async function saveLayout(userId: string, layout: Layout) {
  const clean = sanitizeLayout(layout);
  if (!clean) throw new Error("Disposition invalide.");
  const data = JSON.parse(JSON.stringify(clean));
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: LAYOUT_MODULE, kind: "layout" } });
  if (row) await prisma.trackerEntry.update({ where: { id: row.id }, data: { data } });
  else await prisma.trackerEntry.create({ data: { userId, module: LAYOUT_MODULE, kind: "layout", data } });
  return clean;
}

export const findArea = (layout: Layout, key: string): AreaSpec | undefined => layout.areas.find((a) => a.key === key);
