import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));

import { parseTaskQuery, queryString, sortTasks, taskWhere } from "@/lib/task-list";
import { bulkCompleteAction, bulkDeleteAction } from "@/server/actions/tasks-bulk.actions";
import { undoCommandAction } from "@/server/actions/capture.actions";

const D = (s: string) => new Date(s);
const today = D("2026-10-12T04:00:00Z");
const task = (id: string, p: Record<string, unknown> = {}) => ({ id, userId: "alice", parentId: null, title: id, status: "ToDo", priority: "Medium", dueDate: null, category: null, description: null, estimatedTime: null, courseId: null, projectId: null, createdAt: D("2026-10-01T00:00:00Z"), ...p });

beforeEach(() => {
  db.task = table([
    task("Rapport chimie", { dueDate: D("2026-10-10T12:00:00Z"), category: "etudes:devoirs", priority: "High" }),
    task("Appeler maman", { dueDate: D("2026-10-12T20:00:00Z"), category: "social:proches" }),
    task("Lire chapitre 3", { category: "etudes:lecture", createdAt: D("2026-10-05T00:00:00Z") }),
    task("Payer loyer", { status: "Done", dueDate: D("2026-10-01T12:00:00Z") }),
    task("sous-tâche", { parentId: "Lire chapitre 3" }),
    task("Bob secret", { userId: "bob" }),
  ]);
  db.course = table();
  db.project = table();
});

const find = async (params: Record<string, string>) => sortTasks(await db.task.findMany({ where: taskWhere("alice", parseTaskQuery(params), today) }), parseTaskQuery(params).sort).map((t) => t.title);

describe("task list filters", () => {
  it("reads only known values from the address bar", () => {
    expect(parseTaskQuery({ status: "pirate", due: ["week", "x"], area: "../etc", sort: "recent", q: "  a   b " })).toEqual({ q: "a b", status: "open", due: "week", area: null, sort: "recent" });
    expect(queryString(parseTaskQuery({}), { due: "overdue" })).toBe("?due=overdue");
  });

  it("lists this user's top-level open tasks, soonest first, undated last", async () => {
    expect(await find({})).toEqual(["Rapport chimie", "Appeler maman", "Lire chapitre 3"]);
  });

  it("searches, filters by sector, status and due date", async () => {
    expect(await find({ q: "CHAP" })).toEqual(["Lire chapitre 3"]);
    expect(await find({ area: "etudes" })).toEqual(["Rapport chimie", "Lire chapitre 3"]);
    expect(await find({ status: "done" })).toEqual(["Payer loyer"]);
    expect(await find({ due: "overdue" })).toEqual(["Rapport chimie"]);
    expect(await find({ due: "today" })).toEqual(["Appeler maman"]);
    expect(await find({ due: "none" })).toEqual(["Lire chapitre 3"]);
    expect(await find({ status: "all", sort: "recent" })).toEqual(["Lire chapitre 3", "Rapport chimie", "Appeler maman", "Payer loyer"]);
  });
});

describe("bulk actions", () => {
  it("checks tasks off in one go, and undo puts their status back", async () => {
    const r = await bulkCompleteAction(["Rapport chimie", "Appeler maman", "Payer loyer", "Bob secret"]);
    if (!("ok" in r)) throw new Error(r.error);
    expect(r.count).toBe(2);
    expect(db.task.rows.find((t) => t.id === "Bob secret")!.status).toBe("ToDo");
    await undoCommandAction(r.undo!);
    expect(db.task.rows.filter((t) => t.status === "Done").map((t) => t.id)).toEqual(["Payer loyer"]);
  });

  it("deletes a few at once with undo, keeps tasks with sub-tasks and other users' tasks", async () => {
    const r = await bulkDeleteAction(["Rapport chimie", "Lire chapitre 3", "Bob secret"]);
    if (!("ok" in r)) throw new Error("expected ok");
    expect(r).toMatchObject({ count: 1, kept: 1 });
    expect(db.task.rows.map((t) => t.id)).not.toContain("Rapport chimie");
    expect(db.task.rows.map((t) => t.id)).toContain("Bob secret");
    await undoCommandAction(r.undo!);
    expect(db.task.rows.find((t) => t.title === "Rapport chimie" && t.userId === "alice")).toMatchObject({ priority: "High", category: "etudes:devoirs" });
  });

  it("asks before deleting more than ten", async () => {
    db.task = table(Array.from({ length: 12 }, (_, i) => task(`t${i}`)));
    const ids = db.task.rows.map((t) => t.id as string);
    expect(await bulkDeleteAction(ids)).toEqual({ confirm: "Supprimer 12 tâches d'un coup ?" });
    expect(db.task.rows).toHaveLength(12);
    expect(await bulkDeleteAction(ids, true)).toMatchObject({ ok: true, count: 12 });
    expect(db.task.rows).toHaveLength(0);
  });
});
