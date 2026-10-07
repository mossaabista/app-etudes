// MCG4144 from the student's own Échéancier (6 Oct 2026). The course was created empty
// with the timetable fix, so every row here is new — nothing can collide.
// Weighting: 10 quizzes 50 % · team project 20 % · final report 30 %.
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
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

const APPLY = process.argv.includes("--apply");
const TZ = "America/Toronto";

function at(y, mo, d, h, mi) {
  const offset = (utcMs) => {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const g = (t) => Number(p.find((x) => x.type === t)?.value ?? "0");
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second")) - utcMs;
  };
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  return new Date(naive - offset(naive - offset(naive, TZ), TZ));
}

const LATE = "Retard : −20 % par jour, pour toute l'équipe.";
const BEFORE_CLASS = "À remettre AVANT le cours. Note de 0 si en retard.";

const ITEMS = [
  { title: "Formation des équipes", type: "Project", weight: null, due: at(2026, 9, 22, 13, 0), notes: "Équipes de 4, obligatoires avant le 22 sept." },

  { title: "Quiz 1 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 9, 28, 13, 0), notes: BEFORE_CLASS },
  { title: "Quiz 2 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 10, 5, 13, 0), notes: BEFORE_CLASS },
  { title: "Quiz 3 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 10, 14, 11, 30), notes: BEFORE_CLASS },
  { title: "Quiz 4 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 10, 21, 11, 30), notes: BEFORE_CLASS },
  { title: "Quiz 5 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 11, 4, 11, 30), notes: BEFORE_CLASS },
  { title: "Quiz 6 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 11, 11, 11, 30), notes: BEFORE_CLASS },
  { title: "Quiz 7 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 11, 18, 11, 30), notes: BEFORE_CLASS },
  { title: "Quiz 8 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 11, 25, 11, 30), notes: BEFORE_CLASS },
  { title: "Quiz 9 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 12, 2, 11, 30), notes: BEFORE_CLASS },
  { title: "Quiz 10 (individuel, Brightspace)", type: "Quiz", weight: 5, due: at(2026, 12, 9, 13, 0), notes: "Le 9 déc. suit l'horaire du lundi : remise avant 13 h." },

  { title: "Travail de projet 1 (équipe de 4)", type: "Project", weight: 3, due: at(2026, 10, 14, 11, 30), notes: `${LATE} Les rétroactions servent au rapport final.` },
  { title: "Travail de projet 2 (équipe de 4)", type: "Project", weight: 3, due: at(2026, 10, 21, 11, 30), notes: LATE },
  { title: "Travail de projet 3 (équipe de 4)", type: "Project", weight: 3, due: at(2026, 11, 4, 11, 30), notes: LATE },
  { title: "Travail de projet 4 (équipe de 4)", type: "Project", weight: 3, due: at(2026, 11, 11, 11, 30), notes: LATE },
  { title: "Travail de projet 5 (équipe de 4)", type: "Project", weight: 3, due: at(2026, 11, 18, 11, 30), notes: LATE },
  { title: "Travail de projet 6 (équipe de 4)", type: "Project", weight: 3, due: at(2026, 11, 30, 13, 0), notes: LATE },
  { title: "Travail de projet 7 (équipe de 4)", type: "Project", weight: 3, due: at(2026, 12, 7, 13, 0), notes: LATE },

  { title: "Rapport final du projet", type: "Report", weight: 30, due: at(2026, 12, 14, 9, 0), notes: "Tient lieu d'examen final — il n'y a pas d'examen en salle. « Avant le 14 déc. » vise le dimanche 13 déc. Aucun retard accepté : note de 0." },
];

const user = await prisma.user.findUnique({ where: { email: "aabyas0123@gmail.com" } });
const course = await prisma.course.findFirst({ where: { userId: user.id, code: "MCG4144" } });
if (!course) { console.error("MCG4144 introuvable — lancer d'abord fix-schedule-oct.mjs."); process.exit(1); }

const existing = await prisma.assessment.count({ where: { userId: user.id, courseId: course.id } });
console.log(`MCG4144 contient ${existing} évaluation(s) avant insertion.\n`);

const fmt = (d) => new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(d);
let total = 0;
for (const i of ITEMS) {
  console.log(`  ${String(i.weight ?? "—").padStart(3)}%  ${fmt(i.due).padEnd(18)} ${i.title}`);
  total += i.weight ?? 0;
}
console.log(`\n${ITEMS.length} éléments, ${total} % au total (quiz 50 + projet 21 + rapport 30).`);

if (!APPLY) {
  console.log("(simulation — relancer avec --apply)");
  await prisma.$disconnect();
  process.exit(0);
}

for (const i of ITEMS) {
  const dup = await prisma.assessment.findFirst({ where: { userId: user.id, courseId: course.id, title: i.title } });
  if (dup) { console.log(`  déjà présent, ignoré : ${i.title}`); continue; }
  await prisma.assessment.create({
    data: {
      userId: user.id, courseId: course.id, title: i.title, type: i.type,
      weight: i.weight, dueDate: i.due, status: "Upcoming", notes: i.notes,
    },
  });
}

const after = await prisma.assessment.count({ where: { userId: user.id, courseId: course.id } });
console.log(`\nMCG4144 contient maintenant ${after} évaluations.`);
await prisma.$disconnect();
