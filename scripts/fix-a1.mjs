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
const course = await prisma.course.findFirst({ where: { userId: USER_ID, code: "MCG4328" } });

const a1 = await prisma.assessment.findFirst({
  where: { userId: USER_ID, courseId: course.id, title: "Assignment 1" },
});
if (a1) {
  await prisma.assessment.update({
    where: { id: a1.id },
    data: {
      title: "Assignment 1 — Casting and Machining Processes",
      dueDate: new Date("2026-10-16T19:00:00Z"),
    },
  });
  console.log("Updated: Assignment 1 — Casting and Machining Processes, due Oct 16 7PM");
} else {
  console.log("Assignment 1 not found");
}

await prisma.$disconnect();
