import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/dates";
import { claudeCostUsd, planLimits } from "@/lib/plans";
import { getSettings } from "@/server/settings";
import type { Usage } from "@/server/claude";

/**
 * What each user consumes in a month: the cost of Claude calls and the characters of
 * premium speech, plus a request count. Counts only — never the content. Kept in the
 * existing tracker table (one row per user, month and kind), so no migration is needed.
 */

export const USAGE_MODULE = "app:usage";
const month = () => toISODate(new Date()).slice(0, 7);

async function bump(userId: string, kind: "claude" | "tts" | "requests", by: number) {
  if (!(by > 0)) return;
  const where = { userId, module: USAGE_MODULE, kind, text: month() };
  const { count } = await prisma.trackerEntry.updateMany({ where, data: { value: { increment: by } } });
  if (!count) await prisma.trackerEntry.create({ data: { ...where, date: new Date(), value: by } });
}

/** A sink for src/server/claude.ts: adds one call's cost to the user's month. */
export const meterFor =
  (userId: string) =>
  async (u: Usage): Promise<void> => {
    try {
      await bump(userId, "claude", Math.round(claudeCostUsd(u) * 1_000_000));
    } catch {
      // The meter must never break a request.
    }
  };

export async function countRequest(userId: string) {
  await bump(userId, "requests", 1).catch(() => {});
}

export async function recordTts(userId: string, chars: number) {
  await bump(userId, "tts", chars).catch(() => {});
}

export interface MonthUsage {
  claudeUsd: number;
  ttsChars: number;
  requests: number;
  limits: ReturnType<typeof planLimits>;
  /** Over the Claude allowance: Jarvis falls back to simple commands. */
  claudeCapped: boolean;
  /** Over the voice allowance: the device's own voice takes over. */
  voiceCapped: boolean;
}

export async function monthUsage(userId: string): Promise<MonthUsage> {
  const [rows, settings] = await Promise.all([
    prisma.trackerEntry.findMany({ where: { userId, module: USAGE_MODULE, text: month() }, select: { kind: true, value: true } }),
    getSettings(userId),
  ]);
  const v = (k: string) => rows.filter((r) => r.kind === k).reduce((s, r) => s + (r.value ?? 0), 0);
  const limits = planLimits(settings.plan);
  const claudeUsd = v("claude") / 1_000_000;
  const ttsChars = v("tts");
  return { claudeUsd, ttsChars, requests: v("requests"), limits, claudeCapped: claudeUsd >= limits.claudeUsd, voiceCapped: ttsChars >= limits.ttsChars };
}
