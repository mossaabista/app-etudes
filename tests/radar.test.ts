import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import { addDays, dayName, fromISODate, toISODate, wallTimeToUtc } from "@/lib/dates";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));

import { radarText, riskRadar } from "@/server/radar";
import { PILOT_NOTE } from "@/server/pilot";

const now = new Date();
const today = toISODate(now);
const inDays = (n: number) => toISODate(addDays(fromISODate(today)!, n));
const at = (iso: string, h: number, m = 0) => {
  const [y, mo, d] = iso.split("-").map(Number);
  return wallTimeToUtc([y, mo, d, h, m, 0]);
};

beforeEach(() => {
  db.task = table([
    { id: "late", userId: "alice", parentId: null, status: "ToDo", title: "Payer le loyer", dueDate: at(inDays(-3), 23, 59), category: "quotidien:finances" },
    { id: "done", userId: "alice", parentId: null, status: "Done", title: "Déjà fait", dueDate: at(inDays(-3), 12) },
    { id: "bob", userId: "bob", parentId: null, status: "ToDo", title: "Tâche de Bob", dueDate: at(inDays(-3), 12) },
  ]);
  db.assessment = table([
    { id: "a1", userId: "alice", status: "Upcoming", title: "Mi-session", type: "Exam", weight: 30, dueDate: at(inDays(3), 10), courseId: "c1", course: { code: "CHM1711" } },
    { id: "a2", userId: "alice", status: "Upcoming", title: "Quiz 2", type: "Quiz", weight: 5, dueDate: at(inDays(4), 10), courseId: "c1", course: { code: "CHM1711" } },
    { id: "a3", userId: "alice", status: "Upcoming", title: "Examen final", type: "Exam", weight: 50, dueDate: null, courseId: "c1", course: { code: "CHM1711" } },
  ]);
  db.calendarEvent = table([
    // Study is booked for Quiz 2, not for the midterm.
    { id: "p1", userId: "alice", title: "Réviser · Quiz 2", date: fromISODate(inDays(1))!, startTime: "15:00", endTime: "16:00", notes: PILOT_NOTE },
    // An appointment on top of a class.
    { id: "e1", userId: "alice", title: "Dentiste", date: fromISODate(inDays(2))!, startTime: "10:30", endTime: "11:30", notes: null },
  ]);
  db.courseSchedule = table([{ id: "s1", course: { userId: "alice", code: "CHM1711" }, day: dayName(fromISODate(inDays(2))!), startTime: "10:00", endTime: "11:20", type: "Lecture" }]);
});

describe("riskRadar", () => {
  it("finds what is at risk, each with a reason and an action", async () => {
    const alerts = await riskRadar("alice", now);
    const by = (k: string) => alerts.filter((a) => a.kind === k);
    expect(by("overdue").map((a) => a.title)).toEqual(["Payer le loyer"]);
    expect(by("overdue")[0]).toMatchObject({ level: "high", href: "/tasks/quotidien/finances", detail: expect.stringMatching(/depuis 3 jours/) });
    expect(by("no-time").map((a) => a.title)).toEqual(["CHM1711 · Mi-session"]);
    expect(by("no-time")[0]).toMatchObject({ level: "high", href: "/courses/c1", detail: expect.stringMatching(/\(30 %\).*aucun temps/) });
    expect(by("conflict")).toHaveLength(1);
    expect(by("conflict")[0].detail).toMatch(/« Dentiste » et le cours CHM1711 se chevauchent \(10 h 30\)/);
    expect(by("undated").map((a) => a.title)).toEqual(["CHM1711 · Examen final"]);
    // Only the user's own rows.
    expect(JSON.stringify(alerts)).not.toMatch(/Bob/);
    // Most urgent first.
    expect(alerts[0].level).toBe("high");
  });

  it("flags three assessments due the same day", async () => {
    for (const t of ["Labo 4", "Devoir 3"]) db.assessment.rows.push({ id: t, userId: "alice", status: "Upcoming", title: t, type: "Assignment", weight: 5, dueDate: at(inDays(3), 23, 59), courseId: "c1", course: { code: "CHM1711" } });
    const overload = (await riskRadar("alice", now)).filter((a) => a.kind === "overload");
    expect(overload).toHaveLength(1);
    expect(overload[0].detail).toMatch(/^3 évaluations le même jour/);
  });

  it("says plainly when there is nothing to worry about", () => {
    expect(radarText([])).toMatch(/Rien ne semble à risque/);
  });
});
