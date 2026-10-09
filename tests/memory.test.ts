import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));
vi.mock("@/server/assistant", () => ({ assistantEnabled: () => false }));
vi.mock("@/server/assistant-run", () => ({ runAssistant: async () => null, runConfirmedPlan: async () => null }));
vi.mock("@/server/layout", () => ({ saveLayout: async () => {}, LAYOUT_MODULE: "app:layout" }));
vi.mock("@/server/briefing", () => ({ briefing: async () => "" }));
vi.mock("@/server/autonomy", () => ({ getAutonomy: async () => ({ mode: "equilibre", grants: [] }) }));

import { commandAction, undoCommandAction } from "@/server/actions/capture.actions";
import { MAX_FACTS, listFacts } from "@/server/memory";
import { deleteFactAction } from "@/server/actions/memory.actions";

beforeEach(() => {
  db.trackerEntry = table([{ id: "bob-fact", userId: "bob", module: "app:memory", kind: "fact", text: "Bob aime le jazz", createdAt: new Date() }]);
  db.task = table();
  db.calendarEvent = table();
});

describe("assistant memory", () => {
  it("remembers only on an explicit request, and can undo it", async () => {
    const r = await commandAction("Retiens que je préfère réviser le matin.");
    expect(r).toMatchObject({ ok: true, message: expect.stringMatching(/C'est retenu : « je préfère réviser le matin »/) });
    expect((await listFacts("alice")).map((f) => f.text)).toEqual(["je préfère réviser le matin"]);
    if (!("ok" in r) || !r.undo) throw new Error("expected an undo");
    await undoCommandAction(r.undo);
    expect(await listFacts("alice")).toEqual([]);
  });

  it("logs a remembered fact, so « annule ta dernière action » takes it back", async () => {
    db.agentAction = table([], { unique: ["userId", "opId"] });
    await commandAction("retiens que je dors tôt", { opId: "op-memory01" });
    expect(db.agentAction.rows[0]).toMatchObject({ status: "done", summary: expect.stringMatching(/je dors tôt/) });
    await commandAction("annule ta dernière action");
    expect(await listFacts("alice")).toEqual([]);
    delete db.agentAction;
  });

  it("does not store an ordinary sentence", async () => {
    await commandAction("je préfère le sport le soir");
    expect(await listFacts("alice")).toEqual([]);
  });

  it("refuses duplicates and a full memory", async () => {
    await commandAction("retiens que je bois du thé");
    expect(await commandAction("Retiens que je bois du THÉ")).toEqual({ error: "Je le sais déjà." });
    for (let i = 0; i < MAX_FACTS; i++) db.trackerEntry.rows.push({ id: `f${i}`, userId: "alice", module: "app:memory", kind: "fact", text: `fait ${i}`, createdAt: new Date() });
    expect(await commandAction("retiens que j'ai un chat")).toEqual({ error: expect.stringMatching(/pleine/) });
  });

  it("tells what it remembers, forgets on request, and only ever the user's own", async () => {
    await commandAction("retiens que je préfère le sport le soir");
    expect(await commandAction("Qu'est-ce que tu sais sur moi ?")).toMatchObject({ answer: true, message: expect.stringMatching(/« je préfère le sport le soir »/) });
    expect(JSON.stringify(await commandAction("qu'est-ce que tu sais sur moi"))).not.toMatch(/jazz/);
    expect(await commandAction("oublie ce que tu sais sur le sport")).toMatchObject({ ok: true, message: expect.stringMatching(/C'est oublié/) });
    expect(await listFacts("alice")).toEqual([]);
    // Another user's fact cannot be erased by id.
    expect(await deleteFactAction("bob-fact")).toEqual({ error: "Déjà effacé." });
    expect(db.trackerEntry.rows.some((r) => r.id === "bob-fact")).toBe(true);
  });
});

describe("conversation", () => {
  it("records an exchange from the assistant page with its real outcome, and can be erased", async () => {
    const { conversationAction, clearConversationAction } = await import("@/server/actions/capture.actions");
    db.trackerEntry = table();
    await commandAction("appeler maman demain", { record: true });
    await commandAction("supprime le dentiste de mardi", { record: true });
    const turns = await conversationAction();
    expect(turns.map((t) => [t.role, t.outcome])).toEqual([
      ["user", null],
      ["assistant", "done"],
      ["user", null],
      ["assistant", "failed"],
    ]);
    // Not recorded without the flag.
    await commandAction("appeler papa demain");
    expect(await conversationAction()).toHaveLength(4);
    expect(await clearConversationAction()).toEqual({ ok: true, count: 4 });
    expect(await conversationAction()).toEqual([]);
  });
});
