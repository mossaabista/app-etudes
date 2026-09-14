import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=["']?([^"']*)["']?$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const filter = process.argv[2];
const all = await prisma.assessment.findMany({
  include: { course: { select: { code: true } } },
  orderBy: { dueDate: "asc" },
});

const day = (d) =>
  d ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "short" }).format(d) : "sans date";

for (const code of [...new Set(all.map((a) => a.course.code))].sort()) {
  if (filter && code !== filter) continue;
  const rows = all.filter((a) => a.course.code === code);
  const manual = rows.filter((a) => a.source === null);
  const synced = rows.filter((a) => a.source === "brightspace");
  console.log(`\n=== ${code} — ${manual.length} manuelles, ${synced.length} importées ===`);
  const line = (a) => `    ${day(a.dueDate).padEnd(10)} ${String(a.weight ?? "—").padStart(5)}%  ${a.title}`;
  console.log(`  -- manuelles --`);
  for (const a of manual) console.log(line(a));
  console.log(`  -- importées --`);
  for (const a of synced) console.log(line(a));
}

await prisma.$disconnect();
