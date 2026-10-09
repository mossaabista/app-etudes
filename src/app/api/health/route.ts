import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness and readiness for monitoring: is the app up, does the database answer. Says
 * which optional services are configured (yes / no), never any value or secret.
 */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 3000))]);
  } catch {
    database = "error";
  }
  const body = {
    status: database === "ok" ? "ok" : "degraded",
    database,
    latencyMs: Date.now() - started,
    configured: {
      assistant: !!process.env.ANTHROPIC_API_KEY,
      push: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      cron: !!process.env.CRON_SECRET,
    },
    time: new Date().toISOString(),
  };
  return NextResponse.json(body, { status: database === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } });
}
