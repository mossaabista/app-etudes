// Rebuilds the weekly timetable from the uoCampus view of 6 Oct 2026. Three things
// changed since September: MCG4144 was added, GNG1503 moved from section A to B — a
// completely different set of slots — and two MCG2530 rooms moved.
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

const EMAIL = "aabyas0123@gmail.com";
const APPLY = process.argv.includes("--apply");

const NEW_COURSE = {
  code: "MCG4144",
  name: "Introduction aux matériaux composites",
  color: "#0d9488",
  term: "Fall 2026",
};

// SMD Simard · LMX Lamoureux · MRN Marion · HGN Hagen · FSS Sciences sociales
// STM 150 Louis Pasteur · MNT Montpetit · MRT Morisset · CBY Colonel By · MNO Minto
const SCHEDULE = [
  { code: "MCG4144", day: "Monday",    start: "13:00", end: "14:20", type: "Lecture",  room: "SMD 430" },
  { code: "MCG4151", day: "Monday",    start: "14:30", end: "15:50", type: "Lecture",  room: "LMX 221" },
  { code: "GNG1503", day: "Monday",    start: "16:00", end: "17:20", type: "Lecture",  room: "MRN 021" },
  { code: "MCG4328", day: "Monday",    start: "19:00", end: "21:50", type: "Lecture",  room: "HGN 302" },

  { code: "MCG4328", day: "Tuesday",   start: "13:00", end: "14:20", type: "Lab",      room: "STM 024 / CBY C011 / CBY B08A" },
  { code: "MCG4328", day: "Tuesday",   start: "17:30", end: "18:50", type: "Tutorial", room: "FSS 1007" },
  { code: "GNG1503", day: "Tuesday",   start: "19:00", end: "21:50", type: "Lab",      room: "STM 119" },

  { code: "CHM1711", day: "Wednesday", start: "10:00", end: "11:20", type: "Lecture",  room: "MRN 150" },
  { code: "MCG4144", day: "Wednesday", start: "11:30", end: "12:50", type: "Lecture",  room: "SMD 430" },
  { code: "MCG2530", day: "Wednesday", start: "13:00", end: "14:20", type: "Lecture",  room: "MNT 201" },
  { code: "GNG1503", day: "Wednesday", start: "14:30", end: "15:50", type: "Lecture",  room: "MRT 256" },
  { code: "MCG4366", day: "Wednesday", start: "16:00", end: "18:50", type: "Lab",      room: "CBY C011" },

  { code: "MCG2530", day: "Thursday",  start: "08:00", end: "09:50", type: "Tutorial", room: "SMD 221" },
  { code: "MCG4151", day: "Thursday",  start: "16:00", end: "17:20", type: "Lecture",  room: "MNO E217" },

  { code: "CHM1711", day: "Friday",    start: "08:30", end: "09:50", type: "Lecture",  room: "MRN 150" },
  { code: "MCG4366", day: "Friday",    start: "10:00", end: "11:20", type: "Lecture",  room: "CBY B012" },
  { code: "MCG2530", day: "Friday",    start: "11:30", end: "12:50", type: "Lecture",  room: "STM 129-155" },
  { code: "MCG4151", day: "Friday",    start: "14:30", end: "15:50", type: "Tutorial", room: "MNO E217" },
  { code: "CHM1711", day: "Friday",    start: "18:30", end: "20:20", type: "Lab",      room: "MRN 301" },
];

const user = await prisma.user.findUnique({ where: { email: EMAIL } });
if (!user) { console.error(`Compte ${EMAIL} introuvable.`); process.exit(1); }

let courses = await prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true } });
const hasNew = courses.some((c) => c.code === NEW_COURSE.code);

console.log(hasNew ? `${NEW_COURSE.code} existe déjà.` : `À CRÉER : ${NEW_COURSE.code} — ${NEW_COURSE.name}`);

if (APPLY && !hasNew) {
  await prisma.course.create({ data: { userId: user.id, ...NEW_COURSE } });
  courses = await prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true } });
}

const byCode = Object.fromEntries(courses.map((c) => [c.code, c.id]));
const missing = [...new Set(SCHEDULE.map((s) => s.code))].filter((c) => !byCode[c]);
if (missing.length && APPLY) { console.error(`Cours absents : ${missing.join(", ")}`); process.exit(1); }

const before = await prisma.courseSchedule.findMany({
  where: { course: { userId: user.id } },
  include: { course: { select: { code: true } } },
});

const ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const sig = (code, day, start, end, type, room) => `${day}|${start}|${end}|${code}|${type}|${room ?? ""}`;
const beforeSet = new Set(before.map((s) => sig(s.course.code, s.day, s.startTime, s.endTime, s.type, s.room)));
const afterSet = new Set(SCHEDULE.map((s) => sig(s.code, s.day, s.start, s.end, s.type, s.room)));

console.log(`\nCréneaux : ${before.length} -> ${SCHEDULE.length}`);

console.log(`\nRETIRÉS :`);
const removed = before.filter((s) => !afterSet.has(sig(s.course.code, s.day, s.startTime, s.endTime, s.type, s.room)));
for (const s of removed.sort((a, b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day))) {
  console.log(`  - ${s.day.padEnd(10)} ${s.startTime}-${s.endTime} ${s.course.code.padEnd(8)} ${s.type.padEnd(9)} ${s.room ?? ""}`);
}
if (!removed.length) console.log("  (aucun)");

console.log(`\nAJOUTÉS :`);
const added = SCHEDULE.filter((s) => !beforeSet.has(sig(s.code, s.day, s.start, s.end, s.type, s.room)));
for (const s of added.sort((a, b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day))) {
  console.log(`  + ${s.day.padEnd(10)} ${s.start}-${s.end} ${s.code.padEnd(8)} ${s.type.padEnd(9)} ${s.room}`);
}
if (!added.length) console.log("  (aucun)");

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

console.log(`\nHoraire remplacé : ${SCHEDULE.length} créneaux.\n`);
const after = await prisma.courseSchedule.findMany({
  where: { course: { userId: user.id } },
  include: { course: { select: { code: true } } },
});
for (const day of ORDER) {
  const rows = after.filter((s) => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  console.log(day);
  for (const s of rows) console.log(`   ${s.startTime}-${s.endTime}  ${s.course.code.padEnd(8)} ${s.type.padEnd(9)} ${s.room ?? ""}`);
}

await prisma.$disconnect();
