// Adds the AgentAction table: the assistant's log of what it changed (see prisma/schema.prisma).
// Additive only: nothing existing is altered, and running it twice is harmless.
// Same Neon-over-WebSocket route as the other migrate-*.mjs scripts.
//
//   node scripts/migrate-agent-log.mjs            apply
//   node scripts/migrate-agent-log.mjs --dry-run  print the SQL, touch nothing
//
// To undo: DROP TABLE "AgentAction"; (only the log is lost; no other data depends on it).
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const statements = [
  `CREATE TABLE IF NOT EXISTS "AgentAction" (
     "id" TEXT NOT NULL,
     "userId" TEXT NOT NULL,
     "opId" TEXT NOT NULL,
     "source" TEXT NOT NULL,
     "status" TEXT NOT NULL,
     "summary" TEXT NOT NULL,
     "undo" JSONB,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "undoneAt" TIMESTAMP(3),
     CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
   )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "AgentAction_userId_opId_key" ON "AgentAction"("userId", "opId")`,

  `CREATE INDEX IF NOT EXISTS "AgentAction_userId_createdAt_idx" ON "AgentAction"("userId", "createdAt")`,

  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentAction_userId_fkey') THEN
       ALTER TABLE "AgentAction"
         ADD CONSTRAINT "AgentAction_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$`,
];

if (process.argv.includes("--dry-run")) {
  for (const sql of statements) console.log(`${sql};\n`);
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=["']?([^"']*)["']?$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

for (const sql of statements) {
  await prisma.$executeRawUnsafe(sql);
  console.log(`  ok: ${sql.trim().split("\n")[0].slice(0, 70)}…`);
}

await prisma.$disconnect();
console.log("\nMigration terminée : table AgentAction.");
