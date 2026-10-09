"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { LAYOUT_MODULE, saveLayout } from "@/server/layout";
import type { Layout } from "@/lib/layout";

/** Save the sectors as edited on the Secteurs page. */
export async function saveLayoutAction(layout: Layout) {
  const user = await requireUser();
  try {
    await saveLayout(user.id, layout);
  } catch {
    return { error: "Impossible d'enregistrer cette disposition." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Back to the profile's ready-made sectors. Nothing filed in them is touched. */
export async function resetLayoutAction() {
  const user = await requireUser();
  await prisma.trackerEntry.deleteMany({ where: { userId: user.id, module: LAYOUT_MODULE, kind: "layout" } });
  revalidatePath("/", "layout");
  return { ok: true };
}
