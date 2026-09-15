import webpush from "web-push";
import { prisma } from "@/lib/db";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface SendResult {
  sent: number;
  /** Subscriptions the push service reported as gone, and we deleted. */
  removed: number;
  errors: string[];
}

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Clés VAPID manquantes : NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT sont requises."
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function pushIsConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

export async function sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  configure();

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  const result: SendResult = { sent: 0, removed: 0, errors: [] };

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastSentAt: new Date() },
      });
      result.sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410 mean the push service dropped it — app deleted, or permission revoked.
      // Keeping it would fail forever, so drop our copy too.
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
        result.removed++;
      } else {
        result.errors.push(
          `${status ?? "?"}: ${error instanceof Error ? error.message : "envoi échoué"}`
        );
      }
    }
  }

  return result;
}
