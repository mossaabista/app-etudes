import { cache } from "react";
import { prisma } from "@/lib/db";
import { CARDS, LEGACY_CARDS, profileOf, type Profile, type ProfileType, type TodayCard } from "@/lib/profile";

/** Settings rows live with the section rows, under a module of their own. */
export const PROFILE_MODULE = "app:profile";

/**
 * The user's profile, or null if they have never picked one. Accounts from before
 * profiles existed and that already have courses are students: they keep the app exactly
 * as it was.
 */
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: PROFILE_MODULE, kind: "profile" }, orderBy: { updatedAt: "desc" } });
  if (row) {
    const data = (row.data ?? {}) as { type?: ProfileType; cards?: TodayCard[] };
    const type = data.type ?? "etudiant";
    const cards = [...new Set((data.cards ?? []).map((c) => LEGACY_CARDS[c] ?? c))].filter((c) => CARDS.some((x) => x.key === c));
    return { type, cards: cards.length ? cards : profileOf(type).cards };
  }
  const courses = await prisma.course.count({ where: { userId } });
  return courses > 0 ? { type: "etudiant", cards: profileOf("etudiant").cards } : null;
});
