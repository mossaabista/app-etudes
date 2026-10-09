"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/current-user";
import { addFact, deleteFact } from "@/server/memory";
import { getLocale, getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";
import { settingsUi } from "@/i18n/ns/settingsUi";

export async function addFactAction(text: string) {
  const user = await requireUser();
  const r = await addFact(user.id, String(text ?? ""));
  if ("error" in r) return { error: await translateError(r.error) };
  revalidatePath("/settings");
  return { ok: true as const, fact: { id: r.fact.id, text: r.fact.text } };
}

export async function deleteFactAction(id: string) {
  const user = await requireUser();
  const ok = await deleteFact(user.id, String(id ?? ""));
  revalidatePath("/settings");
  return ok ? { ok: true as const } : { error: (await getMessages()).settingsUi.memory.alreadyErased };
}

/** The memory store speaks French; say the same thing in the user's language. */
async function translateError(message: string): Promise<string> {
  const locale = await getLocale();
  if (locale === "fr") return message;
  const fr = settingsUi.fr.memory.errors;
  const t = settingsUi[locale].memory.errors;
  const n = /\d+/.exec(message)?.[0] ?? "";
  if (message === fr.empty) return t.empty;
  if (message === fr.known) return t.known;
  if (message === fmt(fr.tooLong, { n })) return fmt(t.tooLong, { n });
  if (message === fmt(fr.full, { n })) return fmt(t.full, { n });
  return message;
}
