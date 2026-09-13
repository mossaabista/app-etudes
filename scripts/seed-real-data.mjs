import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=["']?([^"']*)["']?$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const users = await prisma.user.findMany();
if (users.length === 0) { console.error("No users found"); process.exit(1); }
const USER_ID = users[0].id;
console.log(`Seeding for user: ${USER_ID}`);

// Step 1: Delete fake courses (the example ones I seeded earlier)
const fakeCodes = ["MAT1720", "PHY1721", "BIO1530", "FRA1710", "ITI1500"];
for (const code of fakeCodes) {
  const course = await prisma.course.findFirst({ where: { userId: USER_ID, code } });
  if (course) {
    await prisma.courseSchedule.deleteMany({ where: { courseId: course.id } });
    await prisma.assessment.deleteMany({ where: { courseId: course.id } });
    await prisma.task.deleteMany({ where: { courseId: course.id } });
    await prisma.course.delete({ where: { id: course.id } });
    console.log(`Deleted fake course: ${code}`);
  }
}

// Delete fake schedules from CHM1711
const chm = await prisma.course.findFirst({ where: { userId: USER_ID, code: "CHM1711" } });
if (chm) {
  await prisma.courseSchedule.deleteMany({ where: { courseId: chm.id } });
  console.log("Cleared CHM1711 schedules (user will re-add from their syllabus)");
}

// Step 2: Create real courses from syllabi

const courses = [
  {
    code: "MCG2530",
    name: "Thermodynamique I",
    professor: "José Morán",
    email: "jose.moran@uottawa.ca",
    room: "MNT 201",
    color: "#dc2626",
    term: "Fall 2026",
    schedules: [
      { day: "Wednesday", startTime: "13:00", endTime: "14:20", type: "Lecture", room: "MNT 201" },
      { day: "Friday", startTime: "11:30", endTime: "12:50", type: "Lecture", room: "LPR 155" },
      { day: "Wednesday", startTime: "08:00", endTime: "09:50", type: "Tutorial", room: "SMD 227" },
    ],
  },
  {
    code: "MCG4328",
    name: "Manufacturing",
    professor: "Dr. Nafisa Bano",
    email: "nbano@uottawa.ca",
    room: "CBY A217",
    color: "#0891b2",
    term: "Fall 2026",
    schedules: [],
  },
  {
    code: "MCG4151",
    name: "Design of Artificial Joint Prostheses and Implants",
    professor: "Émélie Bowness",
    email: "esegu064@uottawa.ca",
    room: "LMX 221",
    color: "#7c3aed",
    term: "Fall 2026",
    schedules: [
      { day: "Monday", startTime: "14:30", endTime: "15:50", type: "Lecture", room: "LMX 221" },
      { day: "Thursday", startTime: "16:00", endTime: "17:20", type: "Lecture", room: "MNO E217" },
      { day: "Friday", startTime: "14:30", endTime: "15:50", type: "DGD", room: "MNO E217" },
    ],
  },
  {
    code: "GNG1503",
    name: "Génie de la conception",
    professor: "Emmanuel Bouendeu",
    email: "ebouende@uottawa.ca",
    room: "FTX 351",
    color: "#2563eb",
    term: "Fall 2026",
    schedules: [
      { day: "Tuesday", startTime: "16:00", endTime: "17:20", type: "Lecture", room: "FTX 351" },
      { day: "Thursday", startTime: "14:30", endTime: "15:50", type: "Lecture", room: "FTX 351" },
      { day: "Monday", startTime: "11:30", endTime: "14:20", type: "Lab", room: "MakerLab 119" },
    ],
  },
  {
    code: "MCG4366",
    name: "Biomedical Mech. Eng. Capstone Project",
    professor: "Dr. Marc Doumit",
    email: "marc.doumit@uottawa.ca",
    room: "CBY B012",
    color: "#ea580c",
    term: "Fall 2026",
    schedules: [
      { day: "Friday", startTime: "10:00", endTime: "11:20", type: "Lecture", room: "CBY B012" },
      { day: "Wednesday", startTime: "16:00", endTime: "18:50", type: "Lab", room: "CBY C011" },
    ],
  },
];

const courseIds = {};

for (const c of courses) {
  const existing = await prisma.course.findFirst({ where: { userId: USER_ID, code: c.code } });
  if (existing) {
    console.log(`Skipping ${c.code} — already exists`);
    courseIds[c.code] = existing.id;
    continue;
  }
  const course = await prisma.course.create({
    data: {
      userId: USER_ID,
      code: c.code,
      name: c.name,
      professor: c.professor,
      email: c.email,
      room: c.room,
      color: c.color,
      term: c.term,
      schedules: { create: c.schedules },
    },
  });
  courseIds[c.code] = course.id;
  console.log(`Created ${c.code}: ${course.id}`);
}

// Step 3: Seed assessments from syllabi

const assessments = [
  // MCG 2530 - Thermodynamique I
  { courseCode: "MCG2530", title: "Devoir 1", type: "Assignment", dueDate: "2026-09-20", weight: 2.67 },
  { courseCode: "MCG2530", title: "Devoir 2", type: "Assignment", dueDate: "2026-10-04", weight: 2.67 },
  { courseCode: "MCG2530", title: "Devoir 3", type: "Assignment", dueDate: "2026-10-18", weight: 2.67 },
  { courseCode: "MCG2530", title: "Devoir 4", type: "Assignment", dueDate: "2026-10-25", weight: 2.67 },
  { courseCode: "MCG2530", title: "Devoir 5", type: "Assignment", dueDate: "2026-11-15", weight: 2.67 },
  { courseCode: "MCG2530", title: "Devoir 6", type: "Assignment", dueDate: "2026-11-29", weight: 2.67 },
  { courseCode: "MCG2530", title: "Examen mi-session 1", type: "Exam", dueDate: "2026-10-14", weight: 20 },
  { courseCode: "MCG2530", title: "Examen mi-session 2", type: "Exam", dueDate: "2026-11-13", weight: 20 },
  { courseCode: "MCG2530", title: "Examen final", type: "Exam", dueDate: "2026-12-15", weight: 44 },

  // MCG 4328 - Manufacturing
  { courseCode: "MCG4328", title: "Assignment 1", type: "Assignment", dueDate: "2026-10-05", weight: 2.5 },
  { courseCode: "MCG4328", title: "Assignment 2", type: "Assignment", dueDate: "2026-10-26", weight: 2.5 },
  { courseCode: "MCG4328", title: "Assignment 3", type: "Assignment", dueDate: "2026-11-16", weight: 2.5 },
  { courseCode: "MCG4328", title: "Assignment 4", type: "Assignment", dueDate: "2026-12-01", weight: 2.5 },
  { courseCode: "MCG4328", title: "Lab Report 1", type: "Assignment", dueDate: "2026-10-12", weight: 2 },
  { courseCode: "MCG4328", title: "Lab Report 2", type: "Assignment", dueDate: "2026-11-02", weight: 2 },
  { courseCode: "MCG4328", title: "Lab Report 3", type: "Assignment", dueDate: "2026-11-23", weight: 2 },
  { courseCode: "MCG4328", title: "Lab Report 4", type: "Assignment", dueDate: "2026-12-07", weight: 2 },
  { courseCode: "MCG4328", title: "Midterm Exam", type: "Exam", dueDate: "2026-11-02", weight: 20 },
  { courseCode: "MCG4328", title: "Final Exam", type: "Exam", dueDate: "2026-12-15", weight: 60 },

  // MCG 4151 - Prostheses & Implants
  { courseCode: "MCG4151", title: "Quiz 1", type: "Quiz", dueDate: "2026-09-19", weight: 2.86 },
  { courseCode: "MCG4151", title: "Quiz 2", type: "Quiz", dueDate: "2026-10-03", weight: 2.86 },
  { courseCode: "MCG4151", title: "Quiz 3", type: "Quiz", dueDate: "2026-10-17", weight: 2.86 },
  { courseCode: "MCG4151", title: "Quiz 4", type: "Quiz", dueDate: "2026-10-31", weight: 2.86 },
  { courseCode: "MCG4151", title: "Quiz 5", type: "Quiz", dueDate: "2026-11-14", weight: 2.86 },
  { courseCode: "MCG4151", title: "Quiz 6", type: "Quiz", dueDate: "2026-11-28", weight: 2.86 },
  { courseCode: "MCG4151", title: "Quiz 7", type: "Quiz", dueDate: "2026-12-05", weight: 2.86 },
  { courseCode: "MCG4151", title: "Final Exam", type: "Exam", dueDate: "2026-12-15", weight: 30 },

  // GNG 1503 - Génie de la conception
  { courseCode: "GNG1503", title: "Quiz 1", type: "Quiz", dueDate: "2026-09-29", weight: 3 },
  { courseCode: "GNG1503", title: "Quiz 2", type: "Quiz", dueDate: "2026-10-08", weight: 3 },
  { courseCode: "GNG1503", title: "Quiz 3", type: "Quiz", dueDate: "2026-10-20", weight: 3 },
  { courseCode: "GNG1503", title: "Quiz 4", type: "Quiz", dueDate: "2026-11-05", weight: 3 },
  { courseCode: "GNG1503", title: "Quiz 5", type: "Quiz", dueDate: "2026-11-24", weight: 3 },
  { courseCode: "GNG1503", title: "Devoir 1 — Réflexion initiale", type: "Assignment", dueDate: "2026-09-20", weight: 3.5 },
  { courseCode: "GNG1503", title: "Devoir 2 — Rétroaction pairs", type: "Assignment", dueDate: "2026-10-24", weight: 2.5 },
  { courseCode: "GNG1503", title: "Devoir 3 — Réflexion finale", type: "Assignment", dueDate: "2026-12-09", weight: 4 },
  { courseCode: "GNG1503", title: "LP-A: Formation d'équipe", type: "Project", dueDate: "2026-09-27", weight: 0.5 },
  { courseCode: "GNG1503", title: "LP-B: Empathie & Définition", type: "Project", dueDate: "2026-10-04", weight: 3.5 },
  { courseCode: "GNG1503", title: "LP-C: Idéation", type: "Project", dueDate: "2026-10-18", weight: 2 },
  { courseCode: "GNG1503", title: "LP-D: Concept Détaillé & Plan", type: "Project", dueDate: "2026-11-01", weight: 2 },
  { courseCode: "GNG1503", title: "LP-E: Prototypage & Tests Ciblés", type: "Project", dueDate: "2026-11-08", weight: 6 },
  { courseCode: "GNG1503", title: "LP-F: Prototypage & Tests Complets", type: "Project", dueDate: "2026-11-22", weight: 4.5 },
  { courseCode: "GNG1503", title: "LP-G: Journée de Conception", type: "Project", dueDate: "2026-12-03", weight: 5 },
  { courseCode: "GNG1503", title: "LP-H: Présentations Finales", type: "Project", dueDate: "2026-11-26", weight: 4 },
  { courseCode: "GNG1503", title: "LP-I: Manuel d'utilisateur", type: "Project", dueDate: "2026-12-06", weight: 2.5 },
  { courseCode: "GNG1503", title: "Examen final", type: "Exam", dueDate: "2026-12-18", weight: 30 },

  // MCG 4366 - Capstone Project
  { courseCode: "MCG4366", title: "Literature Review Report", type: "Project", dueDate: "2026-10-02", weight: 5 },
  { courseCode: "MCG4366", title: "Conceptual Design Report", type: "Project", dueDate: "2026-11-20", weight: 10 },
];

for (const a of assessments) {
  const courseId = courseIds[a.courseCode];
  if (!courseId) { console.log(`No course for ${a.courseCode}, skipping ${a.title}`); continue; }

  const existing = await prisma.assessment.findFirst({
    where: { userId: USER_ID, courseId, title: a.title },
  });
  if (existing) { console.log(`  Skipping assessment: ${a.title} (exists)`); continue; }

  await prisma.assessment.create({
    data: {
      userId: USER_ID,
      courseId,
      title: a.title,
      type: a.type,
      dueDate: new Date(a.dueDate + "T23:59:00Z"),
      weight: a.weight,
      status: "Upcoming",
    },
  });
  console.log(`  Assessment: ${a.courseCode} — ${a.title} (${a.dueDate})`);
}

// Step 4: Create projects for courses that have group projects

// MCG 4151 - Design project (50% of grade)
const mcg4151Project = await prisma.project.findFirst({
  where: { userId: USER_ID, title: "MCG4151 — Joint Prosthesis Design Project" },
});
if (!mcg4151Project && courseIds["MCG4151"]) {
  await prisma.project.create({
    data: {
      userId: USER_ID,
      courseId: courseIds["MCG4151"],
      title: "MCG4151 — Joint Prosthesis Design Project",
      description: "Design a joint prosthesis or implant. Group project worth 50% of the course grade.",
      status: "InProgress",
      progress: 0,
    },
  });
  console.log("Created project: MCG4151 Joint Prosthesis Design");
}

// GNG 1503 - Chatbot holographique project (30% deliverables)
const gng1503Project = await prisma.project.findFirst({
  where: { userId: USER_ID, title: "GNG1503 — Chatbot holographique INNOVA" },
});
if (!gng1503Project && courseIds["GNG1503"]) {
  await prisma.project.create({
    data: {
      userId: USER_ID,
      courseId: courseIds["GNG1503"],
      title: "GNG1503 — Chatbot holographique INNOVA",
      description: "Concevoir un chatbot bilingue capable d'interagir via une boîte holographique et un avatar. Budget: 50$/équipe. Journée de Conception: 3 décembre 2026.",
      status: "InProgress",
      progress: 0,
    },
  });
  console.log("Created project: GNG1503 Chatbot holographique");
}

// MCG 4366 - Capstone project (100% project-based)
const mcg4366Project = await prisma.project.findFirst({
  where: { userId: USER_ID, title: "MCG4366 — Biomedical Capstone Project" },
});
if (!mcg4366Project && courseIds["MCG4366"]) {
  await prisma.project.create({
    data: {
      userId: USER_ID,
      courseId: courseIds["MCG4366"],
      title: "MCG4366 — Biomedical Capstone Project",
      description: "Year-long capstone design project in biomedical mechanical engineering. Groups of 5. Multiple report deliverables through Fall 2026 and Winter 2027.",
      status: "InProgress",
      progress: 0,
      milestones: {
        create: [
          { title: "Literature Review Report", dueDate: new Date("2026-10-02"), status: "Pending", sortOrder: 0 },
          { title: "Conceptual Design Report", dueDate: new Date("2026-11-20"), status: "Pending", sortOrder: 1 },
        ],
      },
    },
  });
  console.log("Created project: MCG4366 Capstone with milestones");
}

await prisma.$disconnect();
console.log("\nDone! All real course data seeded.");
