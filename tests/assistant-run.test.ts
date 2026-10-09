import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import type { AssistantAction } from "@/server/assistant";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
const ask = vi.hoisted(() => ({ plan: { actions: [] as unknown[], reply: "" }, ids: [] as string[] }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/server/assistant", () => ({
  askAssistant: async () => ({ plan: ask.plan, ctx: { text: "", ids: new Set(ask.ids), assessmentIds: new Set<string>() } }),
}));
vi.mock("@/server/layout", () => ({ getLayout: async () => ({ areas: [] }), saveLayout: async () => {} }));
vi.mock("@/server/pilot", () => ({ PILOT_NOTE: "Planifié par le Pilote", planDay: async () => ({ blocks: [] }) }));
vi.mock("@/server/study", () => ({ STUDY_PREFIX: "Révision — ", planStudy: async () => ({ error: "none" }) }));

import { receipt, runAssistant } from "@/server/assistant-run";

const plan = (reply: string, ...actions: AssistantAction[]) => {
  ask.plan = { actions, reply };
};

beforeEach(() => {
  db.calendarEvent = table([{ id: "bob-ev", userId: "bob", title: "Bob's meeting", date: new Date(), startTime: "09:00", endTime: "10:00", type: "Personal" }]);
  db.task = table();
  db.course = table();
  ask.ids = [];
});

describe("runAssistant", () => {
  it("creates the event it says it created", async () => {
    plan("Séance ajoutée samedi à 10 h.", { op: "create_event", title: "Séance de sport", date: "2026-10-10", start: "10:00", end: "11:00", section: "sante:sport" });
    const r = await runAssistant("alice", "Ajoute une séance de sport samedi à 10 h pour 60 minutes", "/today", []);
    expect(r?.partial).toBe(false);
    expect(r?.message).toBe("Séance ajoutée samedi à 10 h.");
    const created = db.calendarEvent.rows.filter((e) => e.userId === "alice");
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ title: "Séance de sport", startTime: "10:00", endTime: "11:00", type: "Area:sante:sport" });
    expect(r?.undos).toEqual([{ t: "delete-event", id: created[0].id }]);
  });

  it("then moves that same event to 11 h instead of creating a second one", async () => {
    plan("", { op: "create_event", title: "Séance de sport", date: "2026-10-10", start: "10:00", end: "11:00", section: "sante:sport" });
    await runAssistant("alice", "Ajoute une séance de sport samedi à 10 h", "/today", []);
    const id = db.calendarEvent.rows.find((e) => e.userId === "alice")!.id;

    ask.ids = [`e:${id}`];
    plan("C'est décalé à 11 h.", { op: "move", id: `e:${id}`, start: "11:00" });
    const r = await runAssistant("alice", "Décale-la à 11 h", "/today", []);
    const mine = db.calendarEvent.rows.filter((e) => e.userId === "alice");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ startTime: "11:00", endTime: "12:00" });
    expect(r?.partial).toBe(false);
  });

  it("does not repeat the model's claim when the action was invalid", async () => {
    plan("J'ai ajouté ta séance samedi.", { op: "create_event", title: "Séance", date: "2026-10-10" });
    const r = await runAssistant("alice", "Ajoute une séance samedi", "/today", []);
    expect(db.calendarEvent.rows.filter((e) => e.userId === "alice")).toHaveLength(0);
    expect(r?.partial).toBe(true);
    expect(r?.message).toBe("Rien n'a été modifié. Je n'ai pas pu ajouter l'événement « Séance ».");
  });

  it("reports what worked and what did not", async () => {
    plan(
      "Tout est fait.",
      { op: "create_task", title: "Acheter du lait", date: "2026-10-10" },
      { op: "delete", id: "e:does-not-exist" }
    );
    const r = await runAssistant("alice", "…", "/today", []);
    expect(r?.partial).toBe(true);
    expect(r?.message).toMatch(/^« Acheter du lait » ajouté à tes tâches.* Je n'ai pas pu supprimer\.$/);
    expect(r?.undos).toHaveLength(1);
  });

  it("cannot reach another user's event, even with its real id", async () => {
    // The id is not among those shown to the model…
    plan("Supprimé.", { op: "delete", id: "e:bob-ev" });
    let r = await runAssistant("alice", "supprime la réunion", "/today", []);
    expect(r?.partial).toBe(true);
    // …and even if it were, the row is looked up under the signed-in user.
    ask.ids = ["e:bob-ev"];
    r = await runAssistant("alice", "supprime la réunion", "/today", []);
    expect(r?.partial).toBe(true);
    expect(db.calendarEvent.rows.find((e) => e.id === "bob-ev")).toBeDefined();
  });

  it("reports a write that throws instead of swallowing it", async () => {
    db.task.create = async () => {
      throw new Error("db down");
    };
    plan("Ajouté.", { op: "create_task", title: "Réviser" });
    const r = await runAssistant("alice", "…", "/today", []);
    expect(r?.partial).toBe(true);
    expect(r?.message).toMatch(/Je n'ai pas pu ajouter la tâche « Réviser »/);
  });

  it("ignores actions with an unknown op", async () => {
    plan("Tout effacé.", { op: "drop_database" } as unknown as AssistantAction);
    const r = await runAssistant("alice", "…", "/today", []);
    expect(r?.undos).toHaveLength(0);
    expect(r?.answer).toBe(true);
    expect(r?.message).toBe("Tout effacé.");
  });
});

describe("receipt", () => {
  it("passes an answer through", () => {
    expect(receipt("Tu as deux cours demain.", 0, [], [])).toEqual({ message: "Tu as deux cours demain.", answer: true, partial: false });
  });

  it("flags an answer that claims a change no action made", () => {
    for (const reply of ["C'est fait.", "J'ai ajouté ta séance.", "J’ai bien supprimé la réunion", "C’est noté"])
      expect(receipt(reply, 0, [], []).message).toMatch(/aucune modification n'a été enregistrée/);
  });

  it("does not flag an answer that merely mentions such words", () => {
    for (const reply of ["Tu as ajouté trois tâches hier.", "J'ai ajoutée", "Demain tu as cours à 10 h."])
      expect(receipt(reply, 0, [], []).message).toBe(reply);
  });

  it("uses the verified summary when the reply is empty or generic", () => {
    expect(receipt("ok", 1, ["« A » ajouté."], []).message).toBe("« A » ajouté.");
    expect(receipt("", 1, ["« A » ajouté."], []).message).toBe("« A » ajouté.");
  });
});
