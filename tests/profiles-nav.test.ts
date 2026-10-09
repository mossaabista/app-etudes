import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import { sanitizeProfile } from "@/lib/profile";
import { activeKey, mobileNav, navKeys, type NavContext } from "@/lib/nav";
import { DEFAULT_LAYOUT, layoutForRoles } from "@/lib/layout";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

import { saveProfileAction, setNavModuleAction, switchRoleAction } from "@/server/actions/profile.actions";
import { getProfile } from "@/server/profile";

const ctx = (over: Partial<NavContext> = {}): NavContext => ({ roles: ["etudiant"], prefs: { shown: [], hidden: [] }, counts: { courses: 0, projects: 0 }, areas: ["sante"], ...over });

describe("sanitizeProfile", () => {
  it("reads a row from before roles existed", () => {
    expect(sanitizeProfile({ type: "pro", cards: ["reunions", "agenda"] })).toEqual({
      type: "pro",
      roles: ["pro"],
      cards: ["reunions", "journee"],
      cardsByRole: { pro: ["reunions", "journee"] },
      nav: { shown: [], hidden: [] },
    });
  });

  it("drops unknown roles and keeps the active one among the roles", () => {
    expect(sanitizeProfile({ type: "sportif", roles: ["etudiant", "pirate"] }).roles).toEqual(["sportif", "etudiant"]);
    expect(sanitizeProfile(null).type).toBe("etudiant");
  });
});

describe("navigation", () => {
  it("gives each role its modules", () => {
    expect(navKeys(ctx())).toEqual(["today", "assistant", "calendar", "courses", "sectors", "settings"]);
    expect(navKeys(ctx({ roles: ["pro"] }))).toEqual(["today", "assistant", "calendar", "projects", "sectors", "settings"]);
    expect(navKeys(ctx({ roles: ["sportif"] }))).toEqual(["today", "assistant", "calendar", "training", "sectors", "settings"]);
    expect(navKeys(ctx({ roles: ["personnel"] }))).toEqual(["today", "assistant", "calendar", "sectors", "settings"]);
  });

  it("switching to Professionnel keeps existing courses reachable (test F)", () => {
    expect(navKeys(ctx({ roles: ["pro"], counts: { courses: 4, projects: 0 } }))).toEqual(["today", "assistant", "calendar", "courses", "projects", "sectors", "settings"]);
  });

  it("lets the user's own choice win, never over the core entries", () => {
    expect(navKeys(ctx({ prefs: { shown: ["projects"], hidden: ["courses", "today"] } }))).toEqual(["today", "assistant", "calendar", "projects", "sectors", "settings"]);
  });

  it("does not offer Training without a health sector", () => {
    expect(navKeys(ctx({ roles: ["sportif"], areas: [], prefs: { shown: ["training"], hidden: [] } }))).not.toContain("training");
  });

  it("lights the most specific entry", () => {
    const withProjects = navKeys(ctx({ roles: ["pro"] }));
    expect(activeKey(withProjects, "/projects/abc")).toBe("projects");
    expect(activeKey(navKeys(ctx()), "/projects/abc")).toBe("sectors");
    expect(activeKey(navKeys(ctx()), "/assessments/new")).toBe("courses");
    expect(activeKey(navKeys(ctx({ roles: ["sportif"] })), "/tasks/sante/sport")).toBe("training");
    expect(activeKey(navKeys(ctx({ roles: ["sportif"] })), "/tasks/sante/nutrition")).toBe("sectors");
  });

  it("keeps four tabs on a phone, sectors included", () => {
    const keys = navKeys(ctx({ roles: ["pro"], counts: { courses: 2, projects: 1 } }));
    expect(mobileNav(keys).map((m) => m.key)).toEqual(["today", "calendar", "courses", "sectors"]);
  });
});

describe("layoutForRoles", () => {
  it("adds what other roles bring without duplicating", () => {
    const l = layoutForRoles("sportif", ["sportif", "freelance"]);
    const keys = l.areas.map((a) => a.key);
    expect(keys.slice(0, DEFAULT_LAYOUT.sportif.areas.length)).toEqual(DEFAULT_LAYOUT.sportif.areas.map((a) => a.key));
    expect(keys).toContain("travail");
    expect(new Set(keys).size).toBe(keys.length);
    // Finances and rendez-vous merged into the existing Quotidien sector.
    expect(l.areas.find((a) => a.key === "quotidien")!.subs.map((s) => s.key)).toEqual(["courses", "finances", "rendezvous"]);
    // The ready-made sets are not mutated.
    expect(DEFAULT_LAYOUT.sportif.areas.find((a) => a.key === "quotidien")!.subs).toHaveLength(2);
  });
});

describe("profile actions", () => {
  beforeEach(() => {
    db.trackerEntry = table();
    db.course = table([{ id: "c1", userId: "alice" }]);
  });

  it("holds several roles, switches between them, and keeps each one's cards and the menu choices", async () => {
    await saveProfileAction({ type: "etudiant", cards: ["courses", "deadlines"], roles: ["etudiant", "sportif"] });
    await setNavModuleAction("projects", "show");
    expect(await switchRoleAction("sportif")).toEqual({ ok: true });
    let p = await getProfile("alice");
    expect(p).toMatchObject({ type: "sportif", roles: ["sportif", "etudiant"], nav: { shown: ["projects"], hidden: [] } });
    expect(p!.cards).toEqual(["training", "journee", "nutrition", "afaire"]);
    await switchRoleAction("etudiant");
    p = await getProfile("alice");
    expect(p!.cards).toEqual(["courses", "deadlines"]);
    // Nothing about the user's data was touched: one settings row, the course still there.
    expect(db.trackerEntry.rows).toHaveLength(1);
    expect(db.course.rows).toHaveLength(1);
  });

  it("refuses to switch to a role the user does not hold, or to hide a core entry", async () => {
    await saveProfileAction({ type: "etudiant" });
    expect(await switchRoleAction("entrepreneur")).toHaveProperty("error");
    expect(await setNavModuleAction("settings", "hide")).toHaveProperty("error");
  });
});
