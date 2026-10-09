import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import { addDays, fromISODate, toISODate } from "@/lib/dates";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table> | undefined>);
const autonomy = vi.hoisted(() => ({ value: { mode: "equilibre", grants: [] as string[] } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));
vi.mock("@/server/assistant", () => ({ assistantEnabled: () => false }));
vi.mock("@/server/assistant-run", () => ({ runAssistant: async () => null, runConfirmedPlan: async () => null }));
vi.mock("@/server/layout", () => ({ saveLayout: async () => {}, LAYOUT_MODULE: "app:layout" }));
vi.mock("@/server/briefing", () => ({ briefing: async () => "" }));
vi.mock("@/server/autonomy", () => ({ getAutonomy: async () => autonomy.value }));

import { commandAction, confirmCommandAction, undoCommandAction, undoLoggedAction } from "@/server/actions/capture.actions";
import { KEEP, claim, settle } from "@/server/agent-log";

const tomorrow = toISODate(addDays(fromISODate(toISODate(new Date()))!, 1));
const aliceTasks = () => db.task!.rows.filter((t) => t.userId === "alice");

beforeEach(() => {
  autonomy.value = { mode: "equilibre", grants: [] };
  db.task = table();
  db.calendarEvent = table();
  db.agentAction = table([], { unique: ["userId", "opId"] });
});

describe("with the log table", () => {
  it("runs the same submission only once", async () => {
    const first = await commandAction("appeler maman demain", { opId: "op-aaaaaaaa" });
    expect(first).toMatchObject({ ok: true });
    const again = await commandAction("appeler maman demain", { opId: "op-aaaaaaaa" });
    expect(again).toMatchObject({ ok: true, message: expect.stringMatching(/^Déjà fait/) });
    expect(aliceTasks()).toHaveLength(1);
    // A new submission of the same sentence is a new request.
    await commandAction("appeler maman demain", { opId: "op-bbbbbbbb" });
    expect(aliceTasks()).toHaveLength(2);
  });

  it("runs a confirmation only once, even if confirmed twice", async () => {
    const day = fromISODate(tomorrow)!;
    for (let i = 0; i < 11; i++)
      db.calendarEvent!.rows.push({ id: `s${i}`, userId: "alice", title: "Sport", type: "Area:sante:sport", date: day, startTime: `0${i % 10}:00`, endTime: "11:00", allDay: false, notes: null, courseId: null });
    const r = await commandAction("supprime les séances de sport de demain");
    if (!("confirm" in r)) throw new Error("expected a confirmation");
    expect(await confirmCommandAction(r.confirm.token)).toMatchObject({ ok: true, undo: expect.anything() });
    expect(await confirmCommandAction(r.confirm.token)).toMatchObject({ ok: true, message: expect.stringMatching(/^Déjà fait/), undo: null });
  });

  it("says what it changed, and undoes the last change from the server", async () => {
    await commandAction("appeler maman demain", { opId: "op-cccccccc" });
    const history = await commandAction("Qu'est-ce que tu as changé ?");
    expect(history).toMatchObject({ ok: true, answer: true, message: expect.stringMatching(/Appeler maman|appeler maman/i) });

    const undo = await commandAction("annule ta dernière action");
    expect(undo).toMatchObject({ ok: true, message: expect.stringMatching(/^J'ai annulé/) });
    expect(aliceTasks()).toHaveLength(0);
    expect(db.agentAction!.rows[0]).toMatchObject({ status: "undone" });

    expect(await commandAction("annule ta dernière action")).toEqual({ error: expect.stringMatching(/aucune modification récente/) });
    expect(await commandAction("qu'as-tu changé")).toMatchObject({ message: expect.stringMatching(/\(annulé\)/) });
  });

  it("marks a change undone from the toast's undo button", async () => {
    const r = await commandAction("appeler maman demain", { opId: "op-dddddddd" });
    if (!("ok" in r) || !r.undo) throw new Error("expected a change");
    await undoCommandAction(r.undo, "op-dddddddd");
    expect(db.agentAction!.rows[0]).toMatchObject({ status: "undone" });
  });

  it("undoes one history entry by id, only the user's own", async () => {
    await commandAction("appeler maman demain", { opId: "op-gggggggg" });
    const mine = db.agentAction!.rows[0];
    db.agentAction!.rows.push({ id: "bob-row", userId: "bob", opId: "op-bob", source: "rules", status: "done", summary: "x", undo: { t: "delete-task", id: "t" }, createdAt: new Date(), undoneAt: null });
    expect(await undoLoggedAction("bob-row")).toHaveProperty("error");
    expect(await undoLoggedAction(mine.id)).toMatchObject({ ok: true });
    expect(aliceTasks()).toHaveLength(0);
    expect(await undoLoggedAction(mine.id)).toEqual({ error: "Cette modification ne peut plus être annulée." });
  });

  it("keeps nothing for an answer or an error", async () => {
    await commandAction("supprime le dentiste de mardi", { opId: "op-eeeeeeee" });
    expect(db.agentAction!.rows).toHaveLength(0);
  });

  it("only ever reads the user's own history", async () => {
    db.agentAction!.rows.push({ id: "x", userId: "bob", opId: "op-bob", source: "rules", status: "done", summary: "Secret de Bob", undo: { t: "delete-task", id: "t" }, createdAt: new Date(), undoneAt: null });
    expect(await commandAction("qu'est-ce que tu as fait")).toMatchObject({ message: "Je n'ai encore rien modifié pour toi." });
    expect(await commandAction("annule ta dernière action")).toHaveProperty("error");
    expect(db.agentAction!.rows[0]).toMatchObject({ status: "done" });
  });

  it("keeps only the latest rows per user", async () => {
    for (let i = 0; i < KEEP + 3; i++) {
      await claim("alice", `op-${String(i).padStart(8, "0")}`, "rules");
      await settle("alice", `op-${String(i).padStart(8, "0")}`, { changed: true, summary: `n°${i}`, undo: null });
    }
    expect(db.agentAction!.rows).toHaveLength(KEEP);
    expect(db.agentAction!.rows.some((r) => r.summary === "n°0")).toBe(false);
    expect(db.agentAction!.rows.some((r) => r.summary === `n°${KEEP + 2}`)).toBe(true);
  });
});

describe("before the migration has been run", () => {
  beforeEach(() => {
    db.agentAction = undefined;
  });

  it("still carries out commands", async () => {
    expect(await commandAction("appeler maman demain", { opId: "op-ffffffff" })).toMatchObject({ ok: true });
    expect(aliceTasks()).toHaveLength(1);
  });

  it("says honestly that there is no history yet", async () => {
    expect(await commandAction("qu'est-ce que tu as changé ?")).toMatchObject({ message: expect.stringMatching(/pas encore activé/) });
    expect(await commandAction("annule ta dernière action")).toEqual({ error: expect.stringMatching(/pas encore activé/) });
  });
});
