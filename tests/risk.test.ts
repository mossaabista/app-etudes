import { describe, expect, it } from "vitest";
import { assessRisk, sanitizeAutonomy, type Autonomy } from "@/lib/risk";

const balanced: Autonomy = { mode: "equilibre", grants: [] };
const prudent: Autonomy = { mode: "prudent", grants: [] };
const auto = (...grants: Autonomy["grants"]): Autonomy => ({ mode: "autonome", grants });

const ops = (...names: string[]) => names.map((op) => ({ op }));

describe("assessRisk", () => {
  it("lets simple, clear changes run in balanced mode", () => {
    expect(assessRisk(ops("create_event"), balanced)).toMatchObject({ risk: "low", confirm: false });
    expect(assessRisk(ops("create_task", "move", "complete"), balanced).confirm).toBe(false);
  });

  it("never asks for a read-only request", () => {
    for (const mode of [prudent, balanced, auto()]) expect(assessRisk(ops("navigate"), mode)).toMatchObject({ risk: "none", confirm: false });
    expect(assessRisk([], prudent).confirm).toBe(false);
  });

  it("asks before a plan, a deletion or hiding a sector in balanced mode", () => {
    for (const op of ["plan_day", "plan_revision", "delete", "remove_area", "remove_section"]) {
      const v = assessRisk(ops(op), balanced);
      expect(v).toMatchObject({ risk: "medium", confirm: true });
      expect(v.reasons.length).toBeGreaterThan(0);
    }
  });

  it("treats a sector created with sections inside as a structure", () => {
    expect(assessRisk([{ op: "add_area" }], balanced).confirm).toBe(false);
    expect(assessRisk([{ op: "add_area", sections: [{}, {}] }], balanced).confirm).toBe(true);
  });

  it("treats more than five changes at once as a batch", () => {
    expect(assessRisk(ops(...Array(5).fill("create_task")), balanced).confirm).toBe(false);
    expect(assessRisk(ops(...Array(6).fill("create_task")), balanced)).toMatchObject({ risk: "medium", confirm: true });
  });

  it("asks before any change in prudent mode", () => {
    expect(assessRisk(ops("create_task"), prudent).confirm).toBe(true);
  });

  it("runs granted kinds of work in autonomous mode, and only those", () => {
    expect(assessRisk(ops("plan_day"), auto("plans")).confirm).toBe(false);
    expect(assessRisk(ops("plan_day", "remove_area"), auto("plans")).confirm).toBe(true);
    expect(assessRisk(ops("delete"), auto("deletes")).confirm).toBe(false);
  });

  it("always asks before several deletions, whatever the mode", () => {
    for (const mode of [balanced, auto("deletes", "batches", "plans", "sectors")]) {
      expect(assessRisk(ops("delete", "delete"), mode)).toMatchObject({ risk: "high", confirm: true });
    }
  });
});

describe("sanitizeAutonomy", () => {
  it("falls back to balanced and drops unknown grants", () => {
    expect(sanitizeAutonomy(null)).toEqual({ mode: "equilibre", grants: [] });
    expect(sanitizeAutonomy({ mode: "yolo", grants: ["plans", "root", "plans"] })).toEqual({ mode: "equilibre", grants: ["plans"] });
  });
});
