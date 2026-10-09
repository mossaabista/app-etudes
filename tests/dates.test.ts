import { describe, expect, it } from "vitest";
import { addDays, fromISODate, toISODate, wallTimeToUtc } from "@/lib/dates";
import { parseCapture } from "@/lib/capture";

describe("Ottawa dates", () => {
  it("resolves a wall time on each side of the November DST change", () => {
    // 2026-11-01: clocks go back from EDT (UTC-4) to EST (UTC-5).
    expect(wallTimeToUtc([2026, 10, 31, 10, 0, 0]).toISOString()).toBe("2026-10-31T14:00:00.000Z");
    expect(wallTimeToUtc([2026, 11, 2, 10, 0, 0]).toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });

  it("adds a calendar day across the change, not 24 hours", () => {
    const sat = fromISODate("2026-10-31")!;
    expect(toISODate(addDays(sat, 1))).toBe("2026-11-01");
    expect(toISODate(addDays(sat, 2))).toBe("2026-11-02");
  });

  it("reads the Ottawa day, not the UTC one, late in the evening", () => {
    // 23:30 in Ottawa on Oct 9 is already Oct 10 in UTC.
    expect(toISODate(new Date("2026-10-10T03:30:00Z"))).toBe("2026-10-09");
  });

  it("rejects impossible dates", () => {
    expect(fromISODate("2026-02-31")).toBeNull();
    expect(fromISODate("hier")).toBeNull();
  });
});

describe("parseCapture", () => {
  // Friday 9 October 2026.
  const today = "2026-10-09";

  it("reads « séance de sport samedi à 10 h pendant 60 min »", () => {
    const p = parseCapture("séance de sport samedi à 10 h pendant 60 min", today);
    expect(p).toMatchObject({ day: "2026-10-10", time: "10:00", minutes: 60, area: "sante", sub: "sport" });
  });

  it("reads « demain » from the given day", () => {
    expect(parseCapture("appeler maman demain", today).day).toBe("2026-10-10");
  });
});
