// One-off runner for the Brightspace import, used because the local dev server would
// not bind. It uses the project's own compiled iCal parser and mirrors the filtering and
// matching rules of src/server/brightspace/sync.ts exactly — keep the two in step if
// either changes. Dry-run by default.
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../src/generated/prisma/index.js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=["']?([^"']*)["']?$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const BUILD = process.env.ICS_BUILD;
if (!BUILD) { console.error("ICS_BUILD doit pointer sur le dossier du parseur compilé."); process.exit(1); }
const { parseIcs } = await import(pathToFileURL(resolve(BUILD, "ics.js")).href);

neonConfig.webSocketConstructor = ws;
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

const EMAIL = process.env.TARGET_EMAIL;
const APPLY = process.argv.includes("--apply");

// Identical to sync.ts
const STALE_AFTER_DAYS = 30;
const DEADLINE_MARKER = /\s*[–\-−]\s*(?:à\s*échéance|échéance|dû|due|fin de la\s*disponibilit\S*)\s*$/i;
const AVAILABILITY_MARKER = /\s*[–\-−]\s*(?:disponible|available)\s*$/i;

const normalizeKey = (v) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function inferType(summary) {
  const t = summary.toLowerCase();
  if (/\b(final|midterm|mi-session|exam|examen|test)\b/.test(t)) return "Exam";
  if (/\b(quiz|questionnaire)\b/.test(t)) return "Quiz";
  if (/\b(lab|laboratoire|pré-?lab|pre-?lab)\b/.test(t)) return "Lab";
  if (/\b(project|projet)\b/.test(t)) return "Project";
  if (/\b(presentation|présentation|exposé)\b/.test(t)) return "Presentation";
  return "Assignment";
}

function cleanTitle(summary, course) {
  if (!course) return summary;
  const segments = summary.split(" - ");
  if (segments.length < 2) return summary;
  const codeKey = normalizeKey(course.code);
  const nameKey = normalizeKey(course.name);
  const kept = segments.filter((seg, i) => {
    if (i === 0) return true;
    const k = normalizeKey(seg);
    return !k.includes(codeKey) && !(nameKey.length > 4 && k.includes(nameKey));
  });
  return kept.join(" - ").trim() || summary;
}

const user = await prisma.user.findUnique({ where: { email: EMAIL } });
if (!user) { console.error(`Compte ${EMAIL} introuvable.`); process.exit(1); }

const source = await prisma.syncSource.findUnique({
  where: { userId_provider: { userId: user.id, provider: "brightspace" } },
});
if (!source) { console.error("Aucun flux configuré."); process.exit(1); }

const res = await fetch(source.feedUrl, { redirect: "follow" });
if (!res.ok) { console.error(`Brightspace a répondu ${res.status}.`); process.exit(1); }
const events = parseIcs(await res.text());

const courses = await prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true, name: true } });
const byCode = courses.map((c) => ({ c, k: normalizeKey(c.code) })).sort((a, b) => b.k.length - a.k.length);
const byName = courses.map((c) => ({ c, k: normalizeKey(c.name) })).filter((e) => e.k.length >= 10).sort((a, b) => b.k.length - a.k.length);
const findCourse = (e) => {
  const hay = normalizeKey([e.location, e.summary, e.description, e.url].filter(Boolean).join(" "));
  return (byCode.find((x) => hay.includes(x.k)) ?? byName.find((x) => hay.includes(x.k)))?.c ?? null;
};

const existing = await prisma.assessment.findMany({
  where: { userId: user.id, externalUid: { not: null } },
  select: { id: true, externalUid: true, title: true, dueDate: true },
});
const byUid = new Map(existing.map((a) => [a.externalUid, a]));
const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 86400000);

const plan = { create: [], update: [], unchanged: 0, skip: 0 };

for (const event of events) {
  const summary = event.summary || "Sans titre";
  const due = event.end ?? event.start;
  const course = findCourse(event);

  if (event.recurring || !due || AVAILABILITY_MARKER.test(summary) || due < staleBefore || !course) {
    plan.skip++;
    continue;
  }

  const title = cleanTitle(summary.replace(DEADLINE_MARKER, "").trim() || summary, course);
  const type = inferType(summary);
  const match = byUid.get(event.uid);

  if (!match) {
    plan.create.push({ uid: event.uid, courseId: course.id, code: course.code, title, type, due, url: event.url ?? null });
  } else if (match.title !== title || match.dueDate?.getTime() !== due.getTime()) {
    plan.update.push({ id: match.id, code: course.code, title, due, url: event.url ?? null });
  } else {
    plan.unchanged++;
  }
}

console.log(`${events.length} événements | ${plan.create.length} nouveaux | ${plan.update.length} modifiés | ${plan.unchanged} inchangés | ${plan.skip} ignorés\n`);

const groups = {};
for (const c of plan.create) (groups[c.code] ??= []).push(c);
for (const code of Object.keys(groups).sort()) {
  console.log(`${code} — ${groups[code].length}`);
  for (const c of groups[code].sort((a, b) => a.due - b.due)) {
    console.log(`   ${c.due.toISOString().slice(0, 16).replace("T", " ")}  ${c.type.padEnd(10)} ${c.title.slice(0, 60)}`);
  }
}

if (!APPLY) {
  console.log("\n(simulation — relancer avec --apply)");
  await prisma.$disconnect();
  process.exit(0);
}

for (const c of plan.create) {
  await prisma.assessment.create({
    data: {
      userId: user.id, courseId: c.courseId, title: c.title, type: c.type,
      dueDate: c.due, status: "Upcoming", source: "brightspace",
      externalUid: c.uid, externalUrl: c.url,
    },
  });
}
for (const u of plan.update) {
  await prisma.assessment.update({ where: { id: u.id }, data: { title: u.title, dueDate: u.due, externalUrl: u.url } });
}
await prisma.syncSource.update({
  where: { id: source.id },
  data: { lastStatus: "ok", lastMessage: `${plan.create.length} ajoutés, ${plan.update.length} mis à jour`, lastSyncedAt: new Date() },
});

console.log(`\n${plan.create.length} évaluations importées.`);
await prisma.$disconnect();
