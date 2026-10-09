import { prisma } from "@/lib/db";
import type { Undo } from "@/server/actions/capture.actions";

/**
 * The assistant's log of what it changed (the AgentAction table). Three jobs: answer
 * "what did you change?", undo the last change from the server, and run a repeated
 * request only once. The table is created by scripts/migrate-agent-log.mjs; until it
 * exists every function here reports "unavailable" and the app behaves as before, so the
 * log can never break a command.
 */

/** Rows kept per user; older ones are pruned on write. */
export const KEEP = 200;
/** How long a logged change can still be undone from the server. */
export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface LoggedAction {
  id: string;
  opId: string;
  source: string;
  status: string;
  summary: string;
  undo: Undo | null;
  createdAt: Date;
  undoneAt: Date | null;
}

let warned = false;
const unavailable = (e: unknown) => {
  if (!warned) {
    warned = true;
    console.warn("[agent-log] journal indisponible (table AgentAction absente ?) :", e instanceof Error ? e.message.split("\n")[0] : e);
  }
  return "unavailable" as const;
};
const isDuplicate = (e: unknown) => !!e && typeof e === "object" && (e as { code?: string }).code === "P2002";

/**
 * Reserve an operation id before running it. A second request with the same id gets
 * "duplicate" and must not run; "unavailable" means no log, so no protection either.
 */
export async function claim(userId: string, opId: string, source: string): Promise<"claimed" | "duplicate" | "unavailable"> {
  try {
    await prisma.agentAction.create({ data: { userId, opId, source, status: "running", summary: "" } });
    return "claimed";
  } catch (e) {
    return isDuplicate(e) ? "duplicate" : unavailable(e);
  }
}

/** Record how a claimed operation ended. Nothing changed: the claim is dropped. */
export async function settle(userId: string, opId: string, outcome: { changed: boolean; partial?: boolean; summary: string; undo: Undo | null }) {
  try {
    if (!outcome.changed) {
      await prisma.agentAction.deleteMany({ where: { userId, opId } });
      return;
    }
    await prisma.agentAction.updateMany({
      where: { userId, opId },
      data: { status: outcome.partial ? "partial" : "done", summary: outcome.summary.slice(0, 1000), undo: outcome.undo ? JSON.parse(JSON.stringify(outcome.undo)) : undefined },
    });
    await prune(userId);
  } catch (e) {
    unavailable(e);
  }
}

async function prune(userId: string) {
  const edge = await prisma.agentAction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: KEEP, take: 1, select: { createdAt: true } });
  if (edge.length) await prisma.agentAction.deleteMany({ where: { userId, createdAt: { lte: edge[0].createdAt } } });
}

/** The row for an operation id, to tell a repeated request what happened the first time. */
export async function findOp(userId: string, opId: string): Promise<LoggedAction | null> {
  try {
    return (await prisma.agentAction.findFirst({ where: { userId, opId } })) as LoggedAction | null;
  } catch (e) {
    unavailable(e);
    return null;
  }
}

/** The latest changes, newest first. Null when there is no log to read. */
export async function recentActions(userId: string, take = 10): Promise<LoggedAction[] | null> {
  try {
    return (await prisma.agentAction.findMany({ where: { userId, status: { in: ["done", "partial", "undone"] } }, orderBy: { createdAt: "desc" }, take })) as LoggedAction[];
  } catch (e) {
    unavailable(e);
    return null;
  }
}

/** Flag an operation as undone, scoped to its owner. */
export async function markUndone(userId: string, id: { id?: string; opId?: string }) {
  if (!id.id && !id.opId) return;
  try {
    await prisma.agentAction.updateMany({ where: { userId, ...(id.id ? { id: id.id } : { opId: id.opId }), status: { not: "undone" } }, data: { status: "undone", undoneAt: new Date() } });
  } catch (e) {
    unavailable(e);
  }
}

/** A logged change can be undone from the server for a day, once. */
export const isUndoable = (r: LoggedAction, now = Date.now()) => r.status !== "undone" && !!r.undo && now - r.createdAt.getTime() < UNDO_WINDOW_MS;

/** The history as the settings page shows it. Null when there is no log to read. */
export async function historyRows(userId: string, take = 15) {
  const rows = await recentActions(userId, take);
  const now = Date.now();
  return rows?.map((r) => ({ id: r.id, createdAt: r.createdAt, summary: r.summary, status: r.status, canUndo: isUndoable(r, now) })) ?? null;
}
