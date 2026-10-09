import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
// Alice is signed in for every call below.
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));

import { createTaskAction, quickTaskAction, updateTaskAction } from "@/server/actions/task.actions";
import { createAssessmentAction, updateAssessmentAction } from "@/server/actions/assessment.actions";
import { createProjectAction } from "@/server/actions/project.actions";
import { deleteScheduleAction } from "@/server/actions/course.actions";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  db.course = table([{ id: "c-alice", userId: "alice" }, { id: "c-bob", userId: "bob" }]);
  db.courseSchedule = table([{ id: "s-alice", courseId: "c-alice" }, { id: "s-bob", courseId: "c-bob" }]);
  db.project = table([{ id: "p-bob", userId: "bob" }]);
  db.assessment = table([{ id: "a-alice", userId: "alice", courseId: "c-alice" }]);
  db.task = table([{ id: "t-alice", userId: "alice", title: "Mine" }, { id: "t-bob", userId: "bob", title: "Bob's" }]);
});

describe("links handed in by the client", () => {
  it("a task cannot be filed under another user's course, project or task", async () => {
    const links: Record<string, string>[] = [{ courseId: "c-bob" }, { projectId: "p-bob" }, { parentId: "t-bob" }];
    for (const fields of links) {
      const r = await createTaskAction(null, form({ title: "Sneaky", ...fields }));
      expect(r).toEqual({ error: expect.stringMatching(/introuvable/) });
    }
    expect(db.task.rows.filter((t) => t.title === "Sneaky")).toHaveLength(0);
  });

  it("a task can still be filed under the user's own course", async () => {
    expect(await createTaskAction(null, form({ title: "Read ch. 3", courseId: "c-alice" }))).toEqual({ success: true });
    expect(db.task.rows.find((t) => t.title === "Read ch. 3")?.courseId).toBe("c-alice");
  });

  it("an existing task cannot be moved under another user's course", async () => {
    const r = await updateTaskAction(null, form({ taskId: "t-alice", title: "Mine", courseId: "c-bob" }));
    expect(r).toEqual({ error: expect.stringMatching(/introuvable/) });
    expect(db.task.rows.find((t) => t.id === "t-alice")?.courseId).toBeUndefined();
  });

  it("a quick task cannot point at another user's course", async () => {
    expect(await quickTaskAction({ title: "x", category: "travail:taches", courseId: "c-bob" })).toEqual({ error: expect.stringMatching(/introuvable/) });
  });

  it("an assessment cannot be added to, or moved into, another user's course", async () => {
    expect(await createAssessmentAction(null, form({ courseId: "c-bob", title: "Quiz", type: "Quiz" }))).toEqual({ error: expect.stringMatching(/introuvable/) });
    expect(await updateAssessmentAction(null, form({ assessmentId: "a-alice", courseId: "c-bob", title: "Quiz", type: "Quiz", status: "Upcoming" }))).toEqual({
      error: expect.stringMatching(/introuvable/),
    });
    expect(db.assessment.rows).toHaveLength(1);
    expect(db.assessment.rows[0].courseId).toBe("c-alice");
  });

  it("a project cannot be linked to another user's course", async () => {
    expect(await createProjectAction(null, form({ title: "P", courseId: "c-bob" }))).toEqual({ error: expect.stringMatching(/introuvable/) });
    expect(db.project.rows).toHaveLength(1);
  });
});

describe("deleteScheduleAction", () => {
  it("does not delete another user's slot through the user's own course id", async () => {
    await deleteScheduleAction("s-bob", "c-alice");
    expect(db.courseSchedule.rows.map((s) => s.id)).toEqual(["s-alice", "s-bob"]);
  });

  it("deletes the user's own slot", async () => {
    await deleteScheduleAction("s-alice", "c-alice");
    expect(db.courseSchedule.rows.map((s) => s.id)).toEqual(["s-bob"]);
  });
});
