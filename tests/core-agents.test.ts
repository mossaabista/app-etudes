import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import { AGENTS, MAX_AGENTS, OPS, agentById, allowedOps, route } from "@/server/core/agents";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table> | undefined>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("@/server/layout", () => ({ getLayout: async () => ({ areas: [{ key: "sante", label: "Santé", front: "Santé", color: "#f00", blurb: "", subs: [] }] }), saveLayout: async () => {} }));
vi.mock("@/server/radar", () => ({ riskRadar: async () => [] }));
vi.mock("@/server/autonomy", () => ({ getAutonomy: async () => ({ mode: "equilibre", grants: [] }) }));

import { assistantContext } from "@/server/assistant";
import { executePlan } from "@/server/assistant-run";

describe("agent registry", () => {
  it("declares real, known tools for every agent, and unique ids", () => {
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(AGENTS.length);
    for (const a of AGENTS) {
      expect(a.tools.length).toBeGreaterThan(0);
      for (const t of a.tools) expect(OPS).toContain(t);
      expect(a.instructions.length).toBeGreaterThan(0);
      expect(a.version).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("route", () => {
  const ids = (t: string, prev = "") => route(t, prev).map((a) => a.id);
  it("picks the agents a request needs, and only those", () => {
    expect(ids("Prépare-moi un plan de révision pour mon examen de chimie")).toContain("academic");
    expect(ids("j'ai mangé une salade et bu deux verres d'eau")).toEqual(["nutrition"]);
    expect(ids("Ajoute une séance de muscu samedi à 10 h")[0]).toBe("fitness");
    expect(ids("crée un projet site web et découpe-le en étapes")[0]).toBe("projects");
  });

  it("coordinates several domains, never more than three", () => {
    const r = ids("organise ma semaine autour de mes cours, de mes séances de sport et de la réunion du projet");
    expect(r.length).toBeLessThanOrEqual(MAX_AGENTS);
    expect(r).toEqual(expect.arrayContaining(["productivity", "academic"]));
  });

  it("falls back to the personal assistant, and keeps a follow-up with the previous topic", () => {
    expect(ids("bonjour")).toEqual(["personal"]);
    expect(ids("décale-la à 11 h", "ajoute une séance de muscu samedi à 10 h")).toContain("fitness");
  });

  it("gives an agent set only the union of its tools", () => {
    const ops = allowedOps([agentById("nutrition")!]);
    expect(ops.has("log")).toBe(true);
    expect(ops.has("delete")).toBe(false);
    expect(ops.has("navigate")).toBe(true);
  });
});

describe("assistantContext", () => {
  beforeEach(() => {
    db.course = table();
    db.trackerEntry = table();
    db.project = table([{ id: "p1", userId: "alice", title: "Site web", status: "InProgress", progress: 30, dueDate: null, milestones: [], members: [{ name: "Sam", role: null }], tasks: [] }]);
    // Not there: a slice that is not needed must not be read.
    db.calendarEvent = undefined;
    db.task = undefined;
    db.assessment = undefined;
  });

  it("only reads and sends the slices the chosen agents need", async () => {
    const c = await assistantContext("alice", "/today", ["projects"]);
    expect(c.text).toMatch(/id=p:p1 « Site web »/);
    expect(c.text).toMatch(/membres inscrits : Sam/);
    expect(c.text).not.toMatch(/AGENDA JOUR PAR JOUR/);
    expect(c.projectIds.has("p:p1")).toBe(true);
  });
});

describe("executePlan with agents", () => {
  beforeEach(() => {
    db.calendarEvent = table([{ id: "ev", userId: "alice", title: "Dentiste", date: new Date(), startTime: "10:00", endTime: "11:00", type: "Personal" }]);
    db.task = table();
    db.project = table([{ id: "p1", userId: "alice", title: "Site web" }, { id: "pb", userId: "bob", title: "Projet de Bob" }]);
    db.projectMilestone = table();
  });
  const ctx = { ids: new Set(["e:ev"]), assessmentIds: new Set<string>(), projectIds: new Set(["p:p1", "p:pb"]) };

  it("refuses an operation outside the chosen agents' tools", async () => {
    const r = await executePlan("alice", [{ op: "delete", id: "e:ev" }], "Supprimé.", ctx, [agentById("nutrition")!]);
    expect(r.partial).toBe(true);
    expect(r.message).toMatch(/hors de ce que je peux faire ici/);
    expect(db.calendarEvent!.rows).toHaveLength(1);
  });

  it("creates a project, adds a milestone and files tasks under it", async () => {
    const agents = [agentById("projects")!];
    const made = await executePlan("alice", [{ op: "create_project", title: "Déménagement", date: "2026-12-01" }], "", ctx, agents);
    expect(made.partial).toBe(false);
    expect(db.project!.rows.find((p) => p.title === "Déménagement")).toMatchObject({ userId: "alice" });
    const r = await executePlan(
      "alice",
      [
        { op: "add_milestone", project: "p:p1", title: "Maquettes" },
        { op: "create_task", project: "p:p1", title: "Choisir l'hébergeur" },
      ],
      "",
      ctx,
      agents
    );
    expect(r.partial).toBe(false);
    expect(db.projectMilestone!.rows[0]).toMatchObject({ projectId: "p1", title: "Maquettes" });
    expect(db.task!.rows[0]).toMatchObject({ projectId: "p1", category: "projets:p1", dueDate: null });
    expect(r.undos.map((u) => u.t)).toEqual(["delete-milestone", "delete-task"]);
  });

  it("never touches another user's project, even when its id is offered", async () => {
    const r = await executePlan("alice", [{ op: "add_milestone", project: "p:pb", title: "Piratage" }], "Fait.", ctx, [agentById("projects")!]);
    expect(r.partial).toBe(true);
    expect(db.projectMilestone!.rows).toHaveLength(0);
  });
});
