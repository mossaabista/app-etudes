import { prisma } from "@/lib/db";
import { APP_TIMEZONE, addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { getPlanningPrefs } from "@/server/planning-prefs";

/**
 * Putting the week's workouts where they fit: in free time only (around classes,
 * appointments and meals, with the usual margin), never in the past, never on a rest day
 * or a day that already has a workout, spread out so the body recovers between sessions,
 * and at the time of day the user prefers when the day allows it.
 */

export type WorkoutTime = "matin" | "midi" | "soir" | "libre";

export interface WorkoutOpts {
  count: number;
  minutes: number;
  when: WorkoutTime;
  title?: string;
}

export interface WorkoutDay {
  date: string;
  /** Busy minutes of the day, already padded with the margin. */
  busy: [number, number][];
  rest: boolean;
  hasWorkout: boolean;
  /** Nothing starts before this minute (the day's start, or now on today). */
  earliest: number;
}

export interface WorkoutSlot {
  date: string;
  start: string;
  end: string;
}

export const SPORT_TYPE = "Area:sante:sport";
export const WORKOUT_NOTE = "Séance planifiée par OROM";

const MEALS: [number, number][] = [
  [12 * 60, 13 * 60],
  [18 * 60 + 30, 19 * 60 + 30],
];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Preferred windows, in order of preference. Lunch-time sessions may use the meal hour. */
function windows(when: WorkoutTime, dayStart: number, dayEnd: number): { from: number; to: number; meals: boolean }[] {
  const morning = { from: dayStart, to: 12 * 60, meals: true };
  const lunch = { from: 11 * 60 + 30, to: 14 * 60, meals: false };
  const evening = { from: 16 * 60 + 30, to: dayEnd, meals: true };
  if (when === "matin") return [morning];
  if (when === "midi") return [lunch];
  if (when === "soir") return [evening];
  return [evening, morning, { from: dayStart, to: dayEnd, meals: true }];
}

/** The first start in a day where the session fits, or null. */
export function slotIn(day: WorkoutDay, minutes: number, when: WorkoutTime, dayStart: number, dayEnd: number): number | null {
  for (const w of windows(when, dayStart, dayEnd)) {
    const busy = [...day.busy, ...(w.meals ? MEALS : [])].sort((a, b) => a[0] - b[0]);
    let cursor = Math.max(w.from, day.earliest);
    for (const [a, b] of busy) {
      if (a - cursor >= minutes && cursor + minutes <= w.to) return cursor;
      cursor = Math.max(cursor, b);
    }
    if (cursor + minutes <= Math.min(w.to, dayEnd)) return cursor;
  }
  return null;
}

/**
 * Pick the days: first with a rest day between sessions, then, if the week is too full
 * for that, on the remaining days that still have room.
 */
export function pickWorkoutSlots(days: WorkoutDay[], opts: WorkoutOpts, limits: { dayStart: number; dayEnd: number }): { slots: WorkoutSlot[]; full: boolean } {
  const options = days
    .map((d, i) => ({ d, i, start: d.rest || d.hasWorkout ? null : slotIn(d, opts.minutes, opts.when, limits.dayStart, limits.dayEnd) }))
    .filter((x): x is { d: WorkoutDay; i: number; start: number } => x.start != null);
  const taken: typeof options = [];
  for (const gap of [2, 1]) {
    for (const o of options) {
      if (taken.length >= opts.count) break;
      if (taken.includes(o)) continue;
      if (taken.every((t) => Math.abs(t.i - o.i) >= gap)) taken.push(o);
    }
  }
  const slots = taken
    .sort((a, b) => a.i - b.i)
    .map((o) => ({ date: o.d.date, start: fmt(o.start), end: fmt(o.start + opts.minutes) }));
  return { slots, full: slots.length < opts.count };
}

export function sanitizeWorkoutOpts(o: Partial<WorkoutOpts>): WorkoutOpts {
  const n = (v: unknown, min: number, max: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d);
  return {
    count: n(o.count, 1, 7, 3),
    minutes: Math.round(n(o.minutes, 15, 180, 60) / 5) * 5,
    when: (["matin", "midi", "soir", "libre"] as const).includes(o.when as WorkoutTime) ? (o.when as WorkoutTime) : "libre",
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim().slice(0, 120) : undefined,
  };
}

const wallNow = () => toMin(new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()));

/** The seven days from `from`, as the slot picker sees them. */
export async function workoutWeek(userId: string, from: string): Promise<{ days: WorkoutDay[]; limits: { dayStart: number; dayEnd: number }; existing: number }> {
  const prefs = await getPlanningPrefs(userId);
  const today = toISODate(new Date());
  const start = fromISODate(from < today ? today : from)!;
  const end = addDays(start, 7);
  const [schedules, events] = await Promise.all([
    prisma.courseSchedule.findMany({ where: { course: { userId } }, select: { day: true, startTime: true, endTime: true } }),
    prisma.calendarEvent.findMany({ where: { userId, date: { gte: start, lt: end } }, select: { title: true, type: true, date: true, startTime: true, endTime: true } }),
  ]);
  const isWorkout = (e: { title: string; type: string | null }) => e.type === SPORT_TYPE || /\b(séance|seance|entra[iî]nement|sport|workout|muscu|gym)\b/i.test(e.title);
  let existing = 0;
  const days: WorkoutDay[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) {
    const iso = toISODate(d);
    const todays = events.filter((e) => toISODate(e.date) === iso);
    if (todays.some(isWorkout)) existing++;
    const busy: [number, number][] = [
      ...schedules.filter((s) => s.day === dayName(d)).map((s) => [toMin(s.startTime), toMin(s.endTime)] as [number, number]),
      ...todays.filter((e) => e.startTime).map((e) => [toMin(e.startTime!), toMin(e.endTime ?? fmt(toMin(e.startTime!) + 60))] as [number, number]),
    ].map(([a, b]) => [a - prefs.buffer, b + prefs.buffer]);
    days.push({
      date: iso,
      busy,
      rest: prefs.restDays.includes(dayName(d)),
      hasWorkout: todays.some(isWorkout),
      earliest: iso === today ? Math.ceil((wallNow() + 15) / 15) * 15 : prefs.dayStart,
    });
  }
  return { days, limits: { dayStart: prefs.dayStart, dayEnd: prefs.dayEnd }, existing };
}

const DAY_FR = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", timeZone: "UTC" });
const frDay = (iso: string) => DAY_FR.format(new Date(`${iso}T12:00:00Z`));
const frTime = (t: string) => t.replace(/^0/, "").replace(":00", " h").replace(":", " h ");

/** Place the sessions on the calendar. Returns what was booked, in words, and the new event ids. */
export async function scheduleWorkouts(userId: string, raw: Partial<WorkoutOpts>, from = toISODate(new Date())): Promise<{ ids: string[]; slots: WorkoutSlot[]; message: string }> {
  const opts = sanitizeWorkoutOpts(raw);
  const { days, limits, existing } = await workoutWeek(userId, from);
  const { slots, full } = pickWorkoutSlots(days, opts, limits);
  const title = opts.title ?? `Séance de sport (${opts.minutes} min)`;
  const ids: string[] = [];
  for (const s of slots) {
    const e = await prisma.calendarEvent.create({ data: { userId, title, type: SPORT_TYPE, date: fromISODate(s.date)!, startTime: s.start, endTime: s.end, allDay: false, notes: WORKOUT_NOTE } });
    ids.push(e.id);
  }
  const list = slots.map((s) => `${frDay(s.date)} à ${frTime(s.start)}`).join(", ");
  const message = !slots.length
    ? "Je n'ai trouvé aucun créneau libre assez long cette semaine : rien n'a été ajouté."
    : `${slots.length} séance${slots.length > 1 ? "s" : ""} de ${opts.minutes} min ajoutée${slots.length > 1 ? "s" : ""} : ${list}.` +
      (full ? ` Pas de place pour ${opts.count - slots.length} autre${opts.count - slots.length > 1 ? "s" : ""} sans empiéter sur tes engagements.` : "") +
      (existing ? ` Tu avais déjà ${existing} jour${existing > 1 ? "s" : ""} d'entraînement cette semaine, laissé${existing > 1 ? "s" : ""} tel${existing > 1 ? "s" : ""} quel${existing > 1 ? "s" : ""}.` : "");
  return { ids, slots, message };
}
