// Sets the name, email and password of an existing account.
// Credentials come from the environment so they never land in shell history or argv:
//   LOGIN_NAME="Ada Lovelace" LOGIN_EMAIL=ada@example.com LOGIN_PASSWORD=... node scripts/set-login.mjs
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import bcrypt from "bcryptjs";
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
const password = process.env.LOGIN_PASSWORD;

if (!name || !email || !password) {
  console.error("LOGIN_NAME, LOGIN_EMAIL et LOGIN_PASSWORD sont requis.");
  process.exit(1);
}
if (password.length < 6) {
  console.error("Le mot de passe doit faire au moins 6 caractères (règle de registerAction).");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
const targetId = process.env.LOGIN_TARGET_ID ?? (users.length === 1 ? users[0].id : null);

if (!targetId) {
  console.error(`${users.length} comptes trouvés — précise LOGIN_TARGET_ID :`);
  for (const u of users) console.error(`  ${u.id}  ${u.email}`);
  process.exit(1);
}

const clash = await prisma.user.findUnique({ where: { email } });
if (clash && clash.id !== targetId) {
  console.error(`L'adresse ${email} appartient déjà à un autre compte.`);
  process.exit(1);
}

// Same cost factor as registerAction, so this hash is indistinguishable from a real signup.
const hashed = await bcrypt.hash(password, 12);
const updated = await prisma.user.update({
  where: { id: targetId },
  data: { name, email, password: hashed },
});

// Prove the stored hash actually validates the password before reporting success.
const fresh = await prisma.user.findUnique({ where: { id: targetId }, select: { password: true } });
const verified = await bcrypt.compare(password, fresh.password);

console.log(`Compte mis à jour : ${updated.id}`);
console.log(`  nom           : ${updated.name}`);
console.log(`  email         : ${updated.email}`);
console.log(`  mot de passe  : ${verified ? "vérifié (bcrypt.compare OK)" : "ÉCHEC DE VÉRIFICATION"}`);

await prisma.$disconnect();
process.exit(verified ? 0 : 1);
