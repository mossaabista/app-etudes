/**
 * The global task list: what the filters in the address bar mean. Pure, so the same
 * reading is used by the page and the tests; anything unknown falls back to the default.
 */

export type StatusFilter = "open" | "done" | "all";
export type DueFilter = "any" | "overdue" | "today" | "week" | "none";
export type SortKey = "due" | "priority" | "recent";

export interface TaskQuery {
  q: string;
  status: StatusFilter;
  due: DueFilter;
  area: string | null;
  sort: SortKey;
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseTaskQuery(params: Record<string, string | string[] | undefined>): TaskQuery {
  const area = one(params.area);
  return {
    q: (one(params.q) ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    status: pick(one(params.status), ["open", "done", "all"] as const, "open"),
    due: pick(one(params.due), ["any", "overdue", "today", "week", "none"] as const, "any"),
    area: area && /^[a-z0-9-]{1,40}$/.test(area) ? area : null,
    sort: pick(one(params.sort), ["due", "priority", "recent"] as const, "due"),
  };
}

/** Prisma filter for one user's top-level tasks. `dayStart` is the start of today (wall time). */
export function taskWhere(userId: string, q: TaskQuery, dayStart: Date) {
  const day = 86400000;
  const tomorrow = new Date(dayStart.getTime() + day);
  const week = new Date(dayStart.getTime() + 7 * day);
  const due =
    q.due === "overdue"
      ? { dueDate: { lt: dayStart } }
      : q.due === "today"
        ? { dueDate: { gte: dayStart, lt: tomorrow } }
        : q.due === "week"
          ? { dueDate: { gte: dayStart, lt: week } }
          : q.due === "none"
            ? { dueDate: null }
            : {};
  return {
    userId,
    parentId: null,
    ...(q.status === "open" ? { status: { not: "Done" } } : q.status === "done" ? { status: "Done" } : {}),
    ...(q.q ? { title: { contains: q.q, mode: "insensitive" as const } } : {}),
    ...(q.area ? { category: { startsWith: `${q.area}:` } } : {}),
    ...due,
  };
}

export const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/** Sorted in memory: priority is a word, and tasks without a date go last. */
export function sortTasks<T extends { dueDate: Date | null; priority: string; createdAt: Date }>(tasks: T[], sort: SortKey): T[] {
  const due = (t: T) => t.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return [...tasks].sort((a, b) =>
    sort === "recent"
      ? b.createdAt.getTime() - a.createdAt.getTime()
      : sort === "priority"
        ? (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || due(a) - due(b)
        : due(a) - due(b) || (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
  );
}

export const queryString = (q: TaskQuery, patch: Partial<TaskQuery> = {}) => {
  const m = { ...q, ...patch };
  const p = new URLSearchParams();
  if (m.q) p.set("q", m.q);
  if (m.status !== "open") p.set("status", m.status);
  if (m.due !== "any") p.set("due", m.due);
  if (m.area) p.set("area", m.area);
  if (m.sort !== "due") p.set("sort", m.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
};
