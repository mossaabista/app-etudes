// Compares every imported assessment against what the Brightspace feed carries right
// now. An item whose UID has disappeared from the feed belongs to a course section the
// student has left, so it is stale and no longer reflects anything they have to do.
// Read-only.
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=["']?([^"']*)["']?$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const { parseIcs } = await import(pathToFileURL(resolve(process.env.ICS_BUILD, "ics.js")).href);

neonConfig.webSocketConstructor = ws;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

const user = await prisma.user.findUnique({ where: { email: process.env.TARGET_EMAIL } });
const source = await prisma.syncSource.findUnique({
  where: { userId_provider: { userId: user.id, provider: "brightspace" } },
});
if (!source) { console.error("Aucun flux configuré."); process.exit(1); }

const res = await fetch(source.feedUrl, { redirect: "follow" });
if (!res.ok) { console.error(`Brightspace a répondu ${res.status}.`); process.exit(1); }
const events = parseIcs(await res.text());
const liveUids = new Set(events.map((e) => e.uid));

const imported = await prisma.assessment.findMany({
  where: { userId: user.id, source: "brightspace" },
  include: { course: { select: { code: true } } },
  orderBy: { dueDate: "asc" },
});

const stale = imported.filter((a) => !liveUids.has(a.externalUid));
const live = imported.filter((a) => liveUids.has(a.externalUid));

console.log(`Flux : ${events.length} événements, ${liveUids.size} identifiants uniques`);
console.log(`Importées en base : ${imported.length}`);
console.log(`  toujours dans le flux : ${live.length}`);
console.log(`  DISPARUES du flux     : ${stale.length}\n`);

const byCourse = {};
for (const a of stale) (byCourse[a.course.code] ??= []).push(a);

const now = new Date();
for (const code of Object.keys(byCourse).sort()) {
  const rows = byCourse[code];
  const future = rows.filter((a) => a.dueDate && a.dueDate >= now).length;
  console.log(`${code} — ${rows.length} disparues (${future} encore à venir)`);
  for (const a of rows.slice(0, 12)) {
    const d = a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "sans date";
    console.log(`   ${d}  ${a.title.slice(0, 62)}`);
  }
  if (rows.length > 12) console.log(`   … et ${rows.length - 12} autres`);
  console.log();
}

const liveByCourse = {};
for (const a of live) (liveByCourse[a.course.code] ??= []).push(a);
console.log("Toujours valides, par cours :");
for (const code of Object.keys(liveByCourse).sort()) {
  console.log(`  ${code.padEnd(10)} ${liveByCourse[code].length}`);
}

await prisma.$disconnect();
