// Creates a new account. Refuses if the email is taken, so it can never overwrite
// someone's login. Credentials come from the environment to stay out of shell history:
//   LOGIN_NAME="Ada Lovelace" LOGIN_EMAIL=ada@example.com [LOGIN_PASSWORD=...] node scripts/create-account.mjs
// Without LOGIN_PASSWORD a readable one is generated and printed once.
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
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

const name = process.env.LOGIN_NAME?.trim();
const email = process.env.LOGIN_EMAIL?.trim().toLowerCase();

if (!name || !email) {
  console.error("LOGIN_NAME et LOGIN_EMAIL sont requis.");
  process.exit(1);
}

// No 0/O/1/l/I — this gets typed on a phone keyboard.
function generatePassword(length = 14) {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

const password = process.env.LOGIN_PASSWORD || generatePassword();
const generated = !process.env.LOGIN_PASSWORD;

if (password.length < 6) {
  console.error("Le mot de passe doit faire au moins 6 caractères (règle de registerAction).");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  console.error(`L'adresse ${email} a déjà un compte (${existing.id}). Rien n'a été modifié.`);
  await prisma.$disconnect();
  process.exit(1);
}

// Same cost factor as registerAction, so this hash is indistinguishable from a signup.
const hashed = await bcrypt.hash(password, 12);
const user = await prisma.user.create({ data: { name, email, password: hashed } });

const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } });
const verified = await bcrypt.compare(password, fresh.password);

console.log(`Compte créé : ${user.id}`);
console.log(`  nom          : ${user.name}`);
console.log(`  email        : ${user.email}`);
if (generated) console.log(`  mot de passe : ${password}`);
console.log(`  vérification : ${verified ? "bcrypt.compare OK" : "ÉCHEC"}`);

const counts = {
  cours: await prisma.course.count({ where: { userId: user.id } }),
  evaluations: await prisma.assessment.count({ where: { userId: user.id } }),
  taches: await prisma.task.count({ where: { userId: user.id } }),
};
console.log(`  contenu      : ${JSON.stringify(counts)}`);

await prisma.$disconnect();
process.exit(verified ? 0 : 1);
