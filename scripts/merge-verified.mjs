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

// Each pair was read and confirmed by hand against the course listings: same course,
// same due date, unmistakably the same deliverable under two naming conventions.
// The manual row carries the weight from the syllabus; the Brightspace row carries the
// authoritative date. Keep the Brightspace row (a re-sync would overwrite any title we
// set here anyway) and move the weight onto it.
const PAIRS = [
  // CHM1711 — titles I mistyped from a screenshot last session
  ["CHM1711", "Devoir: Nomenclature oxacides et oxanions", "Nomenclature des oxacides et oxanions"],
  ["CHM1711", "Devoir: Première loi de la thermo", "Première loi de la thermodynamique"],
  ["CHM1711", "Devoir: Solubilité composés ioniques", "Solubilité des composés ioniques"],

  // MCG2530 — the prof numbers them D1..D6 in Brightspace
  ["MCG2530", "Devoir 1", "D1"],
  ["MCG2530", "Devoir 2", "D2"],
  ["MCG2530", "Devoir 3", "D3"],
  ["MCG2530", "Devoir 4", "D4"],
  ["MCG2530", "Devoir 5", "D5"],
  ["MCG2530", "Devoir 6", "D6"],

  // GNG1503 — syllabus calls them LP-x, Brightspace calls them Livrable x
  ["GNG1503", "Devoir 1 — Réflexion initiale", "Devoir 1- Personnalité et réflexion 1"],
  ["GNG1503", "LP-A: Formation d'équipe", "Livrable A - Contrat"],
  ["GNG1503", "LP-B: Empathie & Définition", "Livrable B - Empathie et définition"],
  ["GNG1503", "LP-C: Idéation", "Livrable C - Idéation"],
  ["GNG1503", "LP-D: Concept Détaillé & Plan", "Livrable D - Concepts détaillés et plan"],
  ["GNG1503", "LP-E: Prototypage & Tests Ciblés", "Livrable E - Prototypage et essais ciblés à faible fidélité"],
  ["GNG1503", "LP-F: Prototypage & Tests Complets", "Livrable F - Prototypage et essais complet"],
  ["GNG1503", "LP-I: Manuel d'utilisateur", "Livrable I - Manuel d'utilisateur et du produit"],
];

const courses = await prisma.course.findMany({ select: { id: true, code: true } });
const courseId = Object.fromEntries(courses.map((c) => [c.code, c.id]));

let merged = 0;
const problems = [];

for (const [code, manualTitle, feedTitle] of PAIRS) {
  const id = courseId[code];
  const manual = await prisma.assessment.findMany({ where: { courseId: id, title: manualTitle, source: null } });
  const feed = await prisma.assessment.findMany({ where: { courseId: id, title: feedTitle, source: "brightspace" } });

  if (manual.length !== 1 || feed.length !== 1) {
    problems.push(`${code}: « ${manualTitle} » -> ${manual.length} manuelle(s), « ${feedTitle} » -> ${feed.length} importée(s)`);
    continue;
  }

  const m = manual[0];
  const f = feed[0];
  const data = {};
  if (m.weight !== null && f.weight === null) data.weight = m.weight;
  if (m.grade !== null && f.grade === null) data.grade = m.grade;
  if (m.notes !== null && f.notes === null) data.notes = m.notes;
  if (m.status !== "Upcoming" && f.status === "Upcoming") data.status = m.status;

  console.log(`  [${code}] « ${manualTitle} » (${m.weight ?? "—"}%) -> « ${feedTitle} »`);

  if (APPLY) {
    if (Object.keys(data).length > 0) await prisma.assessment.update({ where: { id: f.id }, data });
    await prisma.assessment.delete({ where: { id: m.id } });
  }
  merged++;
}

if (problems.length) {
  console.log(`\nNon traitées (${problems.length}) :`);
  for (const p of problems) console.log(`  ${p}`);
}

console.log(`\n${merged}/${PAIRS.length} paires ${APPLY ? "fusionnées" : "prêtes (simulation)"}.`);
if (!APPLY) console.log("Relancer avec --apply pour fusionner.");

await prisma.$disconnect();
