import { describe, expect, it } from "vitest";
import { MASS_DELETE, assessRisk, sanitizeAutonomy, type Autonomy } from "@/lib/risk";

const direct: Autonomy = { mode: "equilibre", grants: [] };
const prudent: Autonomy = { mode: "prudent", grants: [] };
const auto = (...grants: Autonomy["grants"]): Autonomy => ({ mode: "autonome", grants });
const ops = (...names: string[]) => names.map((op) => ({ op }));
const many = (op: string, n: number) => ops(...Array(n).fill(op));

describe("assessRisk", () => {
  it("runs explicit additions, changes and deletions straight away by default", () => {
    for (const op of ["create_event", "create_task", "move", "rename", "complete", "delete", "remove_area", "remove_section", "plan_day"])
      expect(assessRisk(ops(op), direct).confirm).toBe(false);
    // « je ne fais plus de sport aujourd'hui »: a few deletions at once.
    expect(assessRisk(many("delete", 3), direct).confirm).toBe(false);
    expect(assessRisk([{ op: "plan_revision", assessment_ids: ["a1"] }], direct).confirm).toBe(false);
  });

  it("never asks for a read-only request", () => {
    for (const mode of [prudent, direct, auto()]) expect(assessRisk(ops("navigate"), mode)).toMatchObject({ risk: "none", confirm: false });
    expect(assessRisk([], prudent).confirm).toBe(false);
  });

  it("asks before a mass deletion, whatever the mode", () => {
    expect(assessRisk(many("delete", MASS_DELETE), direct).confirm).toBe(false);
    for (const mode of [direct, auto("plans", "batches")]) expect(assessRisk(many("delete", MASS_DELETE + 1), mode)).toMatchObject({ risk: "high", confirm: true });
  });

  it("asks before a request that changes many things, or plans every assessment", () => {
    expect(assessRisk(many("create_task", 10), direct).confirm).toBe(false);
    expect(assessRisk(many("create_task", 11), direct)).toMatchObject({ risk: "medium", confirm: true });
    const v = assessRisk([{ op: "plan_revision" }], direct);
    expect(v).toMatchObject({ risk: "medium", confirm: true });
    expect(v.reasons[0]).toMatch(/toutes tes évaluations/);
  });

  it("asks before any change in prudent mode", () => {
    expect(assessRisk(ops("create_task"), prudent).confirm).toBe(true);
  });

  it("runs granted large work in autonomous mode, and only that", () => {
    expect(assessRisk([{ op: "plan_revision" }], auto("plans")).confirm).toBe(false);
    expect(assessRisk(many("create_task", 11), auto("plans")).confirm).toBe(true);
    expect(assessRisk(many("create_task", 11), auto("batches")).confirm).toBe(false);
  });
});

describe("sanitizeAutonomy", () => {
  it("falls back to the default and drops unknown or retired grants", () => {
    expect(sanitizeAutonomy(null)).toEqual({ mode: "equilibre", grants: [] });
    expect(sanitizeAutonomy({ mode: "yolo", grants: ["plans", "root", "plans", "deletes"] })).toEqual({ mode: "equilibre", grants: ["plans"] });
  });
});
