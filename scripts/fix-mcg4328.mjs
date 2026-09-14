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

const course = await prisma.course.findFirst({ where: { userId: USER_ID, code: "MCG4328" } });
if (!course) { console.error("MCG4328 not found"); process.exit(1); }

// Remove invented dates from assignments (except Midterm Nov 2 and Final which are real from syllabus)
const assignments = await prisma.assessment.findMany({
  where: { userId: USER_ID, courseId: course.id },
});

for (const a of assignments) {
  // Midterm and Final exam dates stay (those were in the syllabus: Midterm Nov 2, Final 60%)
  if (a.title === "Midterm Exam" || a.title === "Final Exam") {
    console.log(`  Keeping: ${a.title} (${a.dueDate?.toISOString().slice(0, 10)})`);
    continue;
  }
  // All other dates were invented — null them out
  await prisma.assessment.update({
    where: { id: a.id },
    data: { dueDate: null },
  });
  console.log(`  Cleared date: ${a.title}`);
}

// Remove invented dates and topics from lab sessions
const labs = await prisma.labSession.findMany({
  where: { userId: USER_ID, courseId: course.id },
});

for (const lab of labs) {
  await prisma.labSession.update({
    where: { id: lab.id },
    data: { date: null, dueDate: null, topic: null },
  });
  console.log(`  Cleared lab ${lab.labNumber} dates/topic`);
}

await prisma.$disconnect();
console.log("\nMCG4328: all invented dates removed.");
