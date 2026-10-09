"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { askDocuments, deleteDocument, extractDocument, saveDocument, summarizeDocument, type Answer, type DocMeta, type Summary } from "@/server/documents";
import { allow } from "@/server/rate-limit";

export async function uploadDocumentAction(form: FormData): Promise<DocMeta | { error: string }> {
  const user = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choisis un fichier." };
  const doc = await extractDocument(file.name, new Uint8Array(await file.arrayBuffer()));
  if ("error" in doc) return doc;
  const saved = await saveDocument(user.id, file.name, file.size, doc);
  revalidatePath("/documents");
  return saved;
}

export async function deleteDocumentAction(id: string) {
  const user = await requireUser();
  const ok = await deleteDocument(user.id, String(id));
  revalidatePath("/documents");
  return ok ? { ok: true as const } : { error: "Document introuvable." };
}

export async function summarizeDocumentAction(id: string): Promise<Summary | { error: string }> {
  const user = await requireUser();
  if (!allow(user.id, "llm")) return { error: "Trop de demandes d'un coup : réessaie dans une minute." };
  return summarizeDocument(user.id, String(id));
}

export async function askDocumentsAction(question: string, docId?: string): Promise<Answer | { error: string }> {
  const user = await requireUser();
  const q = String(question ?? "").trim().slice(0, 500);
  if (q.length < 3) return { error: "Pose une question." };
  if (!allow(user.id, "llm")) return { error: "Trop de demandes d'un coup : réessaie dans une minute." };
  return askDocuments(user.id, q, docId || undefined);
}

/** Turn chosen action items of a document into tasks, unsorted for the user to file. */
export async function tasksFromDocumentAction(items: string[]) {
  const user = await requireUser();
  const titles = (Array.isArray(items) ? items : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 200)).slice(0, 20);
  if (!titles.length) return { error: "Choisis au moins une action." };
  const created = await prisma.$transaction(titles.map((title) => prisma.task.create({ data: { userId: user.id, title, status: "ToDo", priority: "Medium" } })));
  revalidatePath("/", "layout");
  return { ok: true as const, count: created.length };
}
