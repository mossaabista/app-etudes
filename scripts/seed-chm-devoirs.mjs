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

// Delete the generic "Devoirs (ensemble)" placeholder
await prisma.assessment.deleteMany({
  where: { userId: USER_ID, courseId: chm.id, title: "Devoirs (ensemble)" },
});
console.log("Removed placeholder 'Devoirs (ensemble)'");

// 26 Brightspace activities grouped by due date
// 10% total, 800 points, 760+ = 10/10
// Each has +72h extension after due date

const devoirs = [
  // Lot 1: Due Oct 2 (extension Oct 5) — 7 activités
  { title: "Devoir: Introduction", dueDate: "2026-10-02T23:59:00Z", ext: "2026-10-05T23:59:00Z" },
  { title: "Devoir: Théorie atomique", dueDate: "2026-10-02T23:59:00Z", ext: "2026-10-05T23:59:00Z" },
  { title: "Devoir: Nomenclature des oxacides", dueDate: "2026-10-02T23:59:00Z", ext: "2026-10-05T23:59:00Z" },
  { title: "Devoir: Nomenclature oxacides et oxanions", dueDate: "2026-10-02T23:59:00Z", ext: "2026-10-05T23:59:00Z" },
  { title: "Devoir: Stoechiométrie", dueDate: "2026-10-02T23:59:00Z", ext: "2026-10-05T10:00:00Z" },
  { title: "Devoir: Gaz parfaits", dueDate: "2026-10-02T23:59:00Z", ext: "2026-10-05T23:59:00Z" },
  { title: "Devoir: Théorie cinétique des gaz", dueDate: "2026-10-02T23:59:00Z", ext: "2026-10-05T23:59:00Z" },

  // Lot 2: Due Nov 6 (extension Nov 9) — 5 activités
  { title: "Devoir: Première loi de la thermo", dueDate: "2026-11-06T23:59:00Z", ext: "2026-11-09T23:59:00Z" },
  { title: "Devoir: Quantités thermodynamiques", dueDate: "2026-11-06T23:59:00Z", ext: "2026-11-09T23:59:00Z" },
  { title: "Devoir: Constantes d'équilibre", dueDate: "2026-11-06T23:59:00Z", ext: "2026-11-09T23:59:00Z" },
  { title: "Devoir: Tableaux ICE (IVE)", dueDate: "2026-11-06T23:59:00Z", ext: "2026-11-09T23:59:00Z" },
  { title: "Devoir: Solubilité composés ioniques", dueDate: "2026-11-06T23:59:00Z", ext: "2026-11-09T23:59:00Z" },

  // Lot 3: Due Nov 27 (extension Nov 30) — 5 activités
  { title: "Devoir: Acides et bases", dueDate: "2026-11-27T23:59:00Z", ext: "2026-11-30T23:59:00Z" },
  { title: "Devoir: Titrages et solutions tampons", dueDate: "2026-11-27T23:59:00Z", ext: "2026-11-30T23:59:00Z" },
  { title: "Devoir: Produits de solubilité", dueDate: "2026-11-27T23:59:00Z", ext: "2026-11-30T23:59:00Z" },
  { title: "Devoir: Lois de vitesse", dueDate: "2026-11-27T23:59:00Z", ext: "2026-11-30T23:59:00Z" },
  { title: "Devoir: Cinétique chimique", dueDate: "2026-11-27T23:59:00Z", ext: "2026-11-30T23:59:00Z" },

  // Lot 4: Due Dec 11 (extension Dec 14) — 3 activités listées (6 manquantes au total)
  { title: "Devoir: Découvertes scientifiques", dueDate: "2026-12-11T23:59:00Z", ext: "2026-12-14T23:59:00Z" },
  { title: "Devoir: Nombres quantiques", dueDate: "2026-12-11T23:59:00Z", ext: "2026-12-14T23:59:00Z" },
  { title: "Devoir: Charges effectives", dueDate: "2026-12-11T23:59:00Z", ext: "2026-12-14T23:59:00Z" },
];

for (const d of devoirs) {
  const existing = await prisma.assessment.findFirst({
    where: { userId: USER_ID, courseId: chm.id, title: d.title },
  });
  if (existing) { console.log(`  Skipping: ${d.title}`); continue; }

  await prisma.assessment.create({
    data: {
      userId: USER_ID,
      courseId: chm.id,
      title: d.title,
      type: "Assignment",
      dueDate: new Date(d.dueDate),
      weight: null, // 10% total for all 26, scored out of 800pts
      status: "Upcoming",
      notes: `Extension +72h jusqu'au ${d.ext.slice(0, 10)}. Soumissions illimitées, meilleure note retenue.`,
    },
  });
  console.log(`  ${d.title} — due ${d.dueDate.slice(0, 10)}`);
}

console.log(`\n${devoirs.length} devoirs ajoutés (20 sur 26 connus).`);
console.log("Note: 6 activités manquantes, probablement dans le lot de décembre.");

await prisma.$disconnect();
