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

const sources = await prisma.syncSource.findMany();
console.log(`Sources configurées : ${sources.length}`);
for (const s of sources) {
  console.log(`  ${s.provider} @ ${new URL(s.feedUrl).host}`);
  console.log(`    statut  : ${s.lastStatus ?? "—"}`);
  console.log(`    message : ${s.lastMessage ?? "—"}`);
  console.log(`    synchro : ${s.lastSyncedAt?.toISOString() ?? "jamais"}`);
}

const imported = await prisma.assessment.findMany({
  where: { source: "brightspace" },
  include: { course: { select: { code: true } } },
  orderBy: { dueDate: "asc" },
});

console.log(`\nÉvaluations importées de Brightspace : ${imported.length}`);
const byCourse = {};
for (const a of imported) (byCourse[a.course.code] ??= []).push(a);
for (const [code, list] of Object.entries(byCourse).sort()) {
  console.log(`  ${code} : ${list.length}`);
}

if (imported.length) {
  console.log(`\n15 prochaines échéances importées :`);
  const now = new Date();
  for (const a of imported.filter((a) => a.dueDate && a.dueDate >= now).slice(0, 15)) {
    console.log(`  ${a.dueDate.toISOString().slice(0, 16).replace("T", " ")} [${a.course.code}] ${a.type.padEnd(10)} ${a.title.slice(0, 55)}`);
  }
}

await prisma.$disconnect();
