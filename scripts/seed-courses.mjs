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

const courses = [
  {
    code: "MAT1720",
    name: "Calcul différentiel et intégral I",
    professor: "Dr. Bhatt",
    room: "LMX 225",
    color: "#8b5cf6",
    term: "Fall 2026",
    schedules: [
      { day: "Monday", startTime: "08:30", endTime: "09:50", type: "Lecture", room: "LMX 225" },
      { day: "Wednesday", startTime: "08:30", endTime: "09:50", type: "Lecture", room: "LMX 225" },
      { day: "Friday", startTime: "10:00", endTime: "11:20", type: "DGD", room: "STE 206" },
    ],
  },
  {
    code: "PHY1721",
    name: "Principes de physique I",
    professor: "Dr. Bhatt",
    room: "MCD 214",
    color: "#f59e0b",
    term: "Fall 2026",
    schedules: [
      { day: "Tuesday", startTime: "10:00", endTime: "11:20", type: "Lecture", room: "MCD 214" },
      { day: "Thursday", startTime: "10:00", endTime: "11:20", type: "Lecture", room: "MCD 214" },
      { day: "Wednesday", startTime: "14:30", endTime: "17:20", type: "Lab", room: "MCD 130" },
    ],
  },
  {
    code: "BIO1530",
    name: "Introduction à la biologie",
    professor: "Dr. Bhatt",
    room: "SMD 224",
    color: "#22c55e",
    term: "Fall 2026",
    schedules: [
      { day: "Monday", startTime: "13:00", endTime: "14:20", type: "Lecture", room: "SMD 224" },
      { day: "Wednesday", startTime: "13:00", endTime: "14:20", type: "Lecture", room: "SMD 224" },
    ],
  },
  {
    code: "FRA1710",
    name: "Rédaction: théorie et pratique",
    professor: "Dr. Bhatt",
    room: "DMS 1140",
    color: "#ec4899",
    term: "Fall 2026",
    schedules: [
      { day: "Tuesday", startTime: "14:30", endTime: "15:50", type: "Lecture", room: "DMS 1140" },
      { day: "Thursday", startTime: "14:30", endTime: "15:50", type: "Lecture", room: "DMS 1140" },
    ],
  },
  {
    code: "ITI1500",
    name: "Introduction aux systèmes informatiques",
    professor: "Dr. Bhatt",
    room: "SITE B0138",
    color: "#ef4444",
    term: "Fall 2026",
    schedules: [
      { day: "Monday", startTime: "10:00", endTime: "11:20", type: "Lecture", room: "SITE B0138" },
      { day: "Wednesday", startTime: "10:00", endTime: "11:20", type: "Lecture", room: "SITE B0138" },
      { day: "Friday", startTime: "13:00", endTime: "14:20", type: "Lab", room: "SITE 4080" },
    ],
  },
];

for (const c of courses) {
  const existing = await prisma.course.findFirst({ where: { userId: USER_ID, code: c.code } });
  if (existing) {
    console.log(`Skipping ${c.code} — already exists`);
    continue;
  }
  const course = await prisma.course.create({
    data: {
      userId: USER_ID,
      code: c.code,
      name: c.name,
      professor: c.professor,
      room: c.room,
      color: c.color,
      term: c.term,
      schedules: { create: c.schedules },
    },
  });
  console.log(`Created ${c.code}: ${course.id}`);
}

// Add schedules to CHM1711 if missing
const chm = await prisma.course.findFirst({ where: { userId: USER_ID, code: "CHM1711" }, include: { schedules: true } });
if (chm && chm.schedules.length === 0) {
  await prisma.courseSchedule.createMany({
    data: [
      { courseId: chm.id, day: "Tuesday", startTime: "08:30", endTime: "09:50", type: "Lecture", room: "MNT 263" },
      { courseId: chm.id, day: "Thursday", startTime: "08:30", endTime: "09:50", type: "Lecture", room: "MNT 263" },
      { courseId: chm.id, day: "Friday", startTime: "14:30", endTime: "17:20", type: "Lab", room: "MNT 045" },
    ],
  });
  console.log("Added schedules to CHM1711");
}

await prisma.$disconnect();
console.log("Done!");
