"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { getCurrentUserId } from "@/server/auth/session";
import { saveSettings } from "@/server/settings";

/** Switch language: remembered on this device, and on the account when signed in. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return { error: "unsupported" };
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const userId = await getCurrentUserId();
  if (userId) await saveSettings(userId, { locale });
  return { ok: true as const };
}
