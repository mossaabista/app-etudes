import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";
import { DEFAULT_LAYOUT, type Layout } from "@/lib/layout";
import { buildWorkspace, detectTemplate, nameFrom, type WorkspaceFacts, type WorkspacePlan } from "@/lib/workspaces";

const db = vi.hoisted(() => ({}) as Record<string, unknown>);
const layoutStore = vi.hoisted(() => ({ value: null as unknown, fail: false }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/server/layout", () => ({
  getLayout: async () => layoutStore.value,
  saveLayout: async (_u: string, l: unknown) => {
    if (layoutStore.fail) throw new Error("db down");
    layoutStore.value = l;
  },
}));

import { applyWorkspace } from "@/server/workspaces";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const facts = (over: Partial<WorkspaceFacts> = {}): WorkspaceFacts => ({ courses: [], projects: [], layout: clone(DEFAULT_LAYOUT.etudiant), openTasks: [], ...over });
const ok = (p: WorkspacePlan | { error: string }) => {
  if ("error" in p) throw new Error(p.error);
  return p;
};

describe("detectTemplate / nameFrom", () => {
  it("reads the intent", () => {
    expect(detectTemplate("Crée un espace pour mon semestre")).toBe("semestre");
    expect(detectTemplate("Organise mon activité de freelance")).toBe("freelance");
    expect(detectTemplate("prépare mon espace d'entraînement")).toBe("entrainement");
    expect(detectTemplate("crée-moi un espace pour mon nouveau projet de site web")).toBe("projet");
    expect(detectTemplate("bonjour")).toBeNull();
  });

  it("pulls the name out of the sentence", () => {
    expect(nameFrom("crée-moi un espace pour mon nouveau projet de site web")).toBe("Site web");
    expect(nameFrom("crée un espace pour mon projet Aurum")).toBe("Aurum");
    expect(nameFrom("crée un espace pour mon nouveau projet")).toBe("");
  });
});

describe("buildWorkspace", () => {
  it("semester: reuses the real courses and only lists what they lack", () => {
    const p = ok(
      buildWorkspace("semestre", "", facts({
        courses: [
          { id: "c1", code: "CHM1711", name: "Chimie", hasSyllabus: true, hasSchedule: true, upcoming: 3 },
          { id: "c2", code: "MAT1320", name: "Calcul", hasSyllabus: false, hasSchedule: false, upcoming: 0 },
        ],
      }))
    );
    expect(p.tasks.map((t) => t.title)).toEqual(["Importer le syllabus de MAT1320", "Ajouter l'horaire de MAT1320"]);
    expect(p.tasks.every((t) => t.courseId === "c2" && t.category === "etudes:semestre")).toBe(true);
    expect(p.reused.join(" ")).toMatch(/CHM1711, MAT1320/);
    expect(p.reused.join(" ")).toMatch(/3 évaluations à venir/);
    expect(p.notes.join(" ")).toMatch(/1 cours sans syllabus/);
    // No invented course, assessment or date.
    expect(JSON.stringify(p)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("semester without courses: says so instead of making some up", () => {
    const p = ok(buildWorkspace("semestre", "", facts()));
    expect(p.notes[0]).toMatch(/Aucun cours enregistré/);
    expect(p.tasks).toEqual([{ title: "Importer les syllabus de mes cours", category: "etudes:semestre" }]);
  });

  it("project: needs a name, reuses an existing project of that name, never duplicates tasks", () => {
    expect(buildWorkspace("projet", "", facts())).toHaveProperty("error");
    const fresh = ok(buildWorkspace("projet", "Site web", facts()));
    expect(fresh.project?.milestones).toHaveLength(3);
    expect(fresh.tasks).toHaveLength(4);
    const again = ok(buildWorkspace("projet", "site web", facts({ projects: [{ id: "p1", title: "Site Web" }], openTasks: ["Découper le travail en étapes — Site web"] })));
    expect(again.project).toBeNull();
    expect(again.projectId).toBe("p1");
    expect(again.tasks).toHaveLength(3);
    expect(again.skipped.join()).toMatch(/Découper/);
  });

  it("project: brings back the Projets sector when the layout lacks it", () => {
    const p = ok(buildWorkspace("projet", "Site", facts({ layout: clone(DEFAULT_LAYOUT.sportif) })));
    expect(p.areas.map((a) => a.area.key)).toEqual(["projets"]);
  });

  it("freelance: empty client lists, no fictitious client", () => {
    const p = ok(buildWorkspace("freelance", "", facts()));
    expect(p.areas[0]).toMatchObject({ isNew: true, area: { key: "activite" } });
    expect(p.areas[0].area.subs.map((s) => s.label)).toEqual(["Clients", "Livrables", "Facturation"]);
    expect(p.tasks.map((t) => t.category)).toEqual(["activite:clients", "activite:facturation", "activite:facturation"]);
  });

  it("training: only adds the sections Santé lacks", () => {
    const layout: Layout = clone(DEFAULT_LAYOUT.etudiant);
    const p = ok(buildWorkspace("entrainement", "", facts({ layout })));
    expect(p.areas).toHaveLength(1);
    expect(p.areas[0]).toMatchObject({ isNew: false, area: { key: "sante" } });
    expect(p.areas[0].area.subs.map((s) => s.key)).toEqual(["programme"]);
    expect(p.skipped.join()).toMatch(/Sport/);
  });
});

describe("applyWorkspace", () => {
  beforeEach(() => {
    db.course = table([{ id: "c1", userId: "alice", code: "MAT1320", name: "Calcul", _count: { syllabi: 0, schedules: 0 }, assessments: [] }]);
    db.project = table();
    db.task = table();
    db.$transaction = async (fn: (tx: unknown) => unknown) => fn(db);
    layoutStore.value = clone(DEFAULT_LAYOUT.etudiant);
    layoutStore.fail = false;
  });
  const t = () => db.task as ReturnType<typeof table>;

  it("creates the project, its tasks and the sector, verifies them, and returns their undo", async () => {
    const r = await applyWorkspace("alice", "projet", "Site web");
    if ("error" in r) throw new Error(r.error);
    expect(r.partial).toBe(false);
    const project = (db.project as ReturnType<typeof table>).rows[0];
    expect(project).toMatchObject({ userId: "alice", title: "Site web" });
    expect(t().rows).toHaveLength(4);
    expect(t().rows.every((x) => x.projectId === project.id && x.category === `projets:${project.id}`)).toBe(true);
    expect(r.href).toBe(`/tasks/projets/${project.id}`);
    expect(r.undos.map((u) => u.t)).toEqual(["delete-task", "delete-task", "delete-task", "delete-task", "delete-project"]);
    expect(r.message).toMatch(/modèle Projet v1/);
  });

  it("does nothing the second time, and says what is already there", async () => {
    await applyWorkspace("alice", "freelance", "");
    const again = await applyWorkspace("alice", "freelance", "");
    expect(again).toEqual({ error: expect.stringMatching(/déjà en place/) });
    expect(t().rows).toHaveLength(3);
  });

  it("files semester tasks under the user's own course only", async () => {
    const r = await applyWorkspace("alice", "semestre", "");
    if ("error" in r) throw new Error(r.error);
    expect(t().rows.map((x) => x.courseId)).toEqual(["c1", "c1"]);
    expect((layoutStore.value as Layout).areas.some((a) => a.key === "etudes")).toBe(true);
  });

  it("reports a sector it could not save instead of claiming success", async () => {
    layoutStore.fail = true;
    const r = await applyWorkspace("alice", "freelance", "");
    if ("error" in r) throw new Error(r.error);
    expect(r.partial).toBe(true);
    expect(r.message).toMatch(/je n'ai pas pu enregistrer les secteurs/);
  });

  it("writes nothing when the transaction fails", async () => {
    db.$transaction = async () => {
      throw new Error("db down");
    };
    expect(await applyWorkspace("alice", "projet", "X")).toEqual({ error: expect.stringMatching(/rien n'a été enregistré/) });
  });
});
