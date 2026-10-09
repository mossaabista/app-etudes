import { prisma } from "@/lib/db";
import { pushIsConfigured } from "@/server/notifications/push";
import { fmt, INTL, type Locale } from "@/i18n/config";
import { messagesFor } from "@/i18n/messages";
import { currentZone } from "@/lib/dates";

/**
 * What Aurum is connected to, as it really is. Every state comes from configuration or
 * from the last real attempt: nothing is shown as connected that has not been set up.
 */

export type IntegrationState = "connected" | "not_configured" | "failed" | "device" | "available";

export interface Integration {
  key: string;
  name: string;
  state: IntegrationState;
  detail: string;
}

export async function integrationStatus(userId: string, locale: Locale = "fr"): Promise<Integration[]> {
  const t = messagesFor(locale).settingsUi.integrations;
  const [devices, sources] = await Promise.all([
    prisma.pushSubscription.count({ where: { userId } }),
    prisma.syncSource.findMany({ where: { userId }, select: { provider: true, active: true, lastSyncedAt: true, lastStatus: true, lastMessage: true } }),
  ]);
  const when = (d: Date) => new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
  const list: Integration[] = [
    process.env.ANTHROPIC_API_KEY
      ? { key: "ai", name: t.ai, state: "connected", detail: t.aiOn }
      : { key: "ai", name: t.ai, state: "not_configured", detail: t.aiOff },
    !pushIsConfigured()
      ? { key: "push", name: t.push, state: "not_configured", detail: t.pushOff }
      : devices
        ? { key: "push", name: t.push, state: "connected", detail: fmt(devices > 1 ? t.pushMany : t.pushOne, { n: devices }) }
        : { key: "push", name: t.push, state: "available", detail: t.pushReady },
    { key: "voice", name: t.voice, state: "device", detail: t.voiceDetail },
    { key: "documents", name: t.documents, state: "connected", detail: t.documentsDetail },
  ];
  const lms = sources.find((s) => s.provider === "brightspace");
  list.push(
    !lms
      ? { key: "brightspace", name: t.lms, state: "not_configured", detail: t.lmsNone }
      : lms.lastStatus === "error"
        ? {
            key: "brightspace",
            name: t.lms,
            state: "failed",
            detail: fmt(t.lmsFailed, {
              when: lms.lastSyncedAt ? fmt(t.lmsWhen, { when: when(lms.lastSyncedAt) }) : "",
              reason: lms.lastMessage ? fmt(t.lmsReason, { reason: lms.lastMessage.slice(0, 140) }) : "",
            }),
          }
        : {
            key: "brightspace",
            name: t.lms,
            state: lms.lastSyncedAt ? "connected" : "available",
            detail: lms.lastSyncedAt ? fmt(lms.active ? t.lmsSynced : t.lmsSyncedPaused, { when: when(lms.lastSyncedAt) }) : t.lmsNever,
          }
  );
  list.push(
    { key: "google", name: t.google, state: "not_configured", detail: t.googleDetail },
    { key: "email", name: t.email, state: "not_configured", detail: t.emailDetail }
  );
  return list;
}
