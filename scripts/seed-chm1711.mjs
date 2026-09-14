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

const users = await prisma.user.findMany();
const USER_ID = users[0].id;

const chm = await prisma.course.findFirst({ where: { userId: USER_ID, code: "CHM1711" } });
if (!chm) { console.error("CHM1711 not found"); process.exit(1); }
console.log(`Updating CHM1711: ${chm.id}`);

// Update course info
await prisma.course.update({
  where: { id: chm.id },
  data: {
    name: "Principes de chimie",
    professor: "Alain St-Amant",
    email: "Alain.St-Amant@uOttawa.ca",
    room: "MRN 150",
    color: "#16a34a",
    term: "Fall 2026",
  },
});
console.log("Updated course info");

// Clear old schedules and add real ones (Section A00)
await prisma.courseSchedule.deleteMany({ where: { courseId: chm.id } });
await prisma.courseSchedule.createMany({
  data: [
    { courseId: chm.id, day: "Wednesday", startTime: "10:00", endTime: "11:20", type: "Lecture", room: "MRN 150" },
    { courseId: chm.id, day: "Friday", startTime: "08:30", endTime: "09:50", type: "Lecture", room: "MRN 150" },
  ],
});
console.log("Added schedules (Section A00: Wed 10h-11h20, Fri 8h30-9h50)");

// Clear old assessments
await prisma.assessment.deleteMany({ where: { userId: USER_ID, courseId: chm.id } });

// Create assessments
// 5 Tests (Section A00 writes on Wednesdays during class time)
// Grading: 65% split among tests+final using best formula
const assessments = [
  { title: "Test 1", type: "Exam", dueDate: "2026-09-23T10:00:00Z", weight: null },
  { title: "Test 2", type: "Exam", dueDate: "2026-10-14T10:00:00Z", weight: null },
  { title: "Test 3", type: "Exam", dueDate: "2026-11-04T10:00:00Z", weight: null },
  { title: "Test 4", type: "Exam", dueDate: "2026-11-18T10:00:00Z", weight: null },
  { title: "Test 5", type: "Exam", dueDate: "2026-12-02T10:00:00Z", weight: null },
  { title: "Examen final", type: "Exam", dueDate: null, weight: null },
  // Devoirs 10%
  { title: "Devoirs (ensemble)", type: "Assignment", dueDate: null, weight: 10 },
  // Wooclap 10%
  { title: "Wooclap (participation)", type: "Quiz", dueDate: null, weight: 10 },
  // Lab 15%
  { title: "Laboratoire (ensemble)", type: "Lab", dueDate: null, weight: 15 },
];

for (const a of assessments) {
  await prisma.assessment.create({
    data: {
      userId: USER_ID,
      courseId: chm.id,
      title: a.title,
      type: a.type,
      dueDate: a.dueDate ? new Date(a.dueDate) : null,
      weight: a.weight,
      status: "Upcoming",
    },
  });
  console.log(`  ${a.title}${a.dueDate ? " — " + a.dueDate.slice(0, 10) : ""}`);
}

// Saturday make-up test dates (for reference, stored as notes in a special assessment)
// Sep 26 12h, Oct 17 14h, Nov 7 12h, Nov 21 12h, Dec 5 12h

await prisma.$disconnect();
console.log("\nCHM1711 fully configured (Section A00).");
