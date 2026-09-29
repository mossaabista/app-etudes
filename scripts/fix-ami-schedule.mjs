// Fills in what the syllabi could not settle, from the uoCampus weekly timetable:
// the lab and tutorial sections he is actually registered in, the CVG3120 slots that
// arrived with no syllabus, and the CHM1711 section — AV00, the online half of group A,
// which fixes his five test dates to the Wednesday set rather than the Thursday one.
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

// Transcribed from the uoCampus weekly timetable, 14–20 Sept 2026.
// DMS Desmarais · MNT Montpetit · CBY Colonel By · FTX Fauteux · FSS Sciences sociales
// MRN Marion · MRT Morisset · VNR Vanier · HND Henderson · STM 150 Louis Pasteur
const SCHEDULE = [
  { code: "CVG2141", day: "Monday",    start: "08:00", end: "09:50", type: "Lab",      room: "STM 0018 / 129 Louis Pasteur 286" },
  { code: "CVG2141", day: "Monday",    start: "10:00", end: "11:20", type: "Lecture",  room: "DMS 1150" },
  { code: "CVG2141", day: "Wednesday", start: "08:30", end: "09:50", type: "Lecture",  room: "DMS 1150" },

  { code: "CVG3109", day: "Monday",    start: "16:30", end: "18:20", type: "Lab",      room: "CBY D114 & 113A" },
  { code: "CVG3109", day: "Tuesday",   start: "14:30", end: "15:50", type: "Lecture",  room: "DMS 1110" },
  { code: "CVG3109", day: "Thursday",  start: "17:30", end: "18:50", type: "Tutorial", room: "FTX 227" },
  { code: "CVG3109", day: "Friday",    start: "13:00", end: "14:20", type: "Lecture",  room: "FSS 1007" },

  { code: "CVG3116", day: "Monday",    start: "14:30", end: "15:50", type: "Lecture",  room: "MNT 207" },
  { code: "CVG3116", day: "Tuesday",   start: "13:00", end: "14:20", type: "Tutorial", room: "HND 013" },
  { code: "CVG3116", day: "Thursday",  start: "16:00", end: "17:20", type: "Lecture",  room: "MNT 207" },
  { code: "CVG3116", day: "Friday",    start: "16:00", end: "17:50", type: "Lab",      room: "STM 0014" },

  { code: "CVG3120", day: "Tuesday",   start: "16:00", end: "17:20", type: "Lecture",  room: "VNR 2095" },
  { code: "CVG3120", day: "Thursday",  start: "14:30", end: "15:50", type: "Lecture",  room: "MRT 256" },
  { code: "CVG3120", day: "Friday",    start: "14:30", end: "15:50", type: "Tutorial", room: "FTX 135" },

  // uoCampus schedules these despite the syllabus calling the course asynchronous.
  { code: "ANP1511", day: "Tuesday",   start: "08:30", end: "09:50", type: "Lecture",  room: "En ligne" },
  { code: "ANP1511", day: "Friday",    start: "10:00", end: "11:20", type: "Lecture",  room: "En ligne" },

  { code: "CHM1711", day: "Wednesday", start: "10:00", end: "11:20", type: "Lecture",  room: "En ligne (AV00)" },
  { code: "CHM1711", day: "Friday",    start: "08:30", end: "09:50", type: "Lecture",  room: "En ligne (AV00)" },
  { code: "CHM1711", day: "Friday",    start: "18:30", end: "20:20", type: "Lab",      room: "MRN 301 (Z07)" },
];

// Section AV00 follows the group-A dates: the Wednesday set, written in class hours.
const MAKEUP = "Test différé possible le samedi (intention à signaler avant vendredi 10h) :";
const CHM_TESTS = [
  { n: 1, date: at(2026, 9, 23, 10, 0),  makeup: "samedi 26 sept. 12h00" },
  { n: 2, date: at(2026, 10, 14, 10, 0), makeup: "samedi 17 oct. 14h00" },
  { n: 3, date: at(2026, 11, 4, 10, 0),  makeup: "samedi 7 nov. 12h00" },
  { n: 4, date: at(2026, 11, 18, 10, 0), makeup: "samedi 21 nov. 12h00" },
  { n: 5, date: at(2026, 12, 2, 10, 0),  makeup: "samedi 5 déc. 12h00" },
];

const user = await prisma.user.findUnique({ where: { email: EMAIL } });
if (!user) { console.error(`Compte ${EMAIL} introuvable.`); process.exit(1); }

const courses = await prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true } });
const byCode = Object.fromEntries(courses.map((c) => [c.code, c.id]));
const missing = [...new Set(SCHEDULE.map((s) => s.code))].filter((c) => !byCode[c]);
if (missing.length) { console.error(`Cours absents : ${missing.join(", ")}`); process.exit(1); }

const ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const before = await prisma.courseSchedule.count({ where: { course: { userId: user.id } } });

console.log(`Créneaux : ${before} -> ${SCHEDULE.length}\n`);
for (const day of ORDER) {
  const rows = SCHEDULE.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));
  console.log(day);
  for (const s of rows) console.log(`   ${s.start}-${s.end}  ${s.code.padEnd(8)} ${s.type.padEnd(9)} ${s.room}`);
}

console.log(`\nTests CHM1711 (section AV00 — dates du groupe A, les mercredis) :`);
for (const t of CHM_TESTS) {
  console.log(`   Test ${t.n}  ${t.date.toISOString().slice(0, 16).replace("T", " ")} UTC  (reprise : ${t.makeup})`);
}

if (!APPLY) {
  console.log("\n(simulation — relancer avec --apply)");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.courseSchedule.deleteMany({ where: { course: { userId: user.id } } });
await prisma.courseSchedule.createMany({
  data: SCHEDULE.map((s) => ({
    courseId: byCode[s.code], day: s.day, startTime: s.start, endTime: s.end, type: s.type, room: s.room,
  })),
});

for (const t of CHM_TESTS) {
  const title = `Test ${t.n}`;
  const exists = await prisma.assessment.findFirst({ where: { userId: user.id, courseId: byCode.CHM1711, title } });
  if (exists) continue;
  await prisma.assessment.create({
    data: {
      userId: user.id,
      courseId: byCode.CHM1711,
      title,
      type: "Exam",
      weight: null,
      dueDate: t.date,
      status: "Upcoming",
      notes: `Section AV00. En personne en MRN 150 pendant les heures de cours, 80 min. ${MAKEUP} ${t.makeup}. Un test manqué est reporté sur l'examen final sans justification.`,
    },
  });
}

await prisma.course.update({
  where: { id: byCode.CHM1711 },
  data: { room: "En ligne (AV00) · tests en MRN 150" },
});

console.log(`\n${SCHEDULE.length} créneaux et ${CHM_TESTS.length} tests enregistrés.`);
await prisma.$disconnect();
