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

const APPLY = process.argv.includes("--apply");

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const torontoDay = (d) => (d ? dayFmt.format(d) : null);

// Strip accents, punctuation and the "Devoir:" prefix I used when seeding by hand.
const tokens = (title) =>
  title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*devoirs?\s*[:#-]?\s*/, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const canonical = (title) => tokens(title).join(" ");

const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter / (A.size + B.size - inter);
};

const all = await prisma.assessment.findMany({
  include: { course: { select: { code: true } } },
});
const manual = all.filter((a) => a.source === null);
const synced = all.filter((a) => a.source === "brightspace");

const exact = [];
const near = [];
const untouched = [];

for (const m of manual) {
  const day = torontoDay(m.dueDate);
  const candidates = synced.filter((s) => s.courseId === m.courseId && torontoDay(s.dueDate) === day);

  if (!day || candidates.length === 0) {
    untouched.push(m);
    continue;
  }

  const mc = canonical(m.title);
  const identical = candidates.filter((s) => canonical(s.title) === mc);

  // Only treat it as certain when exactly one feed item normalises to the same text.
  if (identical.length === 1) {
    exact.push({ manual: m, synced: identical[0] });
    continue;
  }

  const scored = candidates
    .map((s) => ({ s, score: jaccard(tokens(m.title), tokens(s.title)) }))
    .sort((a, b) => b.score - a.score);

  if (scored[0] && scored[0].score >= 0.6) {
    near.push({ manual: m, synced: scored[0].s, score: scored[0].score });
  } else {
    untouched.push(m);
  }
}

console.log(`Manuelles : ${manual.length} | Importées : ${synced.length}\n`);

console.log(`=== CORRESPONDANCE CERTAINE — ${exact.length} (le doublon manuel sera supprimé) ===`);
for (const { manual: m, synced: s } of exact) {
  const carry = m.weight !== null || m.grade !== null || m.notes !== null;
  console.log(`  [${m.course.code}] ${torontoDay(m.dueDate)}  « ${m.title} »`);
  console.log(`      == « ${s.title} »${carry ? `   (report : poids=${m.weight ?? "—"} note=${m.grade ?? "—"})` : ""}`);
}

console.log(`\n=== CORRESPONDANCE PROBABLE — ${near.length} (rien supprimé, à confirmer) ===`);
for (const { manual: m, synced: s, score } of near) {
  console.log(`  [${m.course.code}] ${torontoDay(m.dueDate)}  ${(score * 100).toFixed(0)}%`);
  console.log(`      manuel : « ${m.title} »  (poids=${m.weight ?? "—"})`);
  console.log(`      flux   : « ${s.title} »`);
}

console.log(`\n=== SANS DOUBLON — ${untouched.length} (intactes) ===`);
const byCourse = {};
for (const m of untouched) (byCourse[m.course.code] ??= []).push(m);
for (const [code, list] of Object.entries(byCourse).sort()) {
  console.log(`  ${code} : ${list.length}`);
}

if (!APPLY) {
  console.log(`\n(simulation — relancer avec --apply pour supprimer les ${exact.length} doublons certains)`);
  await prisma.$disconnect();
  process.exit(0);
}

let moved = 0;
for (const { manual: m, synced: s } of exact) {
  const data = {};
  if (m.weight !== null && s.weight === null) data.weight = m.weight;
  if (m.grade !== null && s.grade === null) data.grade = m.grade;
  if (m.notes !== null && s.notes === null) data.notes = m.notes;
  if (m.status !== "Upcoming" && s.status === "Upcoming") data.status = m.status;

  if (Object.keys(data).length > 0) {
    await prisma.assessment.update({ where: { id: s.id }, data });
    moved++;
  }
  await prisma.assessment.delete({ where: { id: m.id } });
}

console.log(`\n${exact.length} doublons supprimés, ${moved} avec report de pondération/note.`);
await prisma.$disconnect();
