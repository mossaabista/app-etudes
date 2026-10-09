"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSessionCookie, clearSessionCookie } from "@/server/auth/session";
import { cookies } from "next/headers";
import { getLocale, getMessages } from "@/i18n/server";
import { LOCALE_COOKIE } from "@/i18n/config";
import { saveSettings, storedSettings } from "@/server/settings";

/** The account remembers its language; a new device picks it up at sign-in. */
async function syncLocale(userId: string) {
  const stored = await storedSettings(userId);
  if (stored) (await cookies()).set(LOCALE_COOKIE, stored.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  else await saveSettings(userId, { locale: await getLocale() });
}

export async function registerAction(_prev: unknown, formData: FormData) {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  const t = await getMessages();
  if (!name || !email || !password) {
    return { error: t.auth.missing };
  }
  if (password.length < 8) {
    return { error: t.auth.weakPassword };
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return { error: t.auth.emailTaken };
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
  });

  await setSessionCookie(user.id);
  await syncLocale(user.id);
  redirect("/onboarding");
}

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  const t = await getMessages();
  if (!email || !password) {
    return { error: t.auth.missing };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: t.auth.badCredentials };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { error: t.auth.badCredentials };
  }

  await setSessionCookie(user.id);
  await syncLocale(user.id);
  redirect("/today");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
