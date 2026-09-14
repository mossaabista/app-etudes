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
  `CREATE TABLE IF NOT EXISTS "SyncSource" (
     "id" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "provider" TEXT NOT NULL DEFAULT 'brightspace',
     "feedUrl" TEXT NOT NULL,
     "active" BOOLEAN NOT NULL DEFAULT true,
     "lastSyncedAt" TIMESTAMP(3),
     "lastStatus" TEXT,
     "lastMessage" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "SyncSource_pkey" PRIMARY KEY ("id")
   )`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SyncSource_userId_fkey') THEN
       ALTER TABLE "SyncSource"
         ADD CONSTRAINT "SyncSource_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "SyncSource_userId_provider_key" ON "SyncSource"("userId", "provider")`,

  `ALTER TABLE "Assessment"
     ADD COLUMN IF NOT EXISTS "source" TEXT,
     ADD COLUMN IF NOT EXISTS "externalUid" TEXT,
     ADD COLUMN IF NOT EXISTS "externalUrl" TEXT`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_userId_externalUid_key" ON "Assessment"("userId", "externalUid")`,

  `ALTER TABLE "CalendarEvent"
     ADD COLUMN IF NOT EXISTS "source" TEXT,
     ADD COLUMN IF NOT EXISTS "externalUid" TEXT,
     ADD COLUMN IF NOT EXISTS "externalUrl" TEXT`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "CalendarEvent_userId_externalUid_key" ON "CalendarEvent"("userId", "externalUid")`,
];

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql);
  console.log(`  ok: ${sql.trim().split("\n")[0].slice(0, 70)}…`);
}

await prisma.$disconnect();
console.log("\nMigration terminée : SyncSource + colonnes de synchronisation.");
