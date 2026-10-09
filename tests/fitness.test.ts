import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));

import { addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { SPORT_TYPE, WORKOUT_NOTE, pickWorkoutSlots, sanitizeWorkoutOpts, scheduleWorkouts, slotIn, type WorkoutDay } from "@/server/fitness";

const LIMITS = { dayStart: 8 * 60, dayEnd: 22 * 60 };
const day = (date: string, p: Partial<WorkoutDay> = {}): WorkoutDay => ({ date, busy: [], rest: false, hasWorkout: false, earliest: LIMITS.dayStart, ...p });
const week = (p: (i: number) => Partial<WorkoutDay> = () => ({})) => Array.from({ length: 7 }, (_, i) => day(`2026-10-${12 + i}`, p(i)));

describe("workout slots", () => {
  it("prefers the evening, after the meal hour when the late afternoon is busy", () => {
    expect(slotIn(day("2026-10-12"), 60, "libre", LIMITS.dayStart, LIMITS.dayEnd)).toBe(16 * 60 + 30);
    const busy = day("2026-10-12", { busy: [[16 * 60, 18 * 60 + 40]] });
    expect(slotIn(busy, 60, "soir", LIMITS.dayStart, LIMITS.dayEnd)).toBe(19 * 60 + 30);
    expect(slotIn(busy, 60, "matin", LIMITS.dayStart, LIMITS.dayEnd)).toBe(8 * 60);
  });

  it("never starts in the past or overlaps a class", () => {
    const d = day("2026-10-12", { earliest: 10 * 60, busy: [[10 * 60, 11 * 60 + 40]] });
    expect(slotIn(d, 60, "matin", LIMITS.dayStart, LIMITS.dayEnd)).toBeNull();
    expect(slotIn(d, 30, "matin", LIMITS.dayStart, LIMITS.dayEnd)).toBeNull();
    expect(slotIn(d, 15, "matin", LIMITS.dayStart, LIMITS.dayEnd)).toBe(11 * 60 + 40);
  });

  it("spreads sessions with a rest day between them", () => {
    const { slots, full } = pickWorkoutSlots(week(), { count: 3, minutes: 60, when: "soir" }, LIMITS);
    expect(slots.map((s) => s.date)).toEqual(["2026-10-12", "2026-10-14", "2026-10-16"]);
    expect(slots[0]).toMatchObject({ start: "16:30", end: "17:30" });
    expect(full).toBe(false);
  });

  it("skips rest days and days that already have a workout, and says when the week is full", () => {
    const w = week((i) => ({ rest: i === 0 || i === 6, hasWorkout: i === 2, busy: i === 4 ? [[8 * 60, 22 * 60]] : [] }));
    const { slots, full } = pickWorkoutSlots(w, { count: 5, minutes: 60, when: "libre" }, LIMITS);
    expect(slots.map((s) => s.date)).toEqual(["2026-10-13", "2026-10-15", "2026-10-17"]);
    expect(full).toBe(true);
  });

  it("clamps what it is asked", () => {
    expect(sanitizeWorkoutOpts({ count: 40, minutes: 3, when: "minuit" as never })).toEqual({ count: 7, minutes: 15, when: "libre", title: undefined });
  });
});

describe("booking workouts", () => {
  const from = toISODate(addDays(fromISODate(toISODate(new Date()))!, 1));
  beforeEach(() => {
    const d0 = fromISODate(from)!;
    db.trackerEntry = table();
    db.courseSchedule = table([{ id: "s1", day: dayName(d0), startTime: "16:00", endTime: "19:00", course: { userId: "alice" } }, { id: "s2", day: dayName(d0), startTime: "08:00", endTime: "22:00", course: { userId: "bob" } }]);
    db.calendarEvent = table([
      { id: "bob-ev", userId: "bob", title: "Réunion", type: "Personal", date: d0, startTime: "08:00", endTime: "22:00" },
      { id: "run", userId: "alice", title: "Course à pied", type: SPORT_TYPE, date: addDays(d0, 2), startTime: "07:00", endTime: "08:00" },
    ]);
  });

  it("books around this user's own commitments only, and reports what it did", async () => {
    const r = await scheduleWorkouts("alice", { count: 2, minutes: 45, when: "soir" }, from);
    expect(r.slots[0]).toMatchObject({ date: from, start: "19:30", end: "20:15" });
    expect(r.slots[1].date).not.toBe(toISODate(addDays(fromISODate(from)!, 2)));
    expect(r.message).toMatch(/^2 séances de 45 min ajoutées : .* à 19 h 30/);
    expect(r.message).toMatch(/Tu avais déjà 1 jour d'entraînement/);
    const mine = db.calendarEvent.rows.filter((e) => e.notes === WORKOUT_NOTE);
    expect(mine).toHaveLength(2);
    expect(mine.every((e) => e.userId === "alice" && e.type === SPORT_TYPE)).toBe(true);
    expect(r.ids).toEqual(mine.map((e) => e.id));
  });
});
