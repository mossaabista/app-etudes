import { prisma } from "@/lib/db";

/**
 * The conversation shown on the Assistant page: the user's sentences and OROM's replies,
 * with how each request ended. Kept per user, the latest 100 turns only, and erasable in
 * one tap. Only the Assistant page records turns, and says so.
 */

export const CONVERSATION_MODULE = "app:conversation";
export const KEEP_TURNS = 100;

export type Outcome = "done" | "partial" | "failed" | "answer" | "confirm" | "cancelled";

export interface ConversationTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  outcome: Outcome | null;
  at: string;
}

export async function listTurns(userId: string, take = 50): Promise<ConversationTurn[]> {
  const rows = await prisma.trackerEntry.findMany({
    where: { userId, module: CONVERSATION_MODULE, kind: "turn" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, text: true, data: true, createdAt: true },
  });
  return rows.reverse().map((r) => {
    const d = (r.data ?? {}) as { role?: string; outcome?: Outcome };
    return { id: r.id, role: d.role === "assistant" ? "assistant" : "user", text: r.text ?? "", outcome: d.outcome ?? null, at: r.createdAt.toISOString() };
  });
}

export async function appendTurns(userId: string, turns: { role: "user" | "assistant"; text: string; outcome?: Outcome | null }[]) {
  const base = Date.now();
  for (const [i, t] of turns.entries()) {
    const text = t.text.trim().slice(0, 2000);
    if (!text) continue;
    await prisma.trackerEntry.create({
      data: { userId, module: CONVERSATION_MODULE, kind: "turn", text, data: { role: t.role, outcome: t.outcome ?? null }, createdAt: new Date(base + i) },
    });
  }
  const edge = await prisma.trackerEntry.findMany({ where: { userId, module: CONVERSATION_MODULE, kind: "turn" }, orderBy: { createdAt: "desc" }, skip: KEEP_TURNS, take: 1, select: { createdAt: true } });
  if (edge.length) await prisma.trackerEntry.deleteMany({ where: { userId, module: CONVERSATION_MODULE, createdAt: { lte: edge[0].createdAt } } });
}

export async function clearTurns(userId: string) {
  const { count } = await prisma.trackerEntry.deleteMany({ where: { userId, module: CONVERSATION_MODULE } });
  return count;
}
