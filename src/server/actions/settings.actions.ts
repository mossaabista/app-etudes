"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { saveSettings } from "@/server/settings";
import { isTimeZone, type ReplyStyle } from "@/lib/settings";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/server";
import pkg from "../../../package.json";

const refresh = () => revalidatePath("/", "layout");

/** Name, photo, language, time zone and place: the user's own account details. */
export async function saveAccountAction(input: { name?: string; avatar?: string | null; locale?: string; timeZone?: string; city?: string | null; country?: string | null }) {
  const user = await requireUser();
  const name = typeof input?.name === "string" ? input.name.replace(/\s+/g, " ").trim().slice(0, 80) : undefined;
  if (name !== undefined && name.length > 0 && name !== user.name) await prisma.user.update({ where: { id: user.id }, data: { name } });
  await saveSettings(user.id, {
    ...(input?.avatar !== undefined ? { avatar: input.avatar } : {}),
    ...(isLocale(input?.locale) ? { locale: input.locale } : {}),
    ...(isTimeZone(input?.timeZone) ? { timeZone: input.timeZone } : {}),
    ...(input?.city !== undefined ? { city: input.city } : {}),
    ...(input?.country !== undefined ? { country: input.country } : {}),
  });
  if (isLocale(input?.locale)) (await cookies()).set(LOCALE_COOKIE, input.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
  return { ok: true as const };
}

export async function saveJarvisPrefsAction(input: { voice?: boolean; rate?: number; style?: ReplyStyle }) {
  const user = await requireUser();
  await saveSettings(user.id, { jarvis: { ...(typeof input?.voice === "boolean" ? { voice: input.voice } : {}), ...(typeof input?.rate === "number" ? { rate: input.rate } : {}), ...(input?.style ? { style: input.style } : {}) } });
  refresh();
  return { ok: true as const };
}

export async function saveNotificationPrefsAction(input: { morning?: string | null; evening?: string | null; deadlines?: boolean; muted?: string[] }) {
  const user = await requireUser();
  await saveSettings(user.id, { notifications: input ?? {} });
  refresh();
  return { ok: true as const };
}

/** A message from the user to the team: stored with the version and language, nothing else. */
export async function sendFeedbackAction(text: string, page: string) {
  const user = await requireUser();
  const t = await getMessages();
  const body = String(text ?? "").trim().slice(0, 4000);
  if (body.length < 3) return { error: t.settings.feedbackEmpty };
  await prisma.trackerEntry.create({ data: { userId: user.id, module: "app:feedback", kind: "feedback", date: new Date(), text: body, data: { version: pkg.version, page: String(page ?? "").slice(0, 120) } } });
  return { ok: true as const };
}
