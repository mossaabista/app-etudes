import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));

import { fromISODate } from "@/lib/dates";
import { deleteEventAction, updateEventAction } from "@/server/actions/event.actions";
import { undoCommandAction } from "@/server/actions/capture.actions";

const ev = (id: string, userId: string) => ({ id, userId, title: "Dentiste", type: "Personal", date: fromISODate("2026-10-14")!, startTime: "10:00", endTime: "11:00", allDay: false, notes: "apporter la carte", courseId: null });

beforeEach(() => {
  db.calendarEvent = table([ev("mine", "alice"), ev("bobs", "bob")]);
  db.course = table();
});

describe("editing events", () => {
  it("changes the event, and the undo puts every field back", async () => {
    const r = await updateEventAction("mine", { title: "Dentiste (déplacé)", date: "2026-10-15", start: "14:00", end: "14:30", notes: null });
    if (!("ok" in r)) throw new Error(r.error);
    expect(db.calendarEvent.rows[0]).toMatchObject({ title: "Dentiste (déplacé)", startTime: "14:00", endTime: "14:30", notes: null });
    await undoCommandAction(r.undo);
    expect(db.calendarEvent.rows[0]).toMatchObject({ title: "Dentiste", startTime: "10:00", endTime: "11:00", notes: "apporter la carte" });
    expect(db.calendarEvent.rows[0].date).toEqual(fromISODate("2026-10-14"));
  });

  it("refuses bad input and other people's events", async () => {
    const base = { title: "x", date: "2026-10-15", start: "14:00", end: "13:00", notes: null };
    expect(await updateEventAction("mine", base)).toEqual({ error: "L'heure de fin doit suivre l'heure de début." });
    expect(await updateEventAction("mine", { ...base, start: "25:00", end: null })).toEqual({ error: "Heure invalide." });
    expect(await updateEventAction("mine", { ...base, title: " " })).toMatchObject({ error: expect.any(String) });
    expect(await updateEventAction("bobs", { ...base, end: null })).toEqual({ error: "Événement introuvable." });
    expect(await deleteEventAction("bobs")).toEqual({ error: "Événement introuvable." });
    expect(db.calendarEvent.rows.find((r) => r.id === "bobs")).toMatchObject({ title: "Dentiste", startTime: "10:00" });
  });

  it("deletes, and the undo brings it back as it was", async () => {
    const r = await deleteEventAction("mine");
    if (!("ok" in r)) throw new Error(r.error);
    expect(db.calendarEvent.rows.map((x) => x.id)).toEqual(["bobs"]);
    await undoCommandAction(r.undo);
    expect(db.calendarEvent.rows.find((x) => x.userId === "alice")).toMatchObject({ title: "Dentiste", startTime: "10:00", notes: "apporter la carte" });
  });
});
