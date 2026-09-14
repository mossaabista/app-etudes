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
console.log(`Seeding CHM1711 labs: ${chm.id}`);

// Delete existing CHM1711 lab sessions
const deleted = await prisma.labSession.deleteMany({
  where: { userId: USER_ID, courseId: chm.id },
});
console.log(`Deleted ${deleted.count} existing lab sessions`);

// 5 experiments over 11 weeks, each spans 2 weeks
// Location: MRN 301
// Coordonnatrice: Dr. Rashmi Venkateswaran (vrashmi@uottawa.ca)
// Pre-lab on Stemble (80% min) required before each session
// Reports submitted on Stemble
// Experiments 1-3 before reading week, 4-5 after
// Week 11 = make-up week
// Exact dates depend on user's lab section (odd/even) — TBD

const labs = [
  {
    labNumber: 1,
    title: "Expérience 1",
    topic: "À déterminer (semaines 1-2)",
    deliverable: "Pré-lab Stemble + Rapport Stemble",
    notes: "Pré-lab sur Stemble (min 80%) obligatoire avant la séance. Rapport soumis sur Stemble.",
  },
  {
    labNumber: 2,
    title: "Expérience 2",
    topic: "À déterminer (semaines 3-4)",
    deliverable: "Pré-lab Stemble + Rapport Stemble",
    notes: "Pré-lab sur Stemble (min 80%) obligatoire avant la séance. Rapport soumis sur Stemble.",
  },
  {
    labNumber: 3,
    title: "Expérience 3",
    topic: "À déterminer (semaines 5-6, avant semaine de lecture)",
    deliverable: "Pré-lab Stemble + Rapport Stemble",
    notes: "Pré-lab sur Stemble (min 80%) obligatoire avant la séance. Rapport soumis sur Stemble.",
  },
  {
    labNumber: 4,
    title: "Expérience 4",
    topic: "À déterminer (semaines 7-8, après semaine de lecture)",
    deliverable: "Pré-lab Stemble + Rapport Stemble",
    notes: "Pré-lab sur Stemble (min 80%) obligatoire avant la séance. Rapport soumis sur Stemble.",
  },
  {
    labNumber: 5,
    title: "Expérience 5",
    topic: "À déterminer (semaines 9-10)",
    deliverable: "Pré-lab Stemble + Rapport Stemble",
    notes: "Pré-lab sur Stemble (min 80%) obligatoire avant la séance. Rapport soumis sur Stemble.",
  },
];

for (const lab of labs) {
  await prisma.labSession.create({
    data: {
      userId: USER_ID,
      courseId: chm.id,
      labNumber: lab.labNumber,
      title: lab.title,
      date: null, // TBD — depends on user's lab section (odd/even)
      room: "MRN 301",
      topic: lab.topic,
      deliverable: lab.deliverable,
      dueDate: null, // TBD
      status: "Upcoming",
      notes: lab.notes,
    },
  });
  console.log(`  Lab ${lab.labNumber}: ${lab.title}`);
}

// Also add a lab schedule to the course if not already present
const existingLabSchedule = await prisma.courseSchedule.findFirst({
  where: { courseId: chm.id, type: "Lab" },
});

if (!existingLabSchedule) {
  // Don't add a specific day/time since we don't know the user's lab section yet
  // The user will need to tell us their section to add the schedule
  console.log("\nNote: No lab schedule added — user's lab section (day/time) is unknown.");
  console.log("Once known, add a Lab schedule entry for CHM1711.");
} else {
  console.log(`\nLab schedule already exists: ${existingLabSchedule.day} ${existingLabSchedule.startTime}-${existingLabSchedule.endTime}`);
}

await prisma.$disconnect();
console.log("\nCHM1711: 5 lab sessions created (dates TBD pending lab section info).");
console.log("Coordonnatrice: Dr. Rashmi Venkateswaran (vrashmi@uottawa.ca)");
console.log("Lieu: MRN 301 | Évaluation: 15% | Plateforme: Stemble ($45)");
console.log("Équipement: sarrau ($34 AES), lunettes ($13 AES), cahier de lab (100+ pages)");
