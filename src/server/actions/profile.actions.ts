"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { getProfile, saveProfile } from "@/server/profile";
import { CARDS, isProfileType, profileOf, type NavPrefs, type Profile, type ProfileType, type TodayCard } from "@/lib/profile";
import { NAV_MODULES } from "@/lib/nav";

const empty = (type: ProfileType): Profile => ({ type, roles: [type], cards: profileOf(type).cards, cardsByRole: {}, nav: { shown: [], hidden: [] } });

/**
 * Set the active role, the roles held, and the active role's Today cards. Navigation
 * choices and the cards of other roles are kept.
 */
export async function saveProfileAction(input: { type: ProfileType; cards?: TodayCard[]; roles?: ProfileType[] }) {
  const user = await requireUser();
  if (!isProfileType(input.type)) return { error: "Profil inconnu." };
  const current = (await getProfile(user.id)) ?? empty(input.type);
  const valid = new Set(CARDS.map((c) => c.key));
  const cards = (input.cards ?? current.cardsByRole[input.type] ?? profileOf(input.type).cards).filter((c) => valid.has(c)).slice(0, 5);
  const roles = [...new Set([input.type, ...(input.roles ?? current.roles).filter(isProfileType)])];
  await saveProfile(user.id, { ...current, type: input.type, roles, cards: cards.length ? cards : profileOf(input.type).cards });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Switch the active role among those the user holds. Only what is shown changes. */
export async function switchRoleAction(type: ProfileType) {
  const user = await requireUser();
  const current = await getProfile(user.id);
  if (!current || !current.roles.includes(type)) return { error: "Ce rôle n'est pas dans ton profil." };
  await saveProfile(user.id, { ...current, type, cards: current.cardsByRole[type] ?? profileOf(type).cards });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Show or hide an optional navigation module, or go back to the default for it. */
export async function setNavModuleAction(key: string, choice: "show" | "hide" | "default") {
  const user = await requireUser();
  const m = NAV_MODULES.find((x) => x.key === key);
  if (!m || m.core) return { error: "Module inconnu." };
  const current = (await getProfile(user.id)) ?? empty("etudiant");
  const nav: NavPrefs = { shown: current.nav.shown.filter((k) => k !== key), hidden: current.nav.hidden.filter((k) => k !== key) };
  if (choice === "show") nav.shown.push(key);
  if (choice === "hide") nav.hidden.push(key);
  await saveProfile(user.id, { ...current, nav });
  revalidatePath("/", "layout");
  return { ok: true };
}
