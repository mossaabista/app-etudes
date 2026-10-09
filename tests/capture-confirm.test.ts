import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import { addDays, fromISODate, toISODate } from "@/lib/dates";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
const autonomy = vi.hoisted(() => ({ value: { mode: "equilibre", grants: [] as string[] } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));
// No API key: the rule-based parser handles the sentence.
vi.mock("@/server/assistant", () => ({ assistantEnabled: () => false }));
vi.mock("@/server/assistant-run", () => ({ runAssistant: async () => null, runConfirmedPlan: async () => null }));
vi.mock("@/server/layout", () => ({ saveLayout: async () => {}, LAYOUT_MODULE: "app:layout" }));
vi.mock("@/server/briefing", () => ({ briefing: async () => "" }));
vi.mock("@/server/autonomy", () => ({ getAutonomy: async () => autonomy.value }));

import { commandAction, confirmCommandAction } from "@/server/actions/capture.actions";

const tomorrow = toISODate(addDays(fromISODate(toISODate(new Date()))!, 1));
const sport = (id: string, userId: string, start: string) => ({
  id, userId, title: "Sport", type: "Area:sante:sport", date: fromISODate(tomorrow)!, startTime: start, endTime: start, allDay: false, notes: null, courseId: null,
});
const alice = () => db.calendarEvent.rows.filter((e) => e.userId === "alice");

beforeEach(() => {
  autonomy.value = { mode: "equilibre", grants: [] };
  db.calendarEvent = table([sport("s1", "alice", "10:00"), sport("s2", "alice", "18:00"), sport("b1", "bob", "10:00")]);
  db.task = table();
});

describe("deleting through the rule-based parser", () => {
  it("deletes what was asked straight away, with an undo", async () => {
    const r = await commandAction("supprime les séances de sport de demain");
    expect(r).toMatchObject({ ok: true, undo: expect.anything() });
    expect(db.calendarEvent.rows.map((e) => e.id)).toEqual(["b1"]);
  });

  it("asks before deleting more than ten events, then deletes exactly those once confirmed", async () => {
    for (let i = 0; i < 10; i++) db.calendarEvent.rows.push(sport(`x${i}`, "alice", `0${i}:30`));
    const r = await commandAction("supprime les séances de sport de demain");
    if (!("confirm" in r)) throw new Error("expected a confirmation");
    expect(r.confirm.risk).toBe("high");
    expect(r.confirm.items).toHaveLength(12);
    expect(alice()).toHaveLength(12);

    expect(await confirmCommandAction(r.confirm.token)).toMatchObject({ ok: true });
    expect(db.calendarEvent.rows.map((e) => e.id)).toEqual(["b1"]);
  });

  it("says so honestly when what was confirmed is already gone", async () => {
    for (let i = 0; i < 10; i++) db.calendarEvent.rows.push(sport(`x${i}`, "alice", `0${i}:30`));
    const r = await commandAction("supprime les séances de sport de demain");
    if (!("confirm" in r)) throw new Error("expected a confirmation");
    const rows = db.calendarEvent.rows;
    rows.splice(0, rows.length, ...rows.filter((e) => e.userId !== "alice"));
    expect(await confirmCommandAction(r.confirm.token)).toEqual({ error: expect.stringMatching(/rien n'a été supprimé/) });
  });

  it("asks before any deletion in prudent mode", async () => {
    autonomy.value = { mode: "prudent", grants: [] };
    const r = await commandAction("supprime le sport de demain à 18h");
    expect("confirm" in r).toBe(true);
    expect(alice()).toHaveLength(2);
  });
});
