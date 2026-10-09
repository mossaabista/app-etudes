import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));
vi.mock("@/server/assistant", () => ({ assistantEnabled: () => false }));
vi.mock("@/server/assistant-run", () => ({ runAssistant: async () => null, runConfirmedPlan: async () => null }));
vi.mock("@/server/layout", () => ({ saveLayout: async () => {}, getLayout: async () => ({ areas: [] }), LAYOUT_MODULE: "app:layout" }));
vi.mock("@/server/briefing", () => ({ briefing: async () => "" }));
vi.mock("@/server/autonomy", () => ({ getAutonomy: async () => ({ mode: "equilibre", grants: [] }) }));

import { parseCapture } from "@/lib/capture";
import { commandAction } from "@/server/actions/capture.actions";
import { addDays, fromISODate, toISODate } from "@/lib/dates";

beforeEach(() => {
  db.task = table();
  db.calendarEvent = table();
  db.trackerEntry = table();
});

describe("priority in words", () => {
  it("reads high, critical and low priority, and keeps it out of the title", () => {
    const today = "2026-10-12";
    expect(parseCapture("rendre le rapport demain haute priorité", today)).toMatchObject({ title: "Rendre le rapport", priority: "High", day: "2026-10-13" });
    expect(parseCapture("appeler le proprio urgent", today)).toMatchObject({ title: "Appeler le proprio", priority: "High" });
    expect(parseCapture("payer l'impôt très urgent", today)).toMatchObject({ priority: "Critical" });
    expect(parseCapture("ranger le garage pas urgent", today)).toMatchObject({ title: "Ranger le garage", priority: "Low" });
    expect(parseCapture("acheter du pain", today).priority).toBe("Medium");
    // "une" is not read as "un" + a stray "e", and the filler "une tâche pour :" is dropped.
    expect(parseCapture("Crée une tâche pour demain : réserver la salle", today).title).toBe("Réserver la salle");
    expect(parseCapture("Ajoute une tâche urgente : appeler Paul", today)).toMatchObject({ title: "Appeler Paul", priority: "High" });
  });

  it("Test 2: « crée une tâche haute priorité pour demain : réserver la salle » is saved as asked, for its owner", async () => {
    const r = await commandAction("Crée une tâche haute priorité pour demain : réserver la salle");
    expect(r).toMatchObject({ ok: true });
    expect(db.task.rows).toHaveLength(1);
    const t = db.task.rows[0];
    expect(t).toMatchObject({ userId: "alice", priority: "High", status: "ToDo" });
    expect(t.title).toBe("Réserver la salle");
    expect(toISODate(t.dueDate as Date)).toBe(toISODate(addDays(fromISODate(toISODate(new Date()))!, 1)));
  });
});
