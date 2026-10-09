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
      if ("in" in op) return (op.in as unknown[]).includes(row[k]);
      if ("not" in op) return row[k] !== op.not;
      return true;
    }
    return row[k] === v;
  });

export function table(rows: Row[] = []) {
  let next = 1;
  const t = {
    rows,
    findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => rows.find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => rows.filter((r) => match(r, where)),
    count: async ({ where }: { where?: Record<string, unknown> } = {}) => rows.filter((r) => match(r, where)).length,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `new${next++}`, ...data } as Row;
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
