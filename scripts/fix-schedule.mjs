// Replaces the whole weekly timetable with the one from uoCampus, which is the only
// authoritative source. The previous rows were partly derived from syllabi and partly
// guessed: wrong days, wrong rooms, and five real sessions missing entirely.
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

const EMAIL = "aabyas0123@gmail.com";
const APPLY = process.argv.includes("--apply");

// Transcribed from the uoCampus weekly timetable, 14–20 Sept 2026.
// Building codes: MRN Marion · CBY Colonel By · LMX Lamoureux · MNO Minto
// FTX Fauteux · SMD Simard · HGN Hagen · FSS Sciences sociales · STM 150 Louis Pasteur
const SCHEDULE = [
  // MCG4328 — section B00 lecture, B02 lab, B04 tutorial
  { code: "MCG4328", day: "Monday",    start: "19:00", end: "21:50", type: "Lecture",  room: "HGN 302" },
  // uoCampus lists this same slot three times under three rooms, flagged with a warning.
  { code: "MCG4328", day: "Tuesday",   start: "13:00", end: "14:20", type: "Lab",      room: "CBY C011 / B08A / STM 024" },
  { code: "MCG4328", day: "Tuesday",   start: "17:30", end: "18:50", type: "Tutorial", room: "FSS 1007" },

  // GNG1503 — A01 lab, A00 lectures
  { code: "GNG1503", day: "Monday",    start: "11:30", end: "14:20", type: "Lab",      room: "STM 119" },
  { code: "GNG1503", day: "Tuesday",   start: "16:00", end: "17:20", type: "Lecture",  room: "FTX 351" },
  { code: "GNG1503", day: "Thursday",  start: "14:30", end: "15:50", type: "Lecture",  room: "FTX 351" },

  // MCG4151 — A00 lectures, A01 tutorial
  { code: "MCG4151", day: "Monday",    start: "14:30", end: "15:50", type: "Lecture",  room: "LMX 221" },
  { code: "MCG4151", day: "Thursday",  start: "16:00", end: "17:20", type: "Lecture",  room: "MNO E217" },
  { code: "MCG4151", day: "Friday",    start: "14:30", end: "15:50", type: "Tutorial", room: "MNO E217" },

  // CHM1711 — A00 lectures, Z07 lab
  { code: "CHM1711", day: "Wednesday", start: "10:00", end: "11:20", type: "Lecture",  room: "MRN 150" },
  { code: "CHM1711", day: "Friday",    start: "08:30", end: "09:50", type: "Lecture",  room: "MRN 150" },
  { code: "CHM1711", day: "Friday",    start: "18:30", end: "20:20", type: "Lab",      room: "MRN 301" },

  // MCG2530 — A00 lectures, A02 tutorial
  { code: "MCG2530", day: "Wednesday", start: "13:00", end: "14:20", type: "Lecture",  room: "CBY B205" },
  { code: "MCG2530", day: "Thursday",  start: "08:00", end: "09:50", type: "Tutorial", room: "SMD 221" },
  { code: "MCG2530", day: "Friday",    start: "11:30", end: "12:50", type: "Lecture",  room: "CBY B205" },

  // MCG4366 — listed as MCG 43661 on uoCampus
  { code: "MCG4366", day: "Wednesday", start: "16:00", end: "18:50", type: "Lab",      room: "CBY C011" },
  { code: "MCG4366", day: "Friday",    start: "10:00", end: "11:20", type: "Lecture",  room: "CBY B012" },
];

const user = await prisma.user.findUnique({ where: { email: EMAIL } });
if (!user) {
  console.error(`Compte ${EMAIL} introuvable.`);
  process.exit(1);
}

const courses = await prisma.course.findMany({
  where: { userId: user.id },
  select: { id: true, code: true },
});
const byCode = Object.fromEntries(courses.map((c) => [c.code, c.id]));

const missing = [...new Set(SCHEDULE.map((s) => s.code))].filter((c) => !byCode[c]);
if (missing.length) {
  console.error(`Cours absents de l'app : ${missing.join(", ")}`);
  process.exit(1);
}

const before = await prisma.courseSchedule.findMany({
  where: { course: { userId: user.id } },
  include: { course: { select: { code: true } } },
});

const ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const key = (s) => `${s.day}|${s.start ?? s.startTime}|${s.code ?? s.course.code}`;
const beforeKeys = new Set(before.map(key));
const afterKeys = new Set(SCHEDULE.map(key));

console.log(`Avant : ${before.length} créneaux | Après : ${SCHEDULE.length}\n`);

console.log("Supprimés (faux ou en double) :");
for (const s of before.filter((s) => !afterKeys.has(key(s))).sort((a, b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day))) {
  console.log(`  - ${s.day.padEnd(10)} ${s.startTime}-${s.endTime} ${s.course.code} ${s.type} ${s.room ?? ""}`);
}

console.log("\nAjoutés (manquants jusqu'ici) :");
for (const s of SCHEDULE.filter((s) => !beforeKeys.has(key(s)))) {
  console.log(`  + ${s.day.padEnd(10)} ${s.start}-${s.end} ${s.code} ${s.type} ${s.room}`);
}

if (!APPLY) {
  console.log("\n(simulation — relancer avec --apply)");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.courseSchedule.deleteMany({ where: { course: { userId: user.id } } });
await prisma.courseSchedule.createMany({
  data: SCHEDULE.map((s) => ({
    courseId: byCode[s.code],
    day: s.day,
    startTime: s.start,
    endTime: s.end,
    type: s.type,
    room: s.room,
  })),
});

console.log(`\nHoraire remplacé : ${SCHEDULE.length} créneaux depuis uoCampus.\n`);

const after = await prisma.courseSchedule.findMany({
  where: { course: { userId: user.id } },
  include: { course: { select: { code: true } } },
});

for (const day of ORDER) {
  const rows = after.filter((s) => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (!rows.length) continue;
  console.log(day);
  for (const s of rows) {
    console.log(`   ${s.startTime}-${s.endTime}  ${s.course.code.padEnd(8)} ${s.type.padEnd(9)} ${s.room ?? ""}`);
  }
}

await prisma.$disconnect();
