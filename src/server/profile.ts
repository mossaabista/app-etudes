import { cache } from "react";
import { prisma } from "@/lib/db";
import { profileOf, sanitizeProfile, type Profile } from "@/lib/profile";

/** Settings rows live with the section rows, under a module of their own. */
export const PROFILE_MODULE = "app:profile";

/**
 * The user's profile, or null if they have never picked one. Accounts from before
 * profiles existed and that already have courses are students: they keep the app exactly
 * as it was.
 */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: PROFILE_MODULE, kind: "profile" }, orderBy: { updatedAt: "desc" } });
  if (row) return sanitizeProfile(row.data);
  const courses = await prisma.course.count({ where: { userId } });
  return courses > 0 ? { type: "etudiant", roles: ["etudiant"], cards: profileOf("etudiant").cards, cardsByRole: {}, nav: { shown: [], hidden: [] } } : null;
});

/** Write the whole profile (one row per user). */
export async function saveProfile(userId: string, profile: Profile) {
  const clean = sanitizeProfile(profile);
  const data = JSON.parse(JSON.stringify({ type: clean.type, roles: clean.roles, cards: clean.cards, cardsByRole: { ...clean.cardsByRole, [clean.type]: clean.cards }, nav: clean.nav }));
  const existing = await prisma.trackerEntry.findFirst({ where: { userId, module: PROFILE_MODULE, kind: "profile" } });
  if (existing) await prisma.trackerEntry.update({ where: { id: existing.id }, data: { data } });
  else await prisma.trackerEntry.create({ data: { userId, module: PROFILE_MODULE, kind: "profile", data } });
  return clean;
}
