"use client";

import { setClientZone } from "@/lib/dates";

/**
 * Gives the browser the user's own time zone. Set during render, first in the tree, so
 * every component rendered after it already reads dates on the user's clock.
 */
export function ZoneSync({ tz }: { tz: string }) {
  setClientZone(tz);
  return null;
}
