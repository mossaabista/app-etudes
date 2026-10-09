import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import { DEFAULT_LAYOUT, type Layout } from "@/lib/layout";

const db = vi.hoisted(() => ({}) as Record<string, unknown>);
const layoutStore = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));
vi.mock("@/server/assistant", () => ({ assistantEnabled: () => false }));
vi.mock("@/server/assistant-run", () => ({ runAssistant: async () => null, runConfirmedPlan: async () => null }));
vi.mock("@/server/layout", () => ({
  LAYOUT_MODULE: "app:layout",
  getLayout: async () => layoutStore.value,
  saveLayout: async (_u: string, l: unknown) => {
    layoutStore.value = l;
  },
}));
vi.mock("@/server/briefing", () => ({ briefing: async () => "" }));
vi.mock("@/server/autonomy", () => ({ getAutonomy: async () => ({ mode: "equilibre", grants: [] }) }));

import { commandAction, undoCommandAction } from "@/server/actions/capture.actions";

type T = ReturnType<typeof table>;
beforeEach(() => {
  db.course = table();
  db.project = table();
  db.task = table();
  db.calendarEvent = table();
  db.$transaction = async (fn: (tx: unknown) => unknown) => fn(db);
  layoutStore.value = JSON.parse(JSON.stringify(DEFAULT_LAYOUT.etudiant));
});

describe("« crée-moi un espace pour… »", () => {
  it("builds a project workspace from the sentence, and undoes all of it", async () => {
    const r = await commandAction("Crée-moi un espace pour mon nouveau projet de site web");
    if (!("ok" in r)) throw new Error(JSON.stringify(r));
    expect(r.message).toMatch(/Espace Site web prêt/);
    expect(r.navigate).toMatch(/^\/tasks\/projets\//);
    expect((db.project as T).rows).toHaveLength(1);
    expect((db.task as T).rows).toHaveLength(4);

    const undone = await undoCommandAction(r.undo!);
    expect(undone.missed).toBe(0);
    expect((db.project as T).rows).toHaveLength(0);
    expect((db.task as T).rows).toHaveLength(0);
  });

  it("asks for a name rather than inventing one", async () => {
    expect(await commandAction("crée un espace pour mon nouveau projet")).toEqual({ error: expect.stringMatching(/Donne un nom/) });
  });

  it("builds a freelance workspace with the new sector", async () => {
    const r = await commandAction("organise mon activité de freelance");
    expect(r).toMatchObject({ ok: true });
    expect((layoutStore.value as Layout).areas.map((a) => a.key)).toContain("activite");
  });

  it("leaves ordinary sentences to the usual parser", async () => {
    const r = await commandAction("appeler maman demain");
    expect(r).toMatchObject({ ok: true });
    expect((db.project as T).rows).toHaveLength(0);
  });
});
