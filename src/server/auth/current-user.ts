import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "./session";
import { getSettings } from "@/server/settings";
import { openZone, setRequestZone } from "@/server/zone";

const loadUser = cache(async () => {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
});

/** The signed-in user, or null; from here on, dates in this request are on their clock. */
export async function getCurrentUser() {
  const slot = openZone();
  const user = await loadUser();
  if (user) setRequestZone(slot, (await getSettings(user.id)).timeZone);
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
