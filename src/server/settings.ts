import { cache } from "react";
import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings, type UserSettings } from "@/lib/settings";

export const SETTINGS_MODULE = "app:settings";

/** One row per user, in the existing tracker table: no migration needed. */
export const getSettings = cache(async (userId: string): Promise<UserSettings> => {
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: SETTINGS_MODULE, kind: "settings" }, select: { data: true } });
  return row ? sanitizeSettings(row.data) : DEFAULT_SETTINGS;
});

export type SettingsPatch = Parameters<typeof mergeSettings>[1];

export async function saveSettings(userId: string, patch: SettingsPatch): Promise<UserSettings> {
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: SETTINGS_MODULE, kind: "settings" }, select: { id: true, data: true } });
  const next = mergeSettings(row ? sanitizeSettings(row.data) : DEFAULT_SETTINGS, patch);
  const data = JSON.parse(JSON.stringify(next));
  if (row) await prisma.trackerEntry.update({ where: { id: row.id }, data: { data } });
  else await prisma.trackerEntry.create({ data: { userId, module: SETTINGS_MODULE, kind: "settings", data } });
  return next;
}

/** Every user's settings at once, for the morning jobs (one query, not one per user). */
export async function allSettings(): Promise<Map<string, UserSettings>> {
  const rows = await prisma.trackerEntry.findMany({ where: { module: SETTINGS_MODULE, kind: "settings" }, select: { userId: true, data: true } });
  return new Map(rows.map((r) => [r.userId, sanitizeSettings(r.data)]));
}

/** Settings if the user has ever saved any, else null (so a device's choice can seed them). */
export async function storedSettings(userId: string): Promise<UserSettings | null> {
  const row = await prisma.trackerEntry.findFirst({ where: { userId, module: SETTINGS_MODULE, kind: "settings" }, select: { data: true } });
  return row ? sanitizeSettings(row.data) : null;
}
