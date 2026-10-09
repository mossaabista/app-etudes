/**
 * The user's limits for anything the app plans for them: when the day starts and ends,
 * how much focused work a day can hold, how long a stretch lasts before a break, the
 * margin kept around appointments, and the days left free. The defaults are the values
 * the Pilot always used, so nothing changes for anyone who never opens these settings.
 */

export interface PlanningPrefs {
  /** Minutes after midnight. */
  dayStart: number;
  dayEnd: number;
  /** Most focused work planned in a day, in minutes. */
  focusCap: number;
  /** Longest stretch before a break, and the break. */
  streak: number;
  breakMin: number;
  /** Kept free before and after every class or appointment. */
  buffer: number;
  /** Days nothing is planned on ("Saturday", "Sunday"…). */
  restDays: string[];
}

export const DEFAULT_PLANNING: PlanningPrefs = { dayStart: 8 * 60, dayEnd: 22 * 60, focusCap: 6 * 60, streak: 90, breakMin: 15, buffer: 10, restDays: [] };

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const WEEKDAY_FR: Record<string, string> = { Monday: "Lundi", Tuesday: "Mardi", Wednesday: "Mercredi", Thursday: "Jeudi", Friday: "Vendredi", Saturday: "Samedi", Sunday: "Dimanche" };

const clamp = (v: unknown, min: number, max: number, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback);

/** Read stored or submitted preferences: anything out of range falls back or is clamped. */
export function sanitizePlanning(raw: unknown): PlanningPrefs {
  const r = (raw ?? {}) as Partial<Record<keyof PlanningPrefs, unknown>>;
  const d = DEFAULT_PLANNING;
  const dayStart = clamp(r.dayStart, 5 * 60, 14 * 60, d.dayStart);
  let dayEnd = clamp(r.dayEnd, 12 * 60, 24 * 60, d.dayEnd);
  if (dayEnd - dayStart < 4 * 60) dayEnd = Math.min(24 * 60, dayStart + 4 * 60);
  const restDays = Array.isArray(r.restDays) ? [...new Set(r.restDays.filter((x): x is string => (WEEKDAYS as readonly string[]).includes(x as string)))] : [];
  return {
    dayStart,
    dayEnd,
    focusCap: clamp(r.focusCap, 60, 12 * 60, d.focusCap),
    streak: clamp(r.streak, 25, 240, d.streak),
    breakMin: clamp(r.breakMin, 5, 60, d.breakMin),
    buffer: clamp(r.buffer, 0, 60, d.buffer),
    // A week with no day left to plan on is not a week.
    restDays: restDays.length >= 7 ? [] : restDays,
  };
}

export const hm = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
