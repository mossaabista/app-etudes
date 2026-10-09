import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import { addDays, dayName, fromISODate, toISODate, wallTimeToUtc } from "@/lib/dates";
import { DEFAULT_PLANNING, sanitizePlanning } from "@/lib/planning-prefs";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { PILOT_NOTE, planDay, planWeek } from "@/server/pilot";

const today = toISODate(new Date());
const tomorrow = toISODate(addDays(fromISODate(today)!, 1));
const at = (iso: string, hh: number, mm = 0) => {
  const [y, m, d] = iso.split("-").map(Number);
  return wallTimeToUtc([y, m, d, hh, mm, 0]);
};
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

beforeEach(() => {
  db.trackerEntry = table();
  db.courseSchedule = table([{ id: "s1", courseId: "c1", course: { userId: "alice" }, day: dayName(fromISODate(tomorrow)!), startTime: "10:00", endTime: "12:00" }]);
  db.calendarEvent = table([{ id: "e1", userId: "alice", title: "Dentiste", date: fromISODate(tomorrow)!, startTime: "14:00", endTime: "15:00", notes: null }]);
  db.task = table([
    { id: "t1", userId: "alice", parentId: null, status: "ToDo", title: "Rapport de labo", dueDate: at(toISODate(addDays(fromISODate(tomorrow)!, 2)), 23, 59), priority: "High", estimatedTime: 90, category: "travail:livrables" },
  ]);
  db.assessment = table();
  db.labSession = table();
});

describe("sanitizePlanning", () => {
  it("keeps sensible limits", () => {
    expect(sanitizePlanning(undefined)).toEqual(DEFAULT_PLANNING);
    expect(sanitizePlanning({ dayStart: 2 * 60, dayEnd: 9 * 60, focusCap: 9999, restDays: ["Sunday", "Funday", "Sunday"] })).toMatchObject({ dayStart: 5 * 60, dayEnd: 12 * 60, focusCap: 12 * 60, restDays: ["Sunday"] });
    expect(sanitizePlanning({ restDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] }).restDays).toEqual([]);
  });
});

describe("planDay (test E)", () => {
  it("never touches fixed commitments, keeps margins and meals free, and explains each block", async () => {
    const p = await planDay("alice", tomorrow);
    expect(p.blocks.length).toBeGreaterThan(0);
    const fixed: [number, number][] = [
      [10 * 60 - 10, 12 * 60 + 10],
      [14 * 60 - 10, 15 * 60 + 10],
      [12 * 60, 13 * 60],
      [18 * 60 + 30, 19 * 60 + 30],
    ];
    for (const b of p.blocks) {
      const span: [number, number] = [toMin(b.start), toMin(b.end)];
      expect(fixed.some((f) => overlaps(span, f))).toBe(false);
      expect(span[0]).toBeGreaterThanOrEqual(8 * 60);
      expect(span[1]).toBeLessThanOrEqual(22 * 60);
      expect(b.why).toBeTruthy();
    }
    // The fixed rows are untouched: the Pilot only proposes.
    expect(db.calendarEvent.rows).toHaveLength(1);
  });

  it("follows the user's limits: start of day and rest days", async () => {
    db.trackerEntry.rows.push({ id: "p", userId: "alice", module: "app:planning", kind: "prefs", data: { ...DEFAULT_PLANNING, dayStart: 13 * 60 } });
    const p = await planDay("alice", tomorrow);
    expect(p.blocks.every((b) => toMin(b.start) >= 13 * 60)).toBe(true);

    db.trackerEntry.rows[0].data = { ...DEFAULT_PLANNING, restDays: [dayName(fromISODate(tomorrow)!)] };
    expect(await planDay("alice", tomorrow)).toMatchObject({ rest: true, blocks: [] });
  });

  it("names what does not fit, and why", async () => {
    // Due at 8:30, an hour and a half of work, the day starts at 8:00: impossible.
    db.task.rows.push({ id: "t2", userId: "alice", parentId: null, status: "ToDo", title: "Formulaire urgent", dueDate: at(tomorrow, 8, 30), priority: "Critical", estimatedTime: 90, category: "travail:taches" });
    const p = await planDay("alice", tomorrow);
    expect(p.blocks.map((b) => b.title)).not.toContain("Formulaire urgent");
    expect(p.unplaced).toEqual([expect.objectContaining({ title: "Formulaire urgent", reason: expect.stringMatching(/pas de créneau libre de 1 h 30 avant 8 h 15/) })]);
    expect(p.left).toBe(1);
  });

  it("caps focused work at the user's limit and says so", async () => {
    db.trackerEntry.rows.push({ id: "p", userId: "alice", module: "app:planning", kind: "prefs", data: { ...DEFAULT_PLANNING, focusCap: 60 } });
    const p = await planDay("alice", tomorrow);
    expect(p.unplaced[0]?.reason).toMatch(/limite de 1 h/);
  });
});

describe("planWeek", () => {
  it("places a task once in the week, keeps deadlines as deadlines, and plans around fixed things", async () => {
    const w = await planWeek("alice", tomorrow);
    expect(w.days).toHaveLength(7);
    const all = w.days.flatMap((d) => d.blocks.map((b) => b.title));
    expect(all.filter((t) => t === "Rapport de labo")).toHaveLength(1);
    // Nothing goes on the calendar until the week is accepted, and no deadline was turned into an event.
    expect(db.calendarEvent.rows.filter((e) => e.notes === PILOT_NOTE)).toHaveLength(0);
    expect(w.fixed).toBeGreaterThanOrEqual(2);
    expect(w.unplaced).toEqual([]);
  });
});
