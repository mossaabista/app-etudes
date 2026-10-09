"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { getProfile, saveProfile } from "@/server/profile";
import { saveSettings } from "@/server/settings";
import { isTimeZone, type About } from "@/lib/settings";
import { isProfileType, profileOf, type ProfileType } from "@/lib/profile";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { normalizeFeedUrl, runSync } from "@/server/brightspace/sync";

export interface OnboardingInput {
  locale: string;
  roles: string[];
  about: Partial<About>;
  timeZone: string;
  city: string | null;
  country: string | null;
  brightspaceUrl: string | null;
}

/**
 * Finish (or skip) onboarding: the roles set up the sectors, Today cards and agents; the
 * answers, place and language go to the user's settings; a Brightspace link is connected
 * and imported right away so Today is never empty when it can be filled. Recorded once.
 */
export async function completeOnboardingAction(input: OnboardingInput): Promise<{ ok: true; imported: number | null; importFailed: boolean }> {
  const user = await requireUser();
  const roles = [...new Set((Array.isArray(input?.roles) ? input.roles : []).filter(isProfileType))] as ProfileType[];
  const chosen: ProfileType[] = roles.length ? roles : ["personnel"];
  const active = chosen[0];
  const current = await getProfile(user.id);
  await saveProfile(user.id, {
    type: active,
    roles: chosen,
    cards: profileOf(active).cards,
    cardsByRole: current?.cardsByRole ?? {},
    nav: current?.nav ?? { shown: [], hidden: [] },
  });

  const locale = isLocale(input?.locale) ? input.locale : undefined;
  await saveSettings(user.id, {
    ...(locale ? { locale } : {}),
    ...(isTimeZone(input?.timeZone) ? { timeZone: input.timeZone } : {}),
    city: input?.city ?? null,
    country: input?.country ?? null,
    about: input?.about ?? {},
    onboardedAt: new Date().toISOString(),
  });
  if (locale) (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  let imported: number | null = null;
  let importFailed = false;
  const link = input?.brightspaceUrl?.trim();
  if (link) {
    const feed = normalizeFeedUrl(link);
    if ("url" in feed) {
      await prisma.syncSource.upsert({
        where: { userId_provider: { userId: user.id, provider: "brightspace" } },
        create: { userId: user.id, provider: "brightspace", feedUrl: feed.url },
        update: { feedUrl: feed.url, lastStatus: null, lastMessage: null },
      });
      try {
        const plan = await runSync(user.id, { apply: true });
        imported = plan.counts.create + plan.counts.update;
      } catch {
        importFailed = true;
      }
    } else importFailed = true;
  }
  revalidatePath("/", "layout");
  return { ok: true, imported, importFailed };
}
