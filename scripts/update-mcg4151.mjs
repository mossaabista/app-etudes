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

const course = await prisma.course.findFirst({ where: { userId: USER_ID, code: "MCG4151" } });
if (!course) { console.error("MCG4151 not found"); process.exit(1); }
console.log(`Updating MCG4151: ${course.id}`);

// Delete old assessments for MCG4151
await prisma.assessment.deleteMany({ where: { userId: USER_ID, courseId: course.id } });
console.log("Deleted old MCG4151 assessments");

// Create correct assessments from course schedule PDF
const assessments = [
  { title: "Assignment 1", type: "Assignment", dueDate: "2026-09-24", weight: 12.5 },
  { title: "Quiz 1: Anatomy & Physiology", type: "Quiz", dueDate: "2026-09-25", weight: 2.86 },
  { title: "Quiz 2: Muscul. Sys. & Joints", type: "Quiz", dueDate: "2026-10-02", weight: 2.86 },
  { title: "Quiz 3: Human Gait Analysis", type: "Quiz", dueDate: "2026-10-09", weight: 2.86 },
  { title: "Assignment 2", type: "Assignment", dueDate: "2026-10-15", weight: 12.5 },
  { title: "Quiz 4: Loads & Motion", type: "Quiz", dueDate: "2026-10-16", weight: 2.86 },
  { title: "Quiz 5: Tissue Mechanics I", type: "Quiz", dueDate: "2026-10-23", weight: 2.86 },
  { title: "Assignment 3", type: "Assignment", dueDate: "2026-11-05", weight: 12.5 },
  { title: "Quiz 6: Tissue Mechanics II, III", type: "Quiz", dueDate: "2026-11-13", weight: 2.86 },
  { title: "Assignment 4", type: "Assignment", dueDate: "2026-11-23", weight: 12.5 },
  { title: "Quiz 7: Joint Replacement Design", type: "Quiz", dueDate: "2026-11-27", weight: 2.86 },
  { title: "Presentation Slides", type: "Project", dueDate: "2026-12-04", weight: 10 },
  { title: "Project Presentations", type: "Project", dueDate: "2026-12-07", weight: 20 },
  { title: "Final Report", type: "Project", dueDate: "2026-12-09", weight: 20 },
  { title: "Final Exam", type: "Exam", dueDate: "2026-12-15", weight: 30 },
];

for (const a of assessments) {
  await prisma.assessment.create({
    data: {
      userId: USER_ID,
      courseId: course.id,
      title: a.title,
      type: a.type,
      dueDate: new Date(a.dueDate + "T23:59:00Z"),
      weight: a.weight,
      status: "Upcoming",
    },
  });
  console.log(`  ${a.title} — ${a.dueDate}`);
}

await prisma.$disconnect();
console.log("\nMCG4151 updated with correct schedule dates.");
