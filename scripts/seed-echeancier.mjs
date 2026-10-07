// Fills the gaps the Brightspace feed leaves, from the student's own Échéancier
// (6 Oct 2026). The feed carries deliverables, quizzes and labs but never exams and
// never weights, so every exam was missing from the app entirely.
//
// Only items with no counterpart in the feed are listed here. Anything already imported
// is left alone, and a title guard per course stops a re-run from duplicating.
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

const FINAL_WINDOW = "Période d'examens du 10 au 22 déc. Date, heure et salle à confirmer.";

const ITEMS = {
  CHM1711: [
    { t: "Test 1 — section A", y: "Exam", w: 7, d: at(2026, 9, 23, 10, 0), n: "80 min, MRN 150. Différé possible le samedi." },
    { t: "Test 2 — section A", y: "Exam", w: 7, d: at(2026, 10, 14, 10, 0), n: "80 min, MRN 150. Différé sam. 17 oct. 14 h (inscription avant ven. 10 h)." },
    { t: "Test 3 — section A", y: "Exam", w: 7, d: at(2026, 11, 4, 10, 0), n: "80 min, MRN 150. Différé sam. 7 nov. 12 h." },
    { t: "Test 4 — section A", y: "Exam", w: 7, d: at(2026, 11, 18, 10, 0), n: "80 min, MRN 150. Différé sam. 21 nov. 12 h." },
    { t: "Test 5 — section A", y: "Exam", w: 7, d: at(2026, 12, 2, 10, 0), n: "80 min, MRN 150. Différé sam. 5 déc. 12 h." },
    { t: "Examen final", y: "Exam", w: 30, d: null, n: `${FINAL_WINDOW} Durée 3 h. Reçoit aussi le poids des tests manqués et des points Wooclap manquants.` },
    { t: "Laboratoire (ensemble)", y: "Lab", w: 15, d: null, n: "Tous les 2 vendredis, 18 h 30, MRN 301. Pré-lab avant, travail post-lab le lendemain. 80 % de présence et réussite obligatoires." },
    { t: "Devoirs Brightspace (ensemble)", y: "Assignment", w: 10, d: null, n: "Pondération globale des modules Brightspace, qui sont listés individuellement." },
    { t: "Wooclap (participation en classe)", y: "Quiz", w: 10, d: null, n: "En direct seulement (présentiel ou Zoom). Les points manqués passent à l'examen final." },
  ],

  MCG2530: [
    { t: "Examen de mi-session 1", y: "Exam", w: 20, d: at(2026, 10, 14, 13, 0), n: "Heure et salle à confirmer sur Brightspace." },
    { t: "Examen de mi-session 2", y: "Exam", w: 20, d: at(2026, 11, 18, 13, 0), n: "Heure et salle à confirmer sur Brightspace." },
    { t: "Examen final", y: "Exam", w: 44, d: null, n: `${FINAL_WINDOW} En personne. Si l'examen final < 40 %, il faut 55 % de note globale pour passer.` },
    { t: "Devoirs (ensemble, 6)", y: "Assignment", w: 16, d: null, n: "2,7 % chacun. Retard : −20 % par jour calendaire." },
  ],

  MCG4151: [
    { t: "Quiz 1 — Anatomie & physiologie", y: "Quiz", w: 2.9, d: at(2026, 9, 25, 14, 30), n: "Écrit pendant le DGD du vendredi. Pas de reprise." },
    { t: "Quiz 2 — Système musculo-squelettique & articulations", y: "Quiz", w: 2.9, d: at(2026, 10, 2, 14, 30), n: "Écrit pendant le DGD du vendredi. Pas de reprise." },
    { t: "Quiz 3 — Analyse de la marche", y: "Quiz", w: 2.9, d: at(2026, 10, 9, 14, 30), n: "Écrit pendant le DGD du vendredi. Pas de reprise." },
    { t: "Quiz 4 — Charges & mouvement", y: "Quiz", w: 2.9, d: at(2026, 10, 16, 14, 30), n: "Écrit pendant le DGD du vendredi." },
    { t: "Quiz 5 — Mécanique des tissus I", y: "Quiz", w: 2.9, d: at(2026, 10, 23, 14, 30), n: "Écrit pendant le DGD du vendredi." },
    { t: "Quiz 6 — Mécanique des tissus II, III", y: "Quiz", w: 2.9, d: at(2026, 11, 13, 14, 30), n: "Écrit pendant le DGD du vendredi." },
    { t: "Quiz 7 — Concepts de conception d'implants", y: "Quiz", w: 2.9, d: at(2026, 11, 27, 14, 30), n: "Écrit pendant le DGD du vendredi." },
    { t: "Examen final", y: "Exam", w: 30, d: null, n: `${FINAL_WINDOW} Révision en classe le 3 déc.` },
    { t: "Projet (ensemble)", y: "Project", w: 50, d: null, n: "Assignments 1 à 4, diapositives, présentations et rapport final. Retard : −5 % immédiat puis −5 % par jour, max 3 jours." },
    { t: "Règle des quiz", y: "Quiz", w: null, d: null, n: "Le pire quiz est retiré, puis le suivant est remplacé par la note du final si celle-ci est meilleure." },
  ],

  MCG4328: [
    { t: "Assignment 1 — Casting & machining (groupe)", y: "Assignment", w: 2.5, d: at(2026, 10, 16, 19, 0), n: "Une soumission par groupe. 6 questions, 100 points." },
    { t: "Assignment 2 (groupe)", y: "Assignment", w: 2.5, d: null, n: "Date non fournie pour l'instant." },
    { t: "Assignment 3 (groupe)", y: "Assignment", w: 2.5, d: null, n: "Date non fournie pour l'instant." },
    { t: "Assignment 4 (groupe)", y: "Assignment", w: 2.5, d: null, n: "Date non fournie pour l'instant." },
    { t: "Séance de laboratoire (groupe)", y: "Lab", w: null, d: at(2026, 10, 19, 13, 0), n: "Prépare le cahier de laboratoire AVANT (valeurs attendues, croquis) ; le démonstrateur le paraphe au début. Lab de coulée : 100 % coton, pantalon long, souliers fermés." },
    { t: "Rapport de laboratoire", y: "Lab", w: 2, d: at(2026, 11, 2, 23, 59), n: "Estimé : 2 semaines après le lab correspondant, à confirmer avec le TA. Un seul rapport par groupe." },
    { t: "Cahier de laboratoire (individuel)", y: "Lab", w: 2, d: null, n: "Remis avec le dernier rapport." },
    { t: "Examen de mi-session", y: "Exam", w: 20, d: at(2026, 11, 2, 19, 0), n: "Durée 1 h 10. Heure à confirmer." },
    { t: "Examen final", y: "Exam", w: 60, d: null, n: `${FINAL_WINDOW} Minimum de 50 % requis à cet examen pour réussir le cours.` },
  ],

  MCG4366: [
    { t: "Conceptual Design Report", y: "Report", w: 10, d: at(2026, 11, 20, 23, 59), n: "Max 25 pages. Évaluation par les pairs le même jour, obligatoire sinon note de défaillance." },
    { t: "Prototype Plan Report", y: "Report", w: null, d: at(2027, 1, 18, 23, 59), n: "Session d'hiver. Pas de points listés au barème." },
    { t: "Working Analysis Report", y: "Report", w: 10, d: at(2027, 2, 1, 23, 59), n: "Session d'hiver. FBD, contraintes, analyses de défaillance." },
    { t: "Economic and Ethical Considerations Report", y: "Report", w: 5, d: at(2027, 2, 26, 23, 59), n: "Session d'hiver." },
    { t: "Parameterization Report + code MATLAB", y: "Report", w: 5, d: at(2027, 3, 12, 23, 59), n: "Session d'hiver. Inclure le fichier MATLAB et un Readme." },
    { t: "Final Presentation and Poster", y: "Presentation", w: 5, d: at(2027, 4, 5, 23, 59), n: "Session d'hiver." },
    { t: "Capstone Project Report", y: "Report", w: 60, d: at(2027, 4, 12, 23, 59), n: "Session d'hiver. Max 120 pages. SolidWorks + MATLAB uniquement." },
  ],

  GNG1503: [
    { t: "Quiz 3", y: "Quiz", w: 3, d: at(2026, 10, 21, 23, 59), n: "Cours 9, 10, 11 + Idéation. Brightspace, livre ouvert, hors heures de cours." },
    { t: "Quiz 4", y: "Quiz", w: 3, d: at(2026, 11, 9, 23, 59), n: "Cours 12, 13, 14 + Prototypage/Tests. Brightspace, livre ouvert." },
    { t: "Quiz 5", y: "Quiz", w: 3, d: at(2026, 11, 25, 23, 59), n: "Cours 15, 17 + Empathie aux tests. Brightspace, livre ouvert." },
    { t: "Rencontre client 2 + visite du CGEC", y: "Project", w: null, d: at(2026, 10, 21, 19, 0), n: "Pendant le lab de la semaine 6." },
    { t: "Rencontre client 3 — présentation en classe", y: "Presentation", w: null, d: at(2026, 11, 11, 14, 30), n: "5 minutes par équipe." },
    { t: "LP-H — Soumission des présentations finales", y: "Project", w: 4, d: at(2026, 12, 1, 23, 59), n: "Sur Brightspace." },
    { t: "LP-G — Journée de conception (Design Day)", y: "Project", w: 5, d: at(2026, 12, 3, 9, 0), n: "Matériel à soumettre le 1er déc. (Makerepo + Brightspace)." },
    { t: "Présentations finales", y: "Presentation", w: null, d: at(2026, 12, 7, 9, 0), n: "Le 2, 7 ou 9 déc. selon ton équipe — vérifie ton créneau." },
    { t: "Évaluation du client", y: "Project", w: 5, d: null, n: "Fin de session. Note donnée par le client sur le produit final, pondérée par ta contribution personnelle." },
    { t: "Examen final", y: "Exam", w: 30, d: null, n: `${FINAL_WINDOW} Livre fermé, toute la matière du cours.` },
    { t: "Bonus de participation", y: "Quiz", w: 2, d: null, n: "Fin de session. Participation à tous les cours et à tous les questionnaires et sondages." },
  ],
};

const user = await prisma.user.findUnique({ where: { email: "aabyas0123@gmail.com" } });
const courses = await prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true } });
const byCode = Object.fromEntries(courses.map((c) => [c.code, c.id]));

const fmt = (d) => d ? new Intl.DateTimeFormat("fr-CA", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(d) : "sans date";
let planned = 0, skipped = 0;

for (const [code, items] of Object.entries(ITEMS)) {
  if (!byCode[code]) { console.log(`\n${code} : cours introuvable, ignoré.`); continue; }
  console.log(`\n### ${code}`);
  for (const i of items) {
    const dup = await prisma.assessment.findFirst({
      where: { userId: user.id, courseId: byCode[code], title: i.t },
    });
    if (dup) { console.log(`   déjà présent : ${i.t}`); skipped++; continue; }
    console.log(`   ${String(i.w ?? "—").padStart(5)}%  ${fmt(i.d).padEnd(18)} ${i.t}`);
    planned++;
    if (APPLY) {
      await prisma.assessment.create({
        data: {
          userId: user.id, courseId: byCode[code], title: i.t, type: i.y,
          weight: i.w, dueDate: i.d, status: "Upcoming", notes: i.n,
        },
      });
    }
  }
}

console.log(`\n${planned} à insérer, ${skipped} déjà présentes.`);
if (!APPLY) console.log("(simulation — relancer avec --apply)");
else {
  const total = await prisma.assessment.count({ where: { userId: user.id } });
  console.log(`Total du compte : ${total} évaluations.`);
}

await prisma.$disconnect();
