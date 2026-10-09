import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));

import { checkRefs } from "@/server/ownership";

beforeEach(() => {
  db.course = table([{ id: "c-alice", userId: "alice" }, { id: "c-bob", userId: "bob" }]);
  db.project = table([{ id: "p-alice", userId: "alice" }]);
  db.assessment = table([{ id: "a-bob", userId: "bob" }]);
  db.task = table([{ id: "t-alice", userId: "alice" }]);
});

describe("checkRefs", () => {
  it("accepts no links at all", async () => {
    expect(await checkRefs("alice", {})).toBeNull();
    expect(await checkRefs("alice", { courseId: null, projectId: "" })).toBeNull();
  });

  it("accepts the user's own rows", async () => {
    expect(await checkRefs("alice", { courseId: "c-alice", projectId: "p-alice", parentId: "t-alice" })).toBeNull();
  });

  it("refuses another user's row, even mixed with own ones", async () => {
    expect(await checkRefs("alice", { courseId: "c-bob" })).toMatch(/introuvable/);
    expect(await checkRefs("alice", { courseId: "c-alice", assessmentId: "a-bob" })).toMatch(/introuvable/);
  });

  it("refuses an id that does not exist", async () => {
    expect(await checkRefs("alice", { parentId: "nope" })).toMatch(/introuvable/);
  });
});
