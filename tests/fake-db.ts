/**
 * A tiny in-memory stand-in for the Prisma client, covering only the calls the code under
 * test makes. Enough to check who can touch which row without a database.
 */
type Row = Record<string, unknown> & { id: string };

const match = (row: Row, where: Record<string, unknown> = {}): boolean =>
  Object.entries(where).every(([k, v]) => {
    if (k === "NOT") return !match(row, v as Record<string, unknown>);
    if (v && typeof v === "object" && !(v instanceof Date)) {
      const op = v as Record<string, unknown>;
      const x = row[k] as number | Date;
      return Object.entries(op).every(([o, w]) => {
        const y = w as number | Date;
        if (o === "in") return (w as unknown[]).includes(row[k]);
        if (o === "notIn") return !(w as unknown[]).includes(row[k]);
        if (o === "not") return row[k] !== w;
        if (o === "lt") return x < y;
        if (o === "lte") return x <= y;
        if (o === "gt") return x > y;
        if (o === "gte") return x >= y;
        if (o === "startsWith") return String(row[k] ?? "").startsWith(String(w));
        throw new Error(`fake-db: unsupported filter ${o}`);
      });
    }
    return row[k] === v;
  });

type Query = { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[]; skip?: number; take?: number };

const query = (rows: Row[], { where, orderBy, skip = 0, take }: Query = {}) => {
  const found = rows.filter((r) => match(r, where));
  for (const o of (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).reverse()) {
    const [[k, dir]] = Object.entries(o);
    found.sort((a, b) => ((a[k] as number) < (b[k] as number) ? -1 : (a[k] as number) > (b[k] as number) ? 1 : 0) * (dir === "desc" ? -1 : 1));
  }
  return found.slice(skip, take == null ? undefined : skip + take);
};

/** `unique` lists fields that must be unique together, as a Prisma @@unique would. */
export function table(rows: Row[] = [], opts: { unique?: string[] } = {}) {
  let next = 1;
  const t = {
    rows,
    findFirst: async (q: Query = {}) => query(rows, q)[0] ?? null,
    findMany: async (q: Query = {}) => query(rows, q),
    count: async ({ where }: { where?: Record<string, unknown> } = {}) => rows.filter((r) => match(r, where)).length,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const u = opts.unique;
      if (u && rows.some((r) => u.every((k) => r[k] === data[k]))) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      const row = { id: `new${next++}`, createdAt: new Date(Date.now() + next), ...data } as Row;
      rows.push(row);
      return row;
    },
    createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
      for (const d of data) rows.push({ id: `new${next++}`, ...d } as Row);
      return { count: data.length };
    },
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = rows.find((r) => match(r, where));
      if (!row) throw new Error("Record to update not found.");
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    delete: async ({ where }: { where: Record<string, unknown> }) => {
      const i = rows.findIndex((r) => match(r, where));
      if (i < 0) throw new Error("Record to delete does not exist.");
      return rows.splice(i, 1)[0];
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i], where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
  };
  return t;
}
