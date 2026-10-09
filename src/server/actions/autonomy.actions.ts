"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { saveAutonomy } from "@/server/autonomy";
import type { Autonomy } from "@/lib/risk";

/** Set how much the assistant may do without asking. Unknown values fall back to the default. */
export async function saveAutonomyAction(input: Autonomy) {
  const user = await requireUser();
  try {
    const saved = await saveAutonomy(user.id, input);
    revalidatePath("/settings");
    return { ok: true as const, saved };
  } catch {
    return { error: "Impossible d'enregistrer ce réglage." };
  }
}
