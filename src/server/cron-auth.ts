import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuth = "ok" | "unconfigured" | "unauthorized";

/** Vercel sends `Authorization: Bearer $CRON_SECRET` on every scheduled invocation. */
export function checkCronAuth(request: Request): CronAuth {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "unconfigured";

  const provided = request.headers.get("authorization") ?? "";
  return secretsMatch(provided, `Bearer ${secret}`) ? "ok" : "unauthorized";
}

// Hashing first gives both sides a fixed length, so the comparison stays
// constant-time regardless of how long the supplied header is.
function secretsMatch(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
