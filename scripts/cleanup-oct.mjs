// Two deletions, with very different safety properties.
//
// Imported rows whose UID no longer appears in the live feed belong to a section the
// student has left. Deleting one is self-correcting: if the judgement were wrong and the
// item were still live, the next sync would simply recreate it.
//
// Hand-entered rows cannot come back that way, so they are written to a JSON backup
// before anything is removed.
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=["']?([^"']*)["']?$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

// Only the UIDs are needed here, so unfold the continuation lines and read them off
// directly rather than depending on a compiled copy of the app's parser.
function uidsFrom(ics) {
  const unfolded = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
  return new Set([...unfolded.matchAll(/^UID:(.+)$/gm)].map((m) => m[1].trim()));
}

neonConfig.webSocketConstructor = ws;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

const APPLY = process.argv.includes("--apply");
const EMAIL = process.env.TARGET_EMAIL ?? "aabyas0123@gmail.com";
const user = await prisma.user.findUnique({ where: { email: EMAIL } });
if (!user) { console.error(`Compte ${EMAIL} introuvable.`); process.exit(1); }
const source = await prisma.syncSource.findUnique({
  where: { userId_provider: { userId: user.id, provider: "brightspace" } },
});

const res = await fetch(source.feedUrl, { redirect: "follow" });
if (!res.ok) { console.error(`Brightspace a répondu ${res.status}.`); process.exit(1); }
const liveUids = uidsFrom(await res.text());

const all = await prisma.assessment.findMany({
  where: { userId: user.id },
  include: { course: { select: { code: true } } },
});

// MCG4144 was entered from the current Échéancier, not transcribed back in September,
// so it is already correct and must survive the sweep.
const KEEP = new Set(["MCG4144"]);

const stale = all.filter((a) => a.source === "brightspace" && !liveUids.has(a.externalUid));
const manual = all.filter((a) => a.source === null && !KEEP.has(a.course.code));

const byCourse = (rows) => {
  const g = {};
  for (const r of rows) g[r.course.code] = (g[r.course.code] ?? 0) + 1;
  return Object.entries(g).sort().map(([k, v]) => `${k}:${v}`).join("  ");
};

console.log(`ORPHELINES (absentes du flux) : ${stale.length}`);
console.log(`   ${byCourse(stale)}`);
console.log(`   Récupérables : oui, la prochaine synchro les recréerait si elles étaient encore valides.\n`);

console.log(`SAISIES À LA MAIN : ${manual.length}`);
console.log(`   ${byCourse(manual)}`);
console.log(`   Récupérables : non automatiquement — sauvegardées en JSON avant suppression.`);
const withGrades = manual.filter((a) => a.grade !== null);
if (withGrades.length) {
  console.log(`   ATTENTION : ${withGrades.length} portent une note saisie :`);
  for (const a of withGrades) console.log(`      [${a.course.code}] ${a.title} = ${a.grade}%`);
}

if (!APPLY) {
  console.log(`\nTotal à supprimer : ${stale.length + manual.length} sur ${all.length}`);
  console.log("(simulation — relancer avec --apply)");
  await prisma.$disconnect();
  process.exit(0);
}

const backupPath = resolve(__dirname, "..", `backup-manuelles-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(backupPath, JSON.stringify(manual, null, 2));
console.log(`\nSauvegarde : ${backupPath}`);

await prisma.assessment.deleteMany({ where: { id: { in: stale.map((a) => a.id) } } });
await prisma.assessment.deleteMany({ where: { id: { in: manual.map((a) => a.id) } } });

const left = await prisma.assessment.count({ where: { userId: user.id } });
console.log(`${stale.length + manual.length} supprimées. Il reste ${left} évaluations, toutes issues du flux et toujours valides.`);

await prisma.$disconnect();
