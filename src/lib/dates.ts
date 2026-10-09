// Every date in this app is a deadline a student reads off a clock in Ottawa, so day
// boundaries have to be computed there — not in UTC, and not in whatever zone the server
// happens to run in (Vercel runs in UTC, which would shift "today" by four or five hours).
/** The zone used when nothing better is known (and the one all accounts had before). */
export const APP_TIMEZONE = "America/Toronto";

/**
 * Whose clock dates are read on: the signed-in user's own time zone. The server plugs in a
 * per-request resolver (src/server/zone.ts); the browser sets it once from the user's
 * settings. Every helper below defaults to it, so callers need not pass it around.
 */
let zoneResolver: (() => string | null | undefined) | null = null;
let clientZone: string | null = null;

export function setZoneResolver(fn: () => string | null | undefined) {
  zoneResolver = fn;
}

/** Browser only: the user's zone, set from their settings when the app loads. */
export function setClientZone(tz: string) {
  if (typeof window !== "undefined") clientZone = tz;
}

export function currentZone(): string {
  if (typeof window !== "undefined") return clientZone ?? APP_TIMEZONE;
  try {
    return zoneResolver?.() || APP_TIMEZONE;
  } catch {
    return APP_TIMEZONE;
  }
}

export type WallTime = [year: number, month: number, day: number, hour: number, minute: number, second: number];

interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zoneParts(date: Date, timeZone: string): ZoneParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // Some ICU builds render midnight as hour 24.
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

function offsetMs(utcMs: number, timeZone: string): number {
  try {
    const p = zoneParts(new Date(utcMs), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
  } catch {
    return 0;
  }
}

/** Resolve a wall-clock reading in `timeZone` to the UTC instant it names. */
export function wallTimeToUtc(wall: WallTime, timeZone: string = currentZone()): Date {
  const [year, month, day, hour, minute, second] = wall;
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstPass = naive - offsetMs(naive, timeZone);
  // Re-read the offset at the candidate instant so DST transitions land on the right side.
  return new Date(naive - offsetMs(firstPass, timeZone));
}

/** Midnight at the start of `reference`'s day in `timeZone`, as a UTC instant. */
export function startOfDay(reference: Date = new Date(), timeZone: string = currentZone()): Date {
  const p = zoneParts(reference, timeZone);
  return wallTimeToUtc([p.year, p.month, p.day, 0, 0, 0], timeZone);
}

/** Shift by whole calendar days, so a day across a DST change is still one day. */
export function addDays(date: Date, days: number, timeZone: string = currentZone()): Date {
  const p = zoneParts(date, timeZone);
  return wallTimeToUtc([p.year, p.month, p.day + days, p.hour, p.minute, p.second], timeZone);
}

export function dayName(reference: Date = new Date(), timeZone: string = currentZone()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(reference);
}

/** "2026-10-09" — the calendar date in `timeZone`, not in UTC. */
export function toISODate(reference: Date = new Date(), timeZone: string = currentZone()): string {
  const p = zoneParts(reference, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Midnight of an ISO date in `timeZone`. Returns null when the string is malformed. */
export function fromISODate(value: string, timeZone: string = currentZone()): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = wallTimeToUtc([+m[1], +m[2], +m[3], 0, 0, 0], timeZone);
  // Reject the likes of 2026-02-31, which Date.UTC would quietly roll forward.
  return toISODate(date, timeZone) === value ? date : null;
}

/** Monday 00:00 of the week containing `reference`. */
export function startOfWeek(reference: Date = new Date(), timeZone: string = currentZone()): Date {
  const index = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    .indexOf(dayName(reference, timeZone));
  return addDays(startOfDay(reference, timeZone), -Math.max(index, 0), timeZone);
}

/** The 1st of the month at 00:00. */
export function startOfMonth(reference: Date = new Date(), timeZone: string = currentZone()): Date {
  const p = zoneParts(reference, timeZone);
  return wallTimeToUtc([p.year, p.month, 1, 0, 0, 0], timeZone);
}

export function addMonths(reference: Date, months: number, timeZone: string = currentZone()): Date {
  const p = zoneParts(reference, timeZone);
  return wallTimeToUtc([p.year, p.month + months, 1, 0, 0, 0], timeZone);
}

export function formatLongDate(reference: Date = new Date(), timeZone: string = currentZone()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(reference);
}
