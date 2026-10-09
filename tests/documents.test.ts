import { beforeEach, describe, expect, it, vi } from "vitest";
import { table } from "./fake-db";

const db = vi.hoisted(() => ({}) as Record<string, ReturnType<typeof import("./fake-db").table>> & { $transaction?: unknown });
const llm = vi.hoisted(() => ({ enabled: false, reply: null as unknown }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/server/auth/current-user", () => ({ requireUser: async () => ({ id: "alice" }) }));
vi.mock("@/server/llm", () => ({ llmEnabled: () => llm.enabled, callTool: async () => llm.reply }));

import { actionLines, leadSummary, passagesOf, search, terms } from "@/lib/retrieval";
import { askDocuments, deleteDocument, extractDocument, listDocuments, saveDocument, searchDocuments, summarizeDocument } from "@/server/documents";
import { askDocumentsAction, deleteDocumentAction, tasksFromDocumentAction } from "@/server/actions/documents.actions";

const SYLLABUS = [
  "Plan de cours — Chimie organique 201.\n\nLe cours couvre les réactions de substitution et d'élimination.",
  "Évaluations.\n\nL'examen final compte pour 40 % de la note. Il aura lieu le 12 décembre.\n\nLe laboratoire 3 doit être remis avant le 20 novembre.",
];

beforeEach(() => {
  llm.enabled = false;
  llm.reply = null;
  db.trackerEntry = table([{ id: "bob-doc", userId: "bob", module: "app:documents", kind: "doc", text: "Contrat secret de Bob : salaire 90 000 $, examen final annulé.", data: { name: "bob.txt", paged: false }, createdAt: new Date() }]);
  db.task = table();
});

const save = (pages = SYLLABUS, paged = true) => saveDocument("alice", "syllabus.pdf", 1234, { pages, paged, type: "PDF" });

describe("retrieval", () => {
  it("folds accents and plurals, and drops stop words", () => {
    expect(terms("Les examens de l'Été")).toEqual(["examen", "ete"]);
  });

  it("cuts long text into passages of bounded size", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Paragraphe ${i} ${"mot ".repeat(20)}`).join("\n\n");
    const parts = passagesOf(text);
    expect(parts.length).toBeGreaterThan(3);
    expect(Math.max(...parts.map((p) => p.length))).toBeLessThanOrEqual(1300);
  });

  it("ranks the passage that answers first, with its page", () => {
    const hits = search([{ id: "d", name: "Syllabus", pages: SYLLABUS, paged: true }], "Combien compte l'examen final ?");
    expect(hits[0]).toMatchObject({ ref: "D1", docId: "d", page: 2, text: expect.stringMatching(/40 %/) });
  });

  it("finds nothing rather than something unrelated", () => {
    expect(search([{ id: "d", name: "S", pages: SYLLABUS, paged: true }], "recette de lasagne")).toEqual([]);
  });

  it("pulls out to-do lines and a lead summary without a model", () => {
    expect(actionLines(SYLLABUS.join("\n"))).toEqual(["Le laboratoire 3 doit être remis avant le 20 novembre."]);
    expect(leadSummary("Une phrase. Deux phrases. Trois.", 20)).toBe("Une phrase.");
  });
});

describe("documents", () => {
  it("reads text files and refuses unknown formats", async () => {
    expect(await extractDocument("notes.md", new TextEncoder().encode("# Notes\nBonjour"))).toMatchObject({ pages: ["# Notes\nBonjour"], paged: false });
    expect(await extractDocument("virus.exe", new Uint8Array(3))).toMatchObject({ error: expect.stringMatching(/Formats acceptés/) });
  });

  it("stores a document for its owner only", async () => {
    const saved = await save();
    expect(saved).toMatchObject({ name: "syllabus.pdf", pages: 2, paged: true });
    expect((await listDocuments("alice")).map((d) => d.name)).toEqual(["syllabus.pdf"]);
    expect((await listDocuments("bob")).map((d) => d.name)).toEqual(["bob.txt"]);
  });

  it("never searches or answers from someone else's documents", async () => {
    await save();
    const hits = await searchDocuments("alice", "salaire contrat");
    expect(hits).toEqual([]);
    const a = await askDocuments("alice", "Quel est le salaire ?");
    expect(a).toMatchObject({ missing: true, sources: [] });
    // Even naming Bob's document by id does not reach it.
    expect(await askDocuments("alice", "examen final", "bob-doc")).toMatchObject({ missing: true, sources: [] });
  });

  it("answers with the passages themselves when no model is configured", async () => {
    await save();
    const a = await askDocuments("alice", "Quand a lieu l'examen final ?");
    expect(a.by).toBe("extract");
    expect(a.sources[0]).toMatchObject({ docName: "syllabus.pdf", page: 2, text: expect.stringMatching(/12 décembre/) });
  });

  it("keeps only the citations that point at passages it was given", async () => {
    await save();
    llm.enabled = true;
    llm.reply = { answer: "L'examen compte pour 40 % [D1], selon le doyen [D9].", citations: ["D1", "D7"], missing: false };
    const a = await askDocuments("alice", "Combien compte l'examen final ?");
    expect(a.by).toBe("ai");
    expect(a.answer).toBe("L'examen compte pour 40 % [D1], selon le doyen .");
    expect(a.sources.map((s) => s.ref)).toEqual(["D1"]);
  });

  it("says when the documents do not contain the answer", async () => {
    await save();
    llm.enabled = true;
    llm.reply = { answer: "Les extraits ne le disent pas.", citations: [], missing: true };
    expect(await askDocuments("alice", "examen final salle")).toMatchObject({ missing: true, sources: [] });
  });

  it("summarises without a model, labelled as an extract, and keeps it with the document", async () => {
    const saved = await save();
    if ("error" in saved) throw new Error(saved.error);
    const s = await summarizeDocument("alice", saved.id);
    expect(s).toMatchObject({ by: "extract", actions: ["Le laboratoire 3 doit être remis avant le 20 novembre."] });
    expect((await listDocuments("alice"))[0].summary).toMatchObject({ by: "extract" });
    expect(await summarizeDocument("alice", "bob-doc")).toEqual({ error: "Document introuvable." });
  });

  it("deletes only the owner's document", async () => {
    expect(await deleteDocument("alice", "bob-doc")).toBe(false);
    expect(await deleteDocumentAction("bob-doc")).toEqual({ error: "Document introuvable." });
    expect(db.trackerEntry.rows.map((r) => r.id)).toEqual(["bob-doc"]);
  });

  it("validates questions and turns chosen actions into the user's tasks", async () => {
    expect(await askDocumentsAction("  ")).toEqual({ error: "Pose une question." });
    db.$transaction = (ops: Promise<unknown>[]) => Promise.all(ops);
    expect(await tasksFromDocumentAction(["Remettre le labo 3", "", 42 as unknown as string])).toEqual({ ok: true, count: 1 });
    expect(db.task.rows).toMatchObject([{ userId: "alice", title: "Remettre le labo 3", status: "ToDo" }]);
    expect(await tasksFromDocumentAction([])).toMatchObject({ error: expect.any(String) });
  });
});
