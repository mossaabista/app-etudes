/**
 * A small per-user limit on expensive calls (language model, document reading), so one
 * account cannot run up the provider bill. In memory: it holds per server instance, which
 * is enough to stop a runaway loop; a shared store (Redis) would be needed for a hard
 * global quota across instances.
 */

const WINDOW_MS = 60_000;
const LIMITS: Record<string, number> = { llm: 20, command: 40 };
const hits = new Map<string, number[]>();

export function allow(userId: string, kind: keyof typeof LIMITS | string, now = Date.now()): boolean {
  const limit = LIMITS[kind] ?? 30;
  const key = `${kind}:${userId}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Keep the map from growing without bound.
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return true;
}
