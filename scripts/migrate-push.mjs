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
  `CREATE TABLE IF NOT EXISTS "PushSubscription" (
     "id" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "endpoint" TEXT NOT NULL,
     "p256dh" TEXT NOT NULL,
     "auth" TEXT NOT NULL,
     "label" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "lastSentAt" TIMESTAMP(3),
     CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
   )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint")`,

  `CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId")`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PushSubscription_userId_fkey') THEN
       ALTER TABLE "PushSubscription"
         ADD CONSTRAINT "PushSubscription_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
];

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql);
  console.log(`  ok: ${sql.trim().split("\n")[0].slice(0, 70)}…`);
}

await prisma.$disconnect();
console.log("\nMigration terminée : table PushSubscription.");
