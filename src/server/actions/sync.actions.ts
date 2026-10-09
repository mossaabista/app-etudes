"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { getMessages } from "@/i18n/server";
import { normalizeFeedUrl, runSync, type SyncPlan } from "@/server/brightspace/sync";

export type SyncState = {
  error?: string;
  success?: string;
  plan?: SyncPlan;
} | null;

export async function saveFeedUrl(_prev: SyncState, formData: FormData): Promise<SyncState> {
  const user = await requireUser();
  const t = await getMessages();
  const result = normalizeFeedUrl(String(formData.get("feedUrl") ?? ""));
  if ("error" in result) return { error: t.connections.badLink };

  await prisma.syncSource.upsert({
    where: { userId_provider: { userId: user.id, provider: "brightspace" } },
    create: { userId: user.id, provider: "brightspace", feedUrl: result.url },
    update: { feedUrl: result.url, lastStatus: null, lastMessage: null },
  });

  revalidatePath("/sync");
  return { success: t.connections.linkSaved };
}

export async function removeFeed(): Promise<void> {
  const user = await requireUser();
  await prisma.syncSource.deleteMany({ where: { userId: user.id, provider: "brightspace" } });
  revalidatePath("/sync");
}

export async function previewSync(_prev: SyncState, _formData: FormData): Promise<SyncState> {
  const user = await requireUser();
  try {
    const plan = await runSync(user.id, { apply: false });
    return { plan };
  } catch (error) {
    console.warn("[sync] échec :", error instanceof Error ? error.message.split("\n")[0] : "inconnu");
    return { error: (await getMessages()).connections.unreachable };
  }
}

export async function applySync(_prev: SyncState, _formData: FormData): Promise<SyncState> {
  const user = await requireUser();
  try {
    const plan = await runSync(user.id, { apply: true });
    for (const path of ["/sync", "/today", "/calendar", "/assessments"]) revalidatePath(path);
    return {
      plan,
      success: (await getMessages()).connections.appliedTitle,
    };
  } catch (error) {
    console.warn("[sync] échec :", error instanceof Error ? error.message.split("\n")[0] : "inconnu");
    return { error: (await getMessages()).connections.unreachable };
  }
}
