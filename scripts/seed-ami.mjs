// Seeds the friend's account from his syllabi. Everything here is transcribed from the
// documents; nothing is inferred except exam start times, which are marked as such in
// the notes. Lab sections and the CHM1711 section are deliberately absent — the syllabi
// list several options each and only he knows which one he is registered in.
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

const EMAIL = "taherannasse2002@gmail.com";
const APPLY = process.argv.includes("--apply");
const TZ = "America/Toronto";

// A deadline is a wall-clock time in Ottawa; storing it as UTC naively would shift every
// 23:59 across midnight. Same two-pass resolution as src/lib/dates.ts.
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

const INFERRED_TIME = "Heure déduite du créneau de cours — à confirmer.";

const COURSES = [
  {
    code: "ANP1511",
    name: "Principes d'anatomie et de physiologie humaines I",
    professor: "Jean-François Thibodeau",
    email: "jf.thibodeau@uottawa.ca",
    room: null,
    color: "#e11d48",
    schedules: [], // cours asynchrone en ligne — aucun créneau
    assessments: [
      { title: "Quiz 1 — Révision biochimie et biologie cellulaire", type: "Quiz", weight: 2, due: at(2026, 9, 13, 23, 59), notes: "Ouvre le vendredi 11 sept. 8h, ferme le dimanche 23h59. 50 min, 2 tentatives, meilleure note retenue." },
      { title: "Quiz 2 — Tissus, tégumentaire, squelette", type: "Quiz", weight: 2, due: at(2026, 10, 4, 23, 59), notes: "Ouvre le vendredi 2 oct. 8h, ferme le dimanche 23h59. 50 min, 2 tentatives." },
      { title: "Quiz 3 — Articulations, transports membranaires, neurones", type: "Quiz", weight: 2, due: at(2026, 10, 25, 23, 59), notes: "Ouvre le vendredi 23 oct. 8h, ferme le dimanche 23h59. 50 min, 2 tentatives." },
      { title: "Quiz 4 — Muscles, système nerveux, vision", type: "Quiz", weight: 2, due: at(2026, 12, 13, 23, 59), notes: "Ouvre le vendredi 11 déc. 8h, ferme le dimanche 23h59. 50 min, 2 tentatives." },
      { title: "Examen partiel 1", type: "Exam", weight: 20, due: at(2026, 10, 9, 10, 0), notes: "10h00–11h20. Sections 2 à 5. Brightspace avec Lockdown Browser. ~40-45 questions." },
      { title: "Examen partiel 2", type: "Exam", weight: 30, due: at(2026, 11, 10, 8, 30), notes: "8h30–9h50. Sections 6, 7.1, 7.2, 7.3. ~40-45 questions." },
      { title: "Examen final", type: "Exam", weight: 42, due: null, notes: "Date et lieu à déterminer. Sections 7.3 à 13, ~75 questions." },
    ],
  },
  {
    code: "CVG2141",
    name: "Civil Engineering Materials",
    professor: "Reza Foruzanmehr",
    email: "Reza.Foruzan@uottawa.ca",
    room: "CBY A-022",
    color: "#f59e0b",
    schedules: [
      { day: "Monday", start: "10:00", end: "11:20", type: "Lecture", room: "DMS 1150" },
      { day: "Wednesday", start: "08:30", end: "09:50", type: "Lecture", room: "DMS 1150" },
    ],
    assessments: [
      { title: "Quiz (ensemble, 4 quiz — 3 meilleurs comptés)", type: "Quiz", weight: 15, due: null, notes: "4 quiz Brightspace, les 3 meilleurs comptent. Participation à au moins 3 requise, sinon 0 pour la composante. <60 min, ouvert une semaine." },
      { title: "Rapports de laboratoire (ensemble, 5 labos)", type: "Lab", weight: 20, due: null, notes: "Labos à partir de la semaine du 12 octobre. Pas de rapport pour le labo 4 (bois). Résultats du labo 2 (béton) après 28 jours. Pénalité 20 %/jour." },
      { title: "Projet final — objet imprimé en 3D", type: "Project", weight: 15, due: null, notes: "Travail d'équipe. Présentation PowerPoint 20-30 min. Note = 70 % équipe + 30 % individuel. Ateliers MakerLab la semaine du 11 sept., présentation obligatoire la semaine du 21 sept., essais en STM 0018 les semaines du 5 oct., 2 nov. et 16 nov." },
      { title: "Examen final", type: "Exam", weight: 50, due: null, notes: "3 heures, date fixée par l'Université. Aucun examen de mi-session. Il faut >50 % à cet examen pour réussir le cours." },
    ],
  },
  {
    code: "CVG3109",
    name: "Soil Mechanics I",
    professor: "Rozalina Dimitrova",
    email: "rdimitro@uottawa.ca",
    room: "CBY A-333A",
    color: "#7c3aed",
    schedules: [
      { day: "Tuesday", start: "14:30", end: "15:50", type: "Lecture", room: "DMS 1110" },
      { day: "Friday", start: "13:00", end: "14:20", type: "Lecture", room: "FSS 1007" },
      { day: "Thursday", start: "17:30", end: "18:50", type: "Tutorial", room: "FTX 227" },
    ],
    assessments: [
      { title: "Examen de mi-session 1", type: "Exam", weight: 20, due: at(2026, 10, 13, 14, 30), notes: `Date provisoire selon le plan de cours. En personne, livre fermé, feuilles d'équations fournies. ${INFERRED_TIME}` },
      { title: "Examen de mi-session 2", type: "Exam", weight: 20, due: at(2026, 11, 13, 13, 0), notes: `En personne, livre fermé, feuilles d'équations fournies. ${INFERRED_TIME}` },
      { title: "Examen final", type: "Exam", weight: 40, due: null, notes: "Date fixée par l'Université. En personne, livre fermé." },
      { title: "Rapports de laboratoire (ensemble, 5 labos)", type: "Lab", weight: 20, due: null, notes: "5 labos en groupe de 4-5. Présence obligatoire à chaque labo pour être noté. Rapports dus 2 semaines après le labo. Inscription au groupe sur Brightspace après le 11 sept." },
      { title: "Devoirs bonus (3, optionnels)", type: "Assignment", weight: 6, due: null, notes: "Optionnels, jusqu'à 6 % de bonus. Soumission électronique sur Brightspace. Aucun retard accepté." },
    ],
  },
  {
    code: "CVG3116",
    name: "Hydraulics",
    professor: "Colin Rennie",
    email: "crennie@uottawa.ca",
    room: "CBY A016",
    color: "#0891b2",
    schedules: [
      { day: "Monday", start: "14:30", end: "15:50", type: "Lecture", room: "MNT 207" },
      { day: "Thursday", start: "16:00", end: "17:20", type: "Lecture", room: "MNT 207" },
      { day: "Tuesday", start: "13:00", end: "14:30", type: "Tutorial", room: "HNN 013" },
    ],
    assessments: [
      { title: "Devoir 1 — Écoulement en conduite", type: "Assignment", weight: null, due: at(2026, 9, 29, 23, 59), notes: "Fenêtre 22–29 sept. Compte dans les 10 % de devoirs. Aucun retard accepté." },
      { title: "Devoir 2 — Réseaux de conduites, jonctions, boucles", type: "Assignment", weight: null, due: at(2026, 10, 6, 23, 59), notes: "Fenêtre 29 sept.–6 oct." },
      { title: "Devoir 3 — Pompes, écoulements transitoires", type: "Assignment", weight: null, due: at(2026, 10, 20, 23, 59), notes: "Fenêtre 13–20 oct." },
      { title: "Devoir 4 — Écoulement à surface libre", type: "Assignment", weight: null, due: at(2026, 11, 24, 23, 59), notes: "Fenêtre 17–24 nov." },
      { title: "Devoir 5 — Transport sédimentaire, ponceaux, ponts", type: "Assignment", weight: null, due: at(2026, 12, 9, 23, 59), notes: "Fenêtre 2–9 déc." },
      { title: "Devoirs (ensemble, 5)", type: "Assignment", weight: 10, due: null, notes: "Pondération globale des 5 devoirs." },
      { title: "Examen de mi-session", type: "Exam", weight: 25, due: at(2026, 10, 22, 16, 0), notes: `Date provisoire selon le plan de cours. Révision le 19 oct. Livre fermé, aide-mémoire 8,5x11 recto-verso permis. ${INFERRED_TIME}` },
      { title: "Examen final", type: "Exam", weight: 45, due: null, notes: "Date fixée par l'Université. Livre fermé, deux aide-mémoire permis." },
      { title: "Rapports de laboratoire (ensemble, 5 labos)", type: "Lab", weight: 20, due: null, notes: "5 labos en groupe de 4-5. Présence obligatoire à chaque séance. Rapports dus environ 2 semaines après. Composition des groupes à envoyer au prof avant le lundi 21 sept." },
      { title: "Projet (optionnel) — présentation", type: "Project", weight: null, due: at(2026, 12, 7, 14, 30), notes: "Optionnel, bonus de 2 à 5 %. Équipes de 3 à 5. Présentations le dernier jour de cours." },
    ],
  },
  {
    code: "CVG3120",
    name: "Hydrologie (nom exact à confirmer)",
    professor: null,
    email: null,
    room: null,
    color: "#16a34a",
    schedules: [],
    assessments: [
      { title: "Devoir 1 / Livrable 1 — Bilan hydrique", type: "Assignment", weight: 6, due: null, notes: "À rendre deux semaines après publication ; date exacte sur Brightspace. Rapport PDF + classeur Excel. Problème 1 réservoir (20 pts), Problème 2 modèle dynamique (40 pts), Problème 3 bassin versant assigné (40 pts)." },
    ],
  },
  {
    code: "CHM1711",
    name: "Principes de chimie",
    professor: "Alain St-Amant",
    email: "Alain.St-Amant@uOttawa.ca",
    room: "MRN 150",
    color: "#2563eb",
    schedules: [], // dépend de la section (A00 ou B00) — inconnue
    assessments: [
      { title: "Laboratoire (ensemble)", type: "Lab", weight: 15, due: null, notes: "Brightspace distinct, géré par Dre Rashmi Venkateswaran (vrashmi@uottawa.ca). Présence 80 % obligatoire. Doit être réussi pour réussir le cours. Stemble ~45 $, sarrau ~25 $, lunettes ~7 $. Cahier relié de ~100 pages obligatoire." },
      { title: "Devoirs (ensemble)", type: "Assignment", weight: 10, due: null, notes: "Disponibles sur le site du cours." },
      { title: "Wooclap (participation en classe)", type: "Quiz", weight: 10, due: null, notes: "10 % dont 5 % en mode compétition. Les points manqués sont reportés sur l'examen final. Présence en direct requise (en personne ou Zoom)." },
      { title: "Tests et examen final (ensemble)", type: "Exam", weight: 65, due: null, notes: "5 tests + examen final, la meilleure des 6 formules s'applique. Tests en MRN 150 pendant les heures de cours, 80 min. Un test manqué est reporté sur le final sans justification. Dates de tests à ajouter une fois la section connue." },
    ],
  },
];

const user = await prisma.user.findUnique({ where: { email: EMAIL } });
if (!user) {
  console.error(`Compte ${EMAIL} introuvable.`);
  process.exit(1);
}

const existing = await prisma.course.count({ where: { userId: user.id } });
if (existing > 0 && !process.argv.includes("--force")) {
  console.error(`Ce compte a déjà ${existing} cours. Relancer avec --force pour écraser.`);
  process.exit(1);
}

let nCourses = 0, nSchedules = 0, nAssessments = 0;
for (const c of COURSES) {
  console.log(`\n${c.code} — ${c.name}`);
  if (c.professor) console.log(`  ${c.professor} <${c.email}>`);
  for (const s of c.schedules) console.log(`  ${s.day} ${s.start}-${s.end} ${s.type} ${s.room}`);
  if (!c.schedules.length) console.log(`  (aucun créneau)`);
  for (const a of c.assessments) {
    const d = a.due ? a.due.toISOString().slice(0, 16).replace("T", " ") : "sans date";
    console.log(`  ${String(a.weight ?? "—").padStart(4)}%  ${d.padEnd(17)} ${a.title}`);
  }
  nCourses++; nSchedules += c.schedules.length; nAssessments += c.assessments.length;
}

console.log(`\nTotal : ${nCourses} cours, ${nSchedules} créneaux, ${nAssessments} évaluations.`);

if (!APPLY) {
  console.log("(simulation — relancer avec --apply)");
  await prisma.$disconnect();
  process.exit(0);
}

if (existing > 0) {
  await prisma.course.deleteMany({ where: { userId: user.id } });
  console.log(`\n${existing} cours précédents supprimés.`);
}

for (const c of COURSES) {
  const course = await prisma.course.create({
    data: {
      userId: user.id,
      code: c.code,
      name: c.name,
      professor: c.professor,
      email: c.email,
      room: c.room,
      color: c.color,
      term: "Fall 2026",
      schedules: {
        create: c.schedules.map((s) => ({
          day: s.day, startTime: s.start, endTime: s.end, type: s.type, room: s.room,
        })),
      },
    },
  });

  for (const a of c.assessments) {
    await prisma.assessment.create({
      data: {
        userId: user.id,
        courseId: course.id,
        title: a.title,
        type: a.type,
        weight: a.weight,
        dueDate: a.due,
        status: "Upcoming",
        notes: a.notes,
      },
    });
  }
}

console.log(`\nCompte de ${user.name} rempli.`);
await prisma.$disconnect();
