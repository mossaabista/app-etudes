import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runSync } from "@/server/brightspace/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SyncResult =
  | { userId: string; created: number; updated: number; skipped: number }
  | { userId: string; error: string };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const provided = request.headers.get("authorization") ?? "";
  if (!secretsMatch(provided, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await prisma.syncSource.findMany({ where: { active: true } });
  const results: SyncResult[] = [];

  for (const source of sources) {
    try {
      // runSync records its own lastStatus/lastMessage on the source, success or failure.
      const plan = await runSync(source.userId, { apply: true });
      results.push({
        userId: source.userId,
        created: plan.counts.create,
        updated: plan.counts.update,
        skipped: plan.counts.skip,
      });
    } catch (error) {
      results.push({
        userId: source.userId,
        error: error instanceof Error ? error.message : "sync failed",
      });
    }
  }

  const changed = results.some((r) => "created" in r && (r.created > 0 || r.updated > 0));
  if (changed) {
    for (const path of ["/today", "/calendar", "/assessments", "/sync"]) revalidatePath(path);
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), sources: results.length, results });
}

// Hashing first gives both sides a fixed length, so the comparison stays constant-time
// regardless of how long the supplied header is.
function secretsMatch(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
