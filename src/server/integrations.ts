import { prisma } from "@/lib/db";
import { pushIsConfigured } from "@/server/notifications/push";

/**
 * What OROM is connected to, as it really is. Every state comes from configuration or
 * from the last real attempt: nothing is shown as connected that has not been set up.
 */

export type IntegrationState = "connected" | "not_configured" | "failed" | "device" | "available";

export interface Integration {
  key: string;
  name: string;
  state: IntegrationState;
  detail: string;
}

export async function integrationStatus(userId: string): Promise<Integration[]> {
  const [devices, sources] = await Promise.all([
    prisma.pushSubscription.count({ where: { userId } }),
    prisma.syncSource.findMany({ where: { userId }, select: { provider: true, active: true, lastSyncedAt: true, lastStatus: true, lastMessage: true } }),
  ]);
  const when = (d: Date) => new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
  const list: Integration[] = [
    process.env.ANTHROPIC_API_KEY
      ? { key: "ai", name: "Assistant intelligent (Claude, Anthropic)", state: "connected", detail: `Configuré sur le serveur (modèle ${process.env.ASSISTANT_MODEL || "par défaut"}). Les demandes et le contexte nécessaire y sont envoyés.` }
      : { key: "ai", name: "Assistant intelligent (Claude, Anthropic)", state: "not_configured", detail: "Pas de clé ANTHROPIC_API_KEY : les commandes simples marchent sans, les résumés et réponses rédigées non." },
    !pushIsConfigured()
      ? { key: "push", name: "Notifications", state: "not_configured", detail: "Clés VAPID absentes sur le serveur : aucune notification ne peut partir." }
      : devices
        ? { key: "push", name: "Notifications", state: "connected", detail: `${devices} appareil${devices > 1 ? "s" : ""} abonné${devices > 1 ? "s" : ""}.` }
        : { key: "push", name: "Notifications", state: "available", detail: "Prêtes côté serveur ; active-les sur cet appareil ci-dessous." },
    { key: "voice", name: "Dictée et voix", state: "device", detail: "Fournies par ton navigateur (Web Speech) : disponibles selon l'appareil, rien à connecter." },
    { key: "documents", name: "Documents", state: "connected", detail: "Stockés avec ton compte dans la base de l'application ; aucun service externe." },
  ];
  const lms = sources.find((s) => s.provider === "brightspace");
  list.push(
    !lms
      ? { key: "brightspace", name: "Calendrier de cours (Brightspace, iCal)", state: "not_configured", detail: "Aucun flux ajouté (page Synchro)." }
      : lms.lastStatus === "error"
        ? { key: "brightspace", name: "Calendrier de cours (Brightspace, iCal)", state: "failed", detail: `Dernière synchro en échec${lms.lastSyncedAt ? ` (${when(lms.lastSyncedAt)})` : ""}${lms.lastMessage ? ` : ${lms.lastMessage.slice(0, 140)}` : ""}.` }
        : { key: "brightspace", name: "Calendrier de cours (Brightspace, iCal)", state: lms.lastSyncedAt ? "connected" : "available", detail: lms.lastSyncedAt ? `Synchronisé le ${when(lms.lastSyncedAt)}${lms.active ? "" : " (en pause)"}.` : "Flux ajouté, jamais synchronisé." }
  );
  list.push(
    { key: "google", name: "Google Agenda, Outlook", state: "not_configured", detail: "Pas encore disponible : aucune connexion n'est proposée ni simulée." },
    { key: "email", name: "Courriel", state: "not_configured", detail: "Pas disponible : OROM n'envoie et ne lit aucun courriel." }
  );
  return list;
}
