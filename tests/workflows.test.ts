import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, unknown>);
const exec = vi.hoisted(() => ({ calls: [] as { userId: string; op: string }[], fail: new Set<string>(), throws: new Set<string>() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/server/assistant-run", () => ({
  executePlan: async (userId: string, actions: { op: string }[]) => {
    const op = actions[0].op;
    exec.calls.push({ userId, op });
    if (exec.throws.has(op)) throw new Error("db down");
    if (exec.fail.has(op)) return { message: `Je n'ai pas pu ${op}.`, partial: true, undos: [], answer: false, navigate: null };
    return { message: `${op} fait.`, partial: false, undos: [{ t: "delete-event", id: `ev-${op}` }], answer: false, navigate: null };
  },
}));
vi.mock("@/server/notifications/push", () => ({ pushIsConfigured: () => false, sendToUser: async () => ({ sent: 0, removed: 0, errors: [] }) }));
vi.mock("@/server/notifications/digest", () => ({ buildDailyDigest: async () => null }));

import { validateWorkflow, dueOn } from "@/lib/workflows";
import { deleteWorkflow, listRuns, listWorkflows, runScheduledWorkflows, runWorkflow, saveWorkflow, setWorkflowEnabled } from "@/server/workflows";

const T = () => db.trackerEntry as ReturnType<typeof table>;
const morning = { name: "Matin", trigger: { type: "daily", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] }, condition: "always", steps: [{ type: "plan_day" }, { type: "plan_workouts", sessions: 2, minutes: 45, when: "soir" }], authorize: true };

beforeEach(() => {
  exec.calls = [];
  exec.fail.clear();
  exec.throws.clear();
  db.trackerEntry = table();
  db.task = table();
  db.assessment = table();
  db.labSession = table();
  db.pushSubscription = table();
});

describe("workflow definitions", () => {
  it("accepts only catalogue steps with clean parameters", () => {
    expect(validateWorkflow({ name: "x", steps: [{ type: "rm -rf" }] })).toMatchObject({ error: expect.stringMatching(/pas reconnue/) });
    expect(validateWorkflow({ name: "x", steps: [{ type: "create_task", title: "  " }] })).toMatchObject({ error: expect.any(String) });
    expect(validateWorkflow({ name: "", steps: [{ type: "plan_day" }] })).toMatchObject({ error: expect.stringMatching(/nom/) });
    expect(validateWorkflow({ name: "x", steps: Array(7).fill({ type: "plan_day" }) })).toMatchObject({ error: expect.stringMatching(/6 étapes/) });
    const ok = validateWorkflow({ name: "x", trigger: { type: "daily", days: ["Sunday", "Funday", "Monday"] }, steps: [{ type: "plan_workouts", sessions: 99, minutes: 1, when: "nuit" }] });
    expect(ok).toEqual({ ok: { name: "x", enabled: true, trigger: { type: "daily", days: ["Monday", "Sunday"] }, condition: "always", steps: [{ type: "plan_workouts", sessions: 7, minutes: 15, when: "libre" }], authorize: false } });
  });

  it("never schedules without an explicit authorisation", async () => {
    expect(await saveWorkflow("alice", { ...morning, authorize: false })).toMatchObject({ error: expect.stringMatching(/autorisation/) });
    const r = await saveWorkflow("alice", morning);
    if (!("workflow" in r)) throw new Error(r.error);
    expect(r.workflow.authorizedAt).toEqual(expect.any(String));
    // Changing the steps of a scheduled workflow asks again.
    expect(await saveWorkflow("alice", { ...morning, authorize: false, steps: [{ type: "plan_week" }] }, r.workflow.id)).toMatchObject({ error: expect.stringMatching(/autorisation/) });
    expect(dueOn({ ...r.workflow, authorizedAt: null }, "Monday")).toBe(false);
  });
});

describe("running workflows", () => {
  const make = async (def: object = morning, user = "alice") => {
    const r = await saveWorkflow(user, def);
    if (!("workflow" in r)) throw new Error(r.error);
    return r.workflow;
  };

  it("runs the steps in order as their owner, and logs each outcome", async () => {
    const w = await make();
    const out = await runWorkflow("alice", w.id, { trigger: "manual", key: "op:abcdefgh1" });
    if (!("run" in out) || !out.run) throw new Error("expected a run");
    expect(exec.calls).toEqual([{ userId: "alice", op: "plan_day" }, { userId: "alice", op: "plan_workouts" }]);
    expect(out.run).toMatchObject({ status: "done", trigger: "manual", steps: [{ status: "done", message: "plan_day fait." }, { status: "done" }] });
    expect(out.run.undo).toEqual({ t: "many", list: [{ t: "delete-event", id: "ev-plan_day" }, { t: "delete-event", id: "ev-plan_workouts" }] });
    expect((await listRuns("alice")).map((r) => r.id)).toEqual([out.run.id]);
  });

  it("never runs the same request or the same day twice", async () => {
    const w = await make();
    await runWorkflow("alice", w.id, { trigger: "manual", key: "op:same-click" });
    const again = await runWorkflow("alice", w.id, { trigger: "manual", key: "op:same-click" });
    expect(again).toMatchObject({ duplicate: true });
    await runScheduledWorkflows(new Date("2026-10-12T12:00:00Z"));
    await runScheduledWorkflows(new Date("2026-10-12T15:00:00Z"));
    expect(exec.calls).toHaveLength(4);
    expect(T().rows.filter((r) => r.module === "app:workflow-runs")).toHaveLength(2);
  });

  it("refuses another user's workflow", async () => {
    const w = await make(morning, "bob");
    expect(await runWorkflow("alice", w.id, { trigger: "manual", key: "op:steal-1234" })).toEqual({ error: "Automatisation introuvable." });
    expect(await deleteWorkflow("alice", w.id)).toBe(false);
    expect(await setWorkflowEnabled("alice", w.id, false)).toBe(false);
    expect(exec.calls).toEqual([]);
  });

  it("stops at the first failure and says so, without claiming success", async () => {
    exec.fail.add("plan_day");
    const w = await make();
    const out = await runWorkflow("alice", w.id, { trigger: "manual", key: "op:failing-1" });
    if (!("run" in out) || !out.run) throw new Error("expected a run");
    expect(out.run.status).toBe("failed");
    expect(out.run.steps.map((s) => s.status)).toEqual(["failed", "skipped"]);
    expect(out.run.steps[1].message).toMatch(/précédente a échoué/);
    expect(exec.calls.map((c) => c.op)).toEqual(["plan_day"]);
  });

  it("recovers from a crash inside a step: logged as failed, earlier work kept undoable", async () => {
    exec.throws.add("plan_workouts");
    const w = await make();
    const out = await runWorkflow("alice", w.id, { trigger: "manual", key: "op:crashing1" });
    if (!("run" in out) || !out.run) throw new Error("expected a run");
    expect(out.run.status).toBe("partial");
    expect(out.run.steps[1]).toMatchObject({ status: "failed", message: expect.not.stringMatching(/db down/) });
    expect(out.run.undo).toEqual({ t: "many", list: [{ t: "delete-event", id: "ev-plan_day" }] });
  });

  it("skips honestly when its condition is not met, and when a step cannot be done here", async () => {
    const w = await make({ name: "Sprint", condition: "if_due_soon", steps: [{ type: "plan_day" }] });
    const out = await runWorkflow("alice", w.id, { trigger: "manual", key: "op:condition1" });
    expect(out).toMatchObject({ run: { status: "skipped", note: expect.stringMatching(/condition n'est pas remplie/) } });
    const n = await make({ name: "Notif", steps: [{ type: "notify_briefing" }, { type: "groceries_week" }] });
    const r2 = await runWorkflow("alice", n.id, { trigger: "manual", key: "op:notify-01" });
    expect(r2).toMatchObject({ run: { status: "failed", steps: [{ status: "skipped", message: expect.stringMatching(/pas configurées/) }, { status: "failed", message: expect.stringMatching(/profil nutrition/) }] } });
    expect(exec.calls).toEqual([]);
  });

  it("asks before a manual run that fills the week", async () => {
    const w = await make({ name: "Semaine", steps: [{ type: "plan_week" }] });
    expect(await runWorkflow("alice", w.id, { trigger: "manual", key: "op:week-0001" })).toMatchObject({ confirm: expect.any(String) });
    expect(exec.calls).toEqual([]);
    expect(await runWorkflow("alice", w.id, { trigger: "manual", key: "op:week-0001", confirmed: true })).toMatchObject({ run: { status: "done" } });
  });

  it("a disabled workflow no longer runs on schedule; deleting removes it and its history", async () => {
    const w = await make();
    await setWorkflowEnabled("alice", w.id, false);
    expect(await runScheduledWorkflows(new Date("2026-10-12T12:00:00Z"))).toEqual([]);
    expect(exec.calls).toEqual([]);
    await runWorkflow("alice", w.id, { trigger: "manual", key: "op:manual-ok" });
    expect(await listRuns("alice")).toHaveLength(1);
    expect(await deleteWorkflow("alice", w.id)).toBe(true);
    expect(await listWorkflows("alice")).toEqual([]);
    expect(await listRuns("alice")).toEqual([]);
  });

  it("only runs scheduled workflows on their days", async () => {
    await make({ ...morning, trigger: { type: "daily", days: ["Sunday"] } });
    expect(await runScheduledWorkflows(new Date("2026-10-12T12:00:00Z"))).toEqual([]); // a Monday
    expect(await runScheduledWorkflows(new Date("2026-10-11T12:00:00Z"))).toEqual([{ workflowId: expect.any(String), status: "done" }]);
  });
});
