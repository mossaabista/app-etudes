"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { addFact, deleteFact } from "@/server/memory";

export async function addFactAction(text: string) {
  const user = await requireUser();
  const r = await addFact(user.id, String(text ?? ""));
  if ("error" in r) return r;
  revalidatePath("/settings");
  return { ok: true as const, fact: { id: r.fact.id, text: r.fact.text } };
}

export async function deleteFactAction(id: string) {
  const user = await requireUser();
  const ok = await deleteFact(user.id, String(id ?? ""));
  revalidatePath("/settings");
  return ok ? { ok: true as const } : { error: "Déjà effacé." };
}
