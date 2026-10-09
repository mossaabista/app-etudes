import { prisma } from "@/lib/db";

/**
 * What the assistant remembers about the user: only what the user explicitly asked it to
 * remember ("retiens que je préfère le sport le soir"), visible and deletable in
 * Settings, and given to the model as data, never as orders. Nothing is ever added on the
 * assistant's own initiative.
 */

export const MEMORY_MODULE = "app:memory";
export const MAX_FACTS = 30;
const MAX_LENGTH = 200;

export interface Fact {
  id: string;
  text: string;
  createdAt: Date;
}

export async function listFacts(userId: string): Promise<Fact[]> {
  const rows = await prisma.trackerEntry.findMany({ where: { userId, module: MEMORY_MODULE, kind: "fact" }, orderBy: { createdAt: "asc" }, select: { id: true, text: true, createdAt: true } });
  return rows.filter((r) => r.text).map((r) => ({ id: r.id, text: r.text!, createdAt: r.createdAt }));
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Remember one thing. Refuses duplicates and a full memory, and says why. */
export async function addFact(userId: string, text: string): Promise<{ fact: Fact } | { error: string }> {
  const clean = text.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  if (clean.length < 3) return { error: "Dis-moi ce que je dois retenir." };
  if (clean.length > MAX_LENGTH) return { error: `C'est trop long à retenir (${MAX_LENGTH} caractères au plus).` };
  const facts = await listFacts(userId);
  if (facts.some((f) => norm(f.text) === norm(clean))) return { error: "Je le sais déjà." };
  if (facts.length >= MAX_FACTS) return { error: `Ma mémoire est pleine (${MAX_FACTS} éléments) : supprimes-en un dans les Réglages.` };
  const row = await prisma.trackerEntry.create({ data: { userId, module: MEMORY_MODULE, kind: "fact", text: clean } });
  return { fact: { id: row.id, text: clean, createdAt: row.createdAt } };
}

/** Forget the facts that mention these words. Returns what was forgotten. */
export async function forgetFacts(userId: string, about: string): Promise<string[]> {
  const words = norm(about).split(" ").filter((w) => w.length >= 3);
  if (!words.length) return [];
  const facts = (await listFacts(userId)).filter((f) => words.every((w) => norm(f.text).includes(w)));
  if (!facts.length) return [];
  await prisma.trackerEntry.deleteMany({ where: { userId, module: MEMORY_MODULE, id: { in: facts.map((f) => f.id) } } });
  return facts.map((f) => f.text);
}

export async function deleteFact(userId: string, id: string) {
  const { count } = await prisma.trackerEntry.deleteMany({ where: { userId, module: MEMORY_MODULE, id } });
  return count > 0;
}
