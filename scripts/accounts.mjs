// Lists every account and how much data each one holds.
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

for (const u of await prisma.user.findMany({ orderBy: { createdAt: "asc" } })) {
  const counts = {
    cours: await prisma.course.count({ where: { userId: u.id } }),
    evaluations: await prisma.assessment.count({ where: { userId: u.id } }),
    horaires: await prisma.courseSchedule.count({ where: { course: { userId: u.id } } }),
    labos: await prisma.labSession.count({ where: { userId: u.id } }),
    taches: await prisma.task.count({ where: { userId: u.id } }),
    projets: await prisma.project.count({ where: { userId: u.id } }),
    brightspace: await prisma.syncSource.count({ where: { userId: u.id } }),
    notifs: await prisma.pushSubscription.count({ where: { userId: u.id } }),
  };
  console.log(`${u.name}  <${u.email}>`);
  console.log(`  id : ${u.id}`);
  console.log(`  ${JSON.stringify(counts)}\n`);
}

await prisma.$disconnect();
