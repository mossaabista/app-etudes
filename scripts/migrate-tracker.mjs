// Adds the TrackerEntry table behind the section pages under /tasks/[area]/[sub].
// Additive only: nothing existing is altered. Same Neon-over-WebSocket route as the other
// migrate-*.mjs scripts, since the Prisma CLI cannot reach the database from here.
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

const statements = [
  `CREATE TABLE IF NOT EXISTS "TrackerEntry" (
     "id" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "module" TEXT NOT NULL,
     "kind" TEXT NOT NULL,
     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "text" TEXT,
     "value" DOUBLE PRECISION,
     "done" BOOLEAN NOT NULL DEFAULT false,
     "data" JSONB,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL,
     CONSTRAINT "TrackerEntry_pkey" PRIMARY KEY ("id")
   )`,

  `CREATE INDEX IF NOT EXISTS "TrackerEntry_userId_module_date_idx" ON "TrackerEntry"("userId", "module", "date")`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrackerEntry_userId_fkey') THEN
       ALTER TABLE "TrackerEntry"
         ADD CONSTRAINT "TrackerEntry_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
];

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql);
  console.log(`  ok: ${sql.trim().split("\n")[0].slice(0, 70)}…`);
}

await prisma.$disconnect();
console.log("\nMigration terminée : table TrackerEntry.");
