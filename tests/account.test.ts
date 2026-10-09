import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
const nav = vi.hoisted(() => ({ redirected: "", cleared: false }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));
vi.mock("@/server/auth/session", () => ({ clearSessionCookie: async () => void (nav.cleared = true) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => void (nav.redirected = to) }));

import { deleteAccountAction } from "@/server/actions/account.actions";
import { integrationStatus } from "@/server/integrations";

beforeEach(async () => {
  nav.redirected = "";
  nav.cleared = false;
  db.user = table([{ id: "alice", password: await bcrypt.hash("bon-mot-de-passe", 4) }, { id: "bob", password: "x" }]);
  db.pushSubscription = table();
  db.syncSource = table([{ id: "s1", userId: "alice", provider: "brightspace", active: true, lastSyncedAt: new Date(), lastStatus: "error", lastMessage: "HTTP 403" }]);
});

describe("account deletion", () => {
  it("needs the typed word and the right password, and deletes nothing otherwise", async () => {
    expect(await deleteAccountAction({ password: "bon-mot-de-passe", confirm: "oui" })).toEqual({ error: "Tape SUPPRIMER pour confirmer." });
    expect(await deleteAccountAction({ password: "faux", confirm: "SUPPRIMER" })).toEqual({ error: "Mot de passe incorrect : rien n'a été supprimé." });
    expect(db.user.rows).toHaveLength(2);
    expect(nav.cleared).toBe(false);
  });

  it("deletes only the signed-in user, signs out and says so", async () => {
    await deleteAccountAction({ password: "bon-mot-de-passe", confirm: " SUPPRIMER " });
    expect(db.user.rows.map((u) => u.id)).toEqual(["bob"]);
    expect(nav.cleared).toBe(true);
    expect(nav.redirected).toBe("/login?compte=supprime");
  });
});

describe("integration status", () => {
  it("reports what is really configured, and failures as failures", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const list = await integrationStatus("alice");
    process.env.ANTHROPIC_API_KEY = key;
    const by = Object.fromEntries(list.map((i) => [i.key, i]));
    expect(by.ai.state).toBe("not_configured");
    expect(by.push.state).toBe("not_configured");
    expect(by.brightspace).toMatchObject({ state: "failed", detail: expect.stringMatching(/HTTP 403/) });
    expect(by.google.state).toBe("not_configured");
    expect(list.filter((i) => i.state === "connected").map((i) => i.key)).toEqual(["documents"]);
  });
});
