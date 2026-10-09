"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { clearSessionCookie } from "@/server/auth/session";
import { allow } from "@/server/rate-limit";
import { getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";

const DELETE_WORD = "SUPPRIMER";

/**
 * Delete the signed-in account and everything in it, for good. Only on the user's own
 * request, with their password and the word typed out; every table hangs off the user
 * with ON DELETE CASCADE, so nothing of theirs is left behind.
 */
export async function deleteAccountAction(input: { password: string; confirm: string }): Promise<{ error: string } | never> {
  const user = await requireUser();
  const t = (await getMessages()).settingsUi.deleteAccount;
  if (!allow(user.id, "command")) return { error: t.tooMany };
  if (String(input?.confirm ?? "").trim() !== DELETE_WORD) return { error: fmt(t.typeWord, { word: DELETE_WORD }) };
  const row = await prisma.user.findFirst({ where: { id: user.id }, select: { id: true, password: true } });
  if (!row || !(await bcrypt.compare(String(input?.password ?? ""), row.password))) return { error: t.wrongPassword };
  await prisma.user.delete({ where: { id: row.id } });
  await clearSessionCookie();
  redirect("/login?compte=supprime");
}
