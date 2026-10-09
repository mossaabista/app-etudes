import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkCronAuth } from "@/server/cron-auth";
import { buildDailyDigest } from "@/server/notifications/digest";
import { pushIsConfigured, sendToUser } from "@/server/notifications/push";
import { runScheduledWorkflows } from "@/server/workflows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type NotifyResult =
  | { userId: string; skipped: "nothing-due" }
  | { userId: string; sent: number; removed: number; errors: string[] }
  | { userId: string; error: string };

export async function GET(request: Request) {
  const auth = checkCronAuth(request);
  if (auth === "unconfigured") {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (auth === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // The morning workflows the users authorised run first, push or not; each runs at
  // most once a day, so a repeated call does nothing more.
  let workflows: Awaited<ReturnType<typeof runScheduledWorkflows>> | { error: string };
  try {
    workflows = await runScheduledWorkflows();
  } catch {
    workflows = { error: "workflows failed" };
  }
  if (!pushIsConfigured()) {
    return NextResponse.json({ error: "VAPID keys are not configured", workflows }, { status: 500 });
  }

  // Only users with at least one device subscribed are worth building a digest for.
  const userIds = (
    await prisma.pushSubscription.findMany({
      distinct: ["userId"],
      select: { userId: true },
    })
  ).map((row) => row.userId);

  const results: NotifyResult[] = [];

  for (const userId of userIds) {
    try {
      const digest = await buildDailyDigest(userId);
      if (!digest) {
        results.push({ userId, skipped: "nothing-due" });
        continue;
      }
      const sent = await sendToUser(userId, { ...digest, tag: "daily-digest" });
      results.push({ userId, ...sent });
    } catch (error) {
      results.push({
        userId,
        error: error instanceof Error ? error.message : "digest failed",
      });
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), users: results.length, results, workflows });
}
