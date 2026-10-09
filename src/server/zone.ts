import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { setZoneResolver } from "@/lib/dates";

/**
 * The signed-in user's time zone for the current request, so every date helper reads the
 * user's own clock. Two carriers, because Next runs code two ways:
 *  - while rendering pages, React's per-request cache (shared by every component of the render);
 *  - in server actions and route handlers, an async context opened by requireUser().
 * Background jobs, which serve many users, wrap each user's work in withZone().
 */
const store = new AsyncLocalStorage<{ tz: string | null }>();
const renderZone = cache((): { tz: string | null } => ({ tz: null }));

setZoneResolver(() => store.getStore()?.tz ?? renderZone().tz);

/** Opens a slot for this request's zone; must run before the first await of the caller. */
export function openZone(): { tz: string | null } {
  const slot = { tz: null as string | null };
  store.enterWith(slot);
  return slot;
}

export function setRequestZone(slot: { tz: string | null }, tz: string) {
  slot.tz = tz;
  renderZone().tz = tz;
}

/** Run one user's work on their clock (cron jobs, scripts). */
export function withZone<T>(tz: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ tz }, fn);
}
