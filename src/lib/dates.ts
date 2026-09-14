// Every date in this app is a deadline a student reads off a clock in Ottawa, so day
// boundaries have to be computed there — not in UTC, and not in whatever zone the server
// happens to run in (Vercel runs in UTC, which would shift "today" by four or five hours).
export const APP_TIMEZONE = "America/Toronto";

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
export function wallTimeToUtc(wall: WallTime, timeZone: string = APP_TIMEZONE): Date {
  const [year, month, day, hour, minute, second] = wall;
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstPass = naive - offsetMs(naive, timeZone);
  // Re-read the offset at the candidate instant so DST transitions land on the right side.
  return new Date(naive - offsetMs(firstPass, timeZone));
}

/** Midnight at the start of `reference`'s day in `timeZone`, as a UTC instant. */
export function startOfDay(reference: Date = new Date(), timeZone: string = APP_TIMEZONE): Date {
  const p = zoneParts(reference, timeZone);
  return wallTimeToUtc([p.year, p.month, p.day, 0, 0, 0], timeZone);
}

/** Shift by whole calendar days, so a day across a DST change is still one day. */
export function addDays(date: Date, days: number, timeZone: string = APP_TIMEZONE): Date {
  const p = zoneParts(date, timeZone);
  return wallTimeToUtc([p.year, p.month, p.day + days, p.hour, p.minute, p.second], timeZone);
}

export function dayName(reference: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(reference);
}

export function formatLongDate(reference: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(reference);
}
