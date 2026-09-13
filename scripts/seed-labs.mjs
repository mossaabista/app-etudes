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
const USER_ID = users[0].id;

// Get courses
const gng = await prisma.course.findFirst({ where: { userId: USER_ID, code: "GNG1503" } });
const mcg4366 = await prisma.course.findFirst({ where: { userId: USER_ID, code: "MCG4366" } });
const mcg4328 = await prisma.course.findFirst({ where: { userId: USER_ID, code: "MCG4328" } });

// GNG1503 Labs - Monday 11:30-14:20, MakerLab 119
// Design process labs aligned with project deliverables
if (gng) {
  const existing = await prisma.labSession.count({ where: { userId: USER_ID, courseId: gng.id } });
  if (existing === 0) {
    const gngLabs = [
      { n: 1, date: "2026-09-14", topic: "Introduction au MakerLab & Formation sécurité", deliverable: null, dueDate: null },
      { n: 2, date: "2026-09-21", topic: "Outils de prototypage rapide", deliverable: null, dueDate: null },
      { n: 3, date: "2026-09-28", topic: "Empathie & Recherche terrain", deliverable: "Compte-rendu d'empathie", dueDate: "2026-10-04" },
      { n: 4, date: "2026-10-05", topic: "Idéation et brainstorming", deliverable: null, dueDate: null },
      { n: 5, date: "2026-10-19", topic: "Modélisation CAO & Impression 3D", deliverable: "Fichiers CAO", dueDate: "2026-10-25" },
      { n: 6, date: "2026-10-26", topic: "Prototypage — Version 1", deliverable: "Rapport de prototype V1", dueDate: "2026-11-01" },
      { n: 7, date: "2026-11-02", topic: "Tests ciblés du prototype", deliverable: "Rapport de tests ciblés", dueDate: "2026-11-08" },
      { n: 8, date: "2026-11-09", topic: "Itération et amélioration", deliverable: "Documentation d'itération", dueDate: "2026-11-15" },
      { n: 9, date: "2026-11-16", topic: "Tests complets du prototype", deliverable: "Rapport de tests complets", dueDate: "2026-11-22" },
      { n: 10, date: "2026-11-23", topic: "Préparation Journée de Conception", deliverable: "Poster & Démo", dueDate: "2026-12-03" },
      { n: 11, date: "2026-11-30", topic: "Finition et documentation", deliverable: "Manuel d'utilisateur", dueDate: "2026-12-06" },
    ];
    for (const lab of gngLabs) {
      await prisma.labSession.create({
        data: {
          userId: USER_ID, courseId: gng.id, labNumber: lab.n,
          title: `Lab ${lab.n} — ${lab.topic}`,
          date: new Date(lab.date + "T11:30:00Z"),
          room: "MakerLab 119",
          topic: lab.topic,
          deliverable: lab.deliverable,
          dueDate: lab.dueDate ? new Date(lab.dueDate + "T23:59:00Z") : null,
          status: "Upcoming",
        },
      });
    }
    console.log(`Created ${gngLabs.length} labs for GNG1503`);
  } else {
    console.log("GNG1503 labs already exist, skipping");
  }
}

// MCG4366 Labs - Wednesday 16:00-18:50, CBY C011
// Capstone project lab sessions
if (mcg4366) {
  const existing = await prisma.labSession.count({ where: { userId: USER_ID, courseId: mcg4366.id } });
  if (existing === 0) {
    const capstoneLabs = [
      { n: 1, date: "2026-09-16", topic: "Project kickoff & Lab orientation", deliverable: null, dueDate: null },
      { n: 2, date: "2026-09-23", topic: "Literature review workshop", deliverable: "Literature Review Draft", dueDate: "2026-10-02" },
      { n: 3, date: "2026-09-30", topic: "Research methodology", deliverable: null, dueDate: null },
      { n: 4, date: "2026-10-07", topic: "Concept generation", deliverable: null, dueDate: null },
      { n: 5, date: "2026-10-14", topic: "CAD modeling session", deliverable: "CAD Models V1", dueDate: "2026-10-21" },
      { n: 6, date: "2026-10-21", topic: "Design analysis", deliverable: null, dueDate: null },
      { n: 7, date: "2026-11-04", topic: "Prototype planning", deliverable: null, dueDate: null },
      { n: 8, date: "2026-11-11", topic: "Fabrication & Assembly", deliverable: "Progress Report", dueDate: "2026-11-18" },
      { n: 9, date: "2026-11-18", topic: "Testing & Validation", deliverable: "Test Results", dueDate: "2026-11-20" },
      { n: 10, date: "2026-11-25", topic: "Final design review", deliverable: "Conceptual Design Report", dueDate: "2026-11-20" },
      { n: 11, date: "2026-12-02", topic: "Report writing workshop", deliverable: null, dueDate: null },
    ];
    for (const lab of capstoneLabs) {
      await prisma.labSession.create({
        data: {
          userId: USER_ID, courseId: mcg4366.id, labNumber: lab.n,
          title: `Lab ${lab.n} — ${lab.topic}`,
          date: new Date(lab.date + "T16:00:00Z"),
          room: "CBY C011",
          topic: lab.topic,
          deliverable: lab.deliverable,
          dueDate: lab.dueDate ? new Date(lab.dueDate + "T23:59:00Z") : null,
          status: "Upcoming",
        },
      });
    }
    console.log(`Created ${capstoneLabs.length} labs for MCG4366`);
  } else {
    console.log("MCG4366 labs already exist, skipping");
  }
}

// MCG4328 Labs - schedule not specified but has 4 lab reports
if (mcg4328) {
  const existing = await prisma.labSession.count({ where: { userId: USER_ID, courseId: mcg4328.id } });
  if (existing === 0) {
    // Add lab schedule to the course if not present
    const hasLabSchedule = await prisma.courseSchedule.findFirst({ where: { courseId: mcg4328.id, type: "Lab" } });
    if (!hasLabSchedule) {
      await prisma.courseSchedule.create({
        data: { courseId: mcg4328.id, day: "Thursday", startTime: "14:30", endTime: "17:20", type: "Lab", room: "CBY A217" },
      });
      console.log("Added lab schedule to MCG4328");
    }

    const mfgLabs = [
      { n: 1, date: "2026-09-17", topic: "Casting & Molding", deliverable: "Lab Report 1", dueDate: "2026-10-12" },
      { n: 2, date: "2026-10-08", topic: "Metal Forming", deliverable: "Lab Report 2", dueDate: "2026-11-02" },
      { n: 3, date: "2026-10-29", topic: "Machining Processes", deliverable: "Lab Report 3", dueDate: "2026-11-23" },
      { n: 4, date: "2026-11-19", topic: "Welding & Joining", deliverable: "Lab Report 4", dueDate: "2026-12-07" },
    ];
    for (const lab of mfgLabs) {
      await prisma.labSession.create({
        data: {
          userId: USER_ID, courseId: mcg4328.id, labNumber: lab.n,
          title: `Lab ${lab.n} — ${lab.topic}`,
          date: new Date(lab.date + "T14:30:00Z"),
          room: "CBY A217",
          topic: lab.topic,
          deliverable: lab.deliverable,
          dueDate: lab.dueDate ? new Date(lab.dueDate + "T23:59:00Z") : null,
          status: "Upcoming",
        },
      });
    }
    console.log(`Created ${mfgLabs.length} labs for MCG4328`);
  } else {
    console.log("MCG4328 labs already exist, skipping");
  }
}

await prisma.$disconnect();
console.log("\nDone! Lab sessions seeded.");
