let cache: string[] | null = null;

/** Every IANA time zone the browser knows, for the zone pickers (empty if it can't list them). */
export function timeZones(): string[] {
  if (cache) return cache;
  try {
    cache = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    cache = [];
  }
  return cache;
}
