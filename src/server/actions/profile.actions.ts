"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PROFILE_MODULE } from "@/server/profile";
import { CARDS, PROFILES, profileOf, type ProfileType, type TodayCard } from "@/lib/profile";

/** Set the profile (and, optionally, a custom set of Today cards). */
export async function saveProfileAction(input: { type: ProfileType; cards?: TodayCard[] }) {
  const user = await requireUser();
  if (!PROFILES.some((p) => p.type === input.type)) return { error: "Profil inconnu." };
  const valid = new Set(CARDS.map((c) => c.key));
  const cards = (input.cards ?? profileOf(input.type).cards).filter((c) => valid.has(c)).slice(0, 5);
  const existing = await prisma.trackerEntry.findFirst({ where: { userId: user.id, module: PROFILE_MODULE, kind: "profile" } });
  const data = { type: input.type, cards: cards.length ? cards : profileOf(input.type).cards };
  if (existing) await prisma.trackerEntry.update({ where: { id: existing.id }, data: { data } });
  else await prisma.trackerEntry.create({ data: { userId: user.id, module: PROFILE_MODULE, kind: "profile", data } });
  revalidatePath("/", "layout");
  return { ok: true };
}
