import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>>);
vi.mock("@/lib/db", () => ({ prisma: db }));

import { briefing } from "@/server/briefing";
import { parseIntent } from "@/lib/command";
import { addDays, fromISODate, toISODate, wallTimeToUtc } from "@/lib/dates";

const today = toISODate(new Date());
const day = fromISODate(today)!;
const [y, m, d] = today.split("-").map(Number);

beforeEach(() => {
  db.courseSchedule = table();
  db.calendarEvent = table([
    { id: "e1", userId: "alice", title: "Dentiste", date: day, startTime: "23:50", endTime: "23:55", notes: null },
    { id: "e2", userId: "bob", title: "Rendez-vous secret de Bob", date: day, startTime: "23:50", endTime: "23:55", notes: null },
    { id: "e3", userId: "alice", title: "Cinéma demain", date: addDays(day, 1), startTime: "20:00", endTime: "22:00", notes: null },
  ]);
  db.task = table([
    { id: "t1", userId: "alice", parentId: null, title: "Payer le loyer", status: "ToDo", dueDate: wallTimeToUtc([y, m, d, 23, 59, 0]), updatedAt: new Date() },
    { id: "t2", userId: "bob", parentId: null, title: "Tâche de Bob", status: "ToDo", dueDate: wallTimeToUtc([y, m, d, 23, 59, 0]), updatedAt: new Date() },
  ]);
  db.assessment = table();
  db.labSession = table();
});

describe("Test 1 — « qu'est-ce que j'ai aujourd'hui ? »", () => {
  it("lists this user's real items for the local day, and nothing else", async () => {
    const text = await briefing("alice", "qu'est-ce que j'ai aujourd'hui ?");
    expect(text).toMatch(/^Aujourd'hui/);
    expect(text).toMatch(/Dentiste/);
    expect(text).toMatch(/Payer le loyer/);
    expect(text).not.toMatch(/Bob/);
    expect(text).not.toMatch(/Cinéma/);
  });

  it("invents nothing on an empty day", async () => {
    const text = await briefing("carol", "qu'est-ce que j'ai aujourd'hui ?");
    expect(text).not.toMatch(/Dentiste|loyer|Bob|Cinéma/);
  });

  it("answers for tomorrow when asked", async () => {
    const text = await briefing("alice", "qu'est-ce que j'ai demain ?");
    expect(text).toMatch(/^Demain/);
    expect(text).toMatch(/Cinéma demain/);
    expect(text).not.toMatch(/Dentiste/);
  });

  it("speaks English to an English-speaking user, and understands the question in English", async () => {
    expect(parseIntent("What do I have today?").kind).toBe("summary");
    expect(parseIntent("what's on tomorrow").kind).toBe("summary");
    expect(parseIntent("ajoute réviser demain").kind).toBe("create");
    const text = await briefing("alice", "what do I have tomorrow?", "en");
    expect(text).toMatch(/^Tomorrow, /);
    expect(text).toMatch(/Cinéma demain at 20:00/);
    expect(text).not.toMatch(/Demain|À faire|Au programme/);
  });
});
