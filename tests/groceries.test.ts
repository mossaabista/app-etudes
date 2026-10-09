import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));

import { addGroceriesAction, removeGroceriesAction } from "@/server/actions/nutrition.actions";

const rows = () => (db.trackerEntry as ReturnType<typeof table>).rows;

beforeEach(() => {
  db.trackerEntry = table([
    { id: "a1", userId: "alice", module: "quotidien:courses", kind: "item", text: "Pomme", done: false, data: {} },
    { id: "b1", userId: "bob", module: "quotidien:courses", kind: "item", text: "Brocoli", done: false, data: {} },
  ]);
  db.$transaction = (ops: Promise<unknown>[]) => Promise.all(ops);
});

describe("groceries from a menu", () => {
  it("adds known foods once, with quantities and aisles from the food table", async () => {
    const r = await addGroceriesAction([
      { food: "pomme", grams: 300 },
      { food: "brocoli", grams: 1200 },
      { food: "plutonium", grams: 5 },
      { food: "riz", grams: -2 },
    ]);
    expect(r).toMatchObject({ ok: true, added: 1, skipped: 1 });
    expect(rows().filter((x) => x.userId === "alice").map((x) => x.text)).toEqual(["Pomme", "Brocoli — 1,2 kg"]);
    expect(rows().find((x) => x.text === "Brocoli — 1,2 kg")).toMatchObject({ data: { aisle: "Fruits & légumes" } });
  });

  it("takes back only what it added, never the user's own items or another user's", async () => {
    const r = await addGroceriesAction([{ food: "riz", grams: 450 }]);
    if (!("ok" in r)) throw new Error("expected ok");
    expect(await removeGroceriesAction([...r.ids, "b1", "a1"])).toEqual({ removed: 1 });
    expect(rows().map((x) => x.id)).toEqual(["a1", "b1"]);
  });

  it("refuses an empty request", async () => {
    expect(await addGroceriesAction([])).toEqual({ error: "Rien à ajouter." });
  });
});
