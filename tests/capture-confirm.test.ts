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

beforeEach(() => {
  autonomy.value = { mode: "equilibre", grants: [] };
  const day = fromISODate(tomorrow)!;
  db.calendarEvent = table([
    { id: "s1", userId: "alice", title: "Sport", type: "Area:sante:sport", date: day, startTime: "10:00", endTime: "11:00", allDay: false, notes: null, courseId: null },
    { id: "s2", userId: "alice", title: "Sport", type: "Area:sante:sport", date: day, startTime: "18:00", endTime: "19:00", allDay: false, notes: null, courseId: null },
    { id: "b1", userId: "bob", title: "Sport", type: "Area:sante:sport", date: day, startTime: "10:00", endTime: "11:00", allDay: false, notes: null, courseId: null },
  ]);
  db.task = table();
});

describe("deleting through the rule-based parser", () => {
  it("asks before deleting several events, then deletes exactly those once confirmed", async () => {
    const r = await commandAction("supprime les séances de sport de demain");
    expect("confirm" in r).toBe(true);
    if (!("confirm" in r)) return;
    expect(r.confirm.risk).toBe("high");
    expect(r.confirm.items).toHaveLength(2);
    expect(db.calendarEvent.rows).toHaveLength(3);

    const done = await confirmCommandAction(r.confirm.token);
    expect(done).toMatchObject({ ok: true });
    expect(db.calendarEvent.rows.map((e) => e.id)).toEqual(["b1"]);
  });

  it("says so honestly when what was confirmed is already gone", async () => {
    const r = await commandAction("supprime les séances de sport de demain");
    if (!("confirm" in r)) throw new Error("expected a confirmation");
    db.calendarEvent.rows.splice(0, 2);
    expect(await confirmCommandAction(r.confirm.token)).toEqual({ error: expect.stringMatching(/rien n'a été supprimé/) });
  });

  it("deletes a single event straight away when the user allowed it", async () => {
    autonomy.value = { mode: "autonome", grants: ["deletes"] };
    const r = await commandAction("supprime le sport de demain à 18h");
    expect(r).toMatchObject({ ok: true });
    expect(db.calendarEvent.rows.map((e) => e.id)).toEqual(["s1", "b1"]);
  });
});
