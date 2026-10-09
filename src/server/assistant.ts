import { prisma } from "@/lib/db";
import { APP_TIMEZONE, addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { IMAGES, LIBRARY_SUBS } from "@/lib/layout";
import { getLayout } from "@/server/layout";
import { getProfile } from "@/server/profile";

/**
 * The assistant behind the microphone, when ANTHROPIC_API_KEY is set. Claude reads the
 * sentence with the user's world in front of it — the page they are on, their sectors,
 * courses, assessments and the next days of their agenda — and answers with actions. It
 * never writes to the database itself: every action names ids it was shown, and
 * assistant-run.ts checks and runs each one. Without a key the rule-based parser in
 * lib/command takes over.
 */

export interface AssistantAction {
  op:
    | "create_event" | "create_task" | "move" | "delete" | "rename" | "complete"
    | "create_course"
    | "add_area" | "remove_area" | "rename_area" | "add_section" | "remove_section" | "rename_section"
    | "log" | "plan_revision" | "plan_day" | "navigate";
  id?: string;
  title?: string;
  date?: string | null;
  start?: string | null;
  end?: string | null;
  time?: string | null;
  section?: string;
  deadline?: boolean;
  code?: string;
  name?: string;
  professor?: string | null;
  color?: string | null;
  area?: string;
  label?: string;
  blurb?: string;
  library?: string | null;
  image?: string | null;
  intro?: string;
  blocks?: unknown[];
  sections?: { library?: string | null; label?: string; image?: string | null; intro?: string; blocks?: unknown[] }[];
  record?: "workout" | "water" | "meal" | "weight" | "sleep" | "expense" | "income" | "grocery";
  value?: number | null;
  items?: string[];
  assessment_ids?: string[];
  url?: string;
}

export interface AssistantPlan {
  actions: AssistantAction[];
  reply: string;
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

const MODEL = process.env.ASSISTANT_MODEL || "claude-haiku-4-5-20251001";

export const assistantEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const fmtDay = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(d);

const PAGE_NAMES: [RegExp, string][] = [
  [/^\/today/, "Aujourd'hui"],
  [/^\/calendar/, "Calendrier"],
  [/^\/courses\/[^/]+/, "la fiche d'un cours"],
  [/^\/courses/, "Cours (dossiers de cours)"],
  [/^\/tasks\/[^/]+\/[^/]+/, "une section d'un secteur"],
  [/^\/tasks\/[^/]+/, "un secteur"],
  [/^\/tasks/, "Secteurs (dossiers de vie)"],
  [/^\/settings/, "Réglages"],
  [/^\/syllabus/, "Import de syllabus"],
];

/** What Claude sees. */
export async function assistantContext(userId: string, page: string) {
  const today = toISODate(new Date());
  // The calendar page talks about the whole month; elsewhere ten days are plenty.
  const span = page.startsWith("/calendar") ? 31 : 10;
  const from = addDays(fromISODate(today)!, -1);
  const to = addDays(from, span + 1);
  const [events, tasks, done, assessments, labs, schedules, courses, layout, profile] = await Promise.all([
    prisma.calendarEvent.findMany({ where: { userId, date: { gte: from, lt: to } }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    prisma.task.findMany({ where: { userId, parentId: null, status: { not: "Done" }, OR: [{ dueDate: { gte: from, lt: to } }, { dueDate: null }] }, orderBy: { dueDate: "asc" }, take: 100 }),
    prisma.task.findMany({ where: { userId, status: "Done", updatedAt: { gte: fromISODate(today)! } }, select: { title: true } }),
    prisma.assessment.findMany({ where: { userId, status: { not: "Completed" }, dueDate: { gte: from, lt: addDays(from, 30) } }, include: { course: { select: { code: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.labSession.findMany({ where: { userId, status: { notIn: ["Completed", "Submitted"] }, dueDate: { gte: from, lt: to } }, include: { course: { select: { code: true } } } }),
    prisma.courseSchedule.findMany({ where: { course: { userId } }, include: { course: { select: { code: true } } } }),
    prisma.course.findMany({ where: { userId }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    getLayout(userId),
    getProfile(userId),
  ]);

  const lines: string[] = [];
  lines.push(`PAGE ACTUELLE : ${page} (${PAGE_NAMES.find(([re]) => re.test(page))?.[1] ?? "autre"})`);
  lines.push(`PROFIL : ${profile?.type ?? "inconnu"}`);
  lines.push("COURS : " + (courses.map((c) => `${c.code} « ${c.name} » (/courses/${c.id})`).join(" ; ") || "aucun"));
  lines.push("SECTEURS DE L'UTILISATEUR (clé « nom » : sections) :");
  for (const a of layout.areas) lines.push(`- ${a.key} « ${a.label} » : ${a.subs.map((s) => `${s.key} « ${s.label} »${s.custom ? " [sur mesure]" : s.lib && s.lib !== `${a.key}:${s.key}` ? ` [${s.lib}]` : ""}`).join(", ") || "vide"}`);
  lines.push("BIBLIOTHÈQUE DE SECTIONS (library) : " + LIBRARY_SUBS.map((s) => `${s.id} « ${s.label} »`).join(", "));
  lines.push("IMAGES : " + IMAGES.join(", "));
  lines.push("ÉVALUATIONS À VENIR (lecture seule, id pour plan_revision) :");
  for (const a of assessments) lines.push(`- id=${a.id} | ${fmtDay(a.dueDate!)} ${toISODate(a.dueDate!)} ${hhmm(a.dueDate!)} | ${a.course.code} | ${a.type} « ${a.title} »${a.weight != null ? ` | ${a.weight} %` : ""}`);

  const rel = (iso: string) => {
    const n = Math.round((fromISODate(iso)!.getTime() - fromISODate(today)!.getTime()) / 86400000);
    return n === -1 ? " (hier)" : n === 0 ? " (AUJOURD'HUI)" : n === 1 ? " (demain)" : n === 2 ? " (après-demain)" : "";
  };
  lines.push("AGENDA JOUR PAR JOUR :");
  for (let d = from; d < to; d = addDays(d, 1)) {
    const iso = toISODate(d);
    const rows: string[] = [];
    for (const s of schedules.filter((x) => x.day === dayName(d)).sort((a, b) => a.startTime.localeCompare(b.startTime)))
      rows.push(`  · ${s.startTime}–${s.endTime} COURS ${s.course.code} (${s.type}${s.room ? `, ${s.room}` : ""}) [lecture seule]`);
    for (const e of events.filter((x) => toISODate(x.date) === iso))
      rows.push(`  · ${e.startTime ?? "journée"}${e.endTime ? `–${e.endTime}` : ""} ÉVÉNEMENT « ${e.title} » [${e.type}${e.notes === "Planifié par le Pilote" ? ", Pilote" : ""}] id=e:${e.id}`);
    for (const t of tasks.filter((x) => x.dueDate && toISODate(x.dueDate) === iso))
      rows.push(`  · ${hhmm(t.dueDate!) === "23:59" ? "dans la journée" : `avant ${hhmm(t.dueDate!)}`} TÂCHE « ${t.title} » [${t.category ?? "sans section"}] id=t:${t.id}`);
    for (const a of assessments.filter((x) => toISODate(x.dueDate!) === iso)) rows.push(`  · ${hhmm(a.dueDate!)} À RENDRE ${a.type} « ${a.title} » (${a.course.code}) [lecture seule]`);
    for (const l of labs.filter((x) => toISODate(x.dueDate!) === iso)) rows.push(`  · ${hhmm(l.dueDate!)} À RENDRE Labo « ${l.title} » (${l.course.code}) [lecture seule]`);
    lines.push(`${fmtDay(d)} ${iso}${rel(iso)} :`);
    lines.push(...(rows.length ? rows : ["  · rien"]));
  }
  const undated = tasks.filter((t) => !t.dueDate);
  if (undated.length) lines.push("Tâches sans date :", ...undated.map((t) => `  · TÂCHE « ${t.title} » [${t.category ?? ""}] id=t:${t.id}`));
  lines.push(`Tâches cochées aujourd'hui : ${done.map((d) => d.title).join(" ; ") || "aucune"}`);

  return {
    text: lines.join("\n"),
    ids: new Set([...events.map((e) => `e:${e.id}`), ...tasks.map((t) => `t:${t.id}`)]),
    /** What each id is called, so a confirmation can say what it will touch. */
    labels: new Map([...events.map((e) => [`e:${e.id}`, e.title] as const), ...tasks.map((t) => [`t:${t.id}`, t.title] as const)]),
    assessmentIds: new Set(assessments.map((a) => a.id)),
  };
}

const BLOCKS_HELP =
  "blocks (section sur mesure) : liste d'objets parmi {type:'checklist', title, items:[...]} (cases à cocher chaque jour), {type:'log', title, unit, goal, period:'day'|'week'} (journal chiffré + graphique), {type:'list', title, placeholder} (liste à cocher), {type:'recurring', title, items:[{label, every (jours)}]}, {type:'tips', title, items:[conseils d'expert]}, {type:'notes', title}. 3 à 6 blocs utiles et concrets, remplis avec ton expertise du sujet.";

const TOOL = {
  name: "agir",
  description: "Les actions à exécuter pour l'utilisateur, et la réponse à lui dire.",
  input_schema: {
    type: "object",
    properties: {
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            op: {
              type: "string",
              enum: ["create_event", "create_task", "move", "delete", "rename", "complete", "create_course", "add_area", "remove_area", "rename_area", "add_section", "remove_section", "rename_section", "log", "plan_revision", "plan_day", "navigate"],
            },
            id: { type: "string", description: "id exact e:… ou t:… de l'agenda" },
            title: { type: "string" },
            date: { type: ["string", "null"], description: "AAAA-MM-JJ" },
            start: { type: ["string", "null"], description: "HH:MM" },
            end: { type: ["string", "null"], description: "HH:MM" },
            time: { type: ["string", "null"], description: "HH:MM (échéance de tâche)" },
            section: { type: "string", description: "clé area:sub pour ranger une tâche ou un événement" },
            deadline: { type: "boolean" },
            code: { type: "string", description: "create_course : code du cours" },
            name: { type: "string", description: "create_course : nom du cours" },
            professor: { type: ["string", "null"] },
            color: { type: ["string", "null"], description: "#rrggbb" },
            area: { type: "string", description: "clé (ou nom) du secteur visé" },
            label: { type: "string", description: "nom d'un secteur ou d'une section" },
            blurb: { type: "string", description: "add_area : sous-titre court" },
            library: { type: ["string", "null"], description: "add_section : id de la bibliothèque (ex. sante:nutrition) si elle existe" },
            image: { type: ["string", "null"], description: "nom d'image parmi IMAGES" },
            intro: { type: "string", description: "section sur mesure : à quoi elle sert" },
            blocks: { type: "array", items: { type: "object" }, description: BLOCKS_HELP },
            sections: { type: "array", items: { type: "object" }, description: "add_area : sections à créer dedans, chacune {library} ou {label, image, intro, blocks}" },
            record: { type: "string", enum: ["workout", "water", "meal", "weight", "sleep", "expense", "income", "grocery"], description: "log : quoi noter" },
            value: { type: ["number", "null"], description: "log : minutes (workout), verres (water), kcal (meal), kg (weight), heures (sleep), montant $ (expense/income)" },
            items: { type: "array", items: { type: "string" }, description: "log grocery : articles" },
            assessment_ids: { type: "array", items: { type: "string" }, description: "plan_revision : ids d'évaluations (vide = toutes celles à venir)" },
            url: { type: "string", description: "navigate : chemin de page" },
          },
          required: ["op"],
        },
      },
      reply: { type: "string", description: "OBLIGATOIRE. Ce que tu dis à l'utilisateur, en français, tutoiement, naturel (lu à voix haute) : ce que tu as fait précisément, ou la réponse à sa question. Jamais vide." },
    },
    required: ["actions", "reply"],
  },
};

export async function askAssistant(userId: string, sentence: string, page: string, history: Turn[]) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: "no-key" as const };
  const ctx = await assistantContext(userId, page);
  const now = new Date();
  const system = [
    "Tu es Aurum, l'assistant personnel de l'utilisateur, intégré à toute l'application — comme Jarvis : il te parle, tu fais, puis tu confirmes en une phrase.",
    `Nous sommes le ${fmtDay(now)} ${toISODate(now)}, il est ${hhmm(now)} (fuseau ${APP_TIMEZONE}).`,
    "Règles :",
    "- Exécute TOUT ce qui est demandé, même plusieurs choses dans une phrase. Ne demande pas de confirmation. Pose une question seulement s'il manque une information indispensable (alors aucune action).",
    "- Agenda : avec une heure = create_event (durée par défaut : 1 h sport, 30 min appel/réunion, 1 h sinon) ; sans heure = create_task ; « rendre/remettre » = create_task deadline=true ; « rappelle-moi » = create_task. « je ne fais plus de sport aujourd'hui », « annule… » = delete de TOUS les éléments concernés. Pour modifier/supprimer, uniquement des id de l'agenda.",
    "- Réunion : create_event dans section travail:reunions (ou equipe:reunions), titre « Réunion — sujet ».",
    "- Cours : « crée trois dossiers pour MAT1320, PHY1121… » = un create_course par cours (code, nom complet si tu le connais).",
    "- Secteurs : ajouter un secteur ou une section → add_area / add_section. Si la bibliothèque a la section, utilise library. Sinon crée une section SUR MESURE avec label, image (la plus proche dans IMAGES), intro et blocks. " + BLOCKS_HELP,
    "- « je suis sportif, garde seulement santé » → remove_area pour les autres (rien n'est supprimé, juste masqué) ; « retire Esprit » → remove_area.",
    "- Noter quelque chose qui s'est passé → log : « j'ai couru 30 min » (workout), « j'ai bu 2 verres » (water), « j'ai mangé… » (meal, kcal estimé), « je pèse 72 kg » (weight), « j'ai dormi 7 h » (sleep), « j'ai dépensé 12 $ en resto » (expense, title = libellé), « ajoute lait et œufs aux courses » (grocery, items).",
    "- « fais-moi un plan de révision pour… » → plan_revision (ids des évaluations concernées). « organise/planifie ma journée » → plan_day (date).",
    "- « ouvre / montre-moi … » → navigate (url d'une page : /today, /calendar, /courses, /courses/<id>, /tasks, /tasks/<area>, /tasks/<area>/<section>, /settings, /syllabus).",
    "- Bilan, questions sur l'agenda : aucune action, réponse complète dans reply (cours, remises, tâches ; heure de coucher conseillée pour le lendemain).",
    "- N'affirme jamais avoir fait quelque chose sans l'action correspondante : le serveur exécute et vérifie chaque action, et remplace ta réponse par un compte rendu si l'une d'elles échoue.",
    "- Vérifie chaque date contre l'agenda jour par jour fourni. reply : une ou deux phrases, naturelles à l'oral, sans liste ni symbole.",
    "",
    ctx.text,
  ].join("\n");

  const messages = [...history.slice(-6).map((t) => ({ role: t.role, content: t.text.slice(0, 600) })), { role: "user" as const, content: sentence }];
  // The API wants the conversation to start with the user.
  while (messages.length && messages[0].role !== "user") messages.shift();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, system, tools: [TOOL], tool_choice: { type: "tool", name: "agir" }, messages }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { error: `L'assistant ne répond pas (${res.status}).` };
    const data = (await res.json()) as { content: { type: string; input?: AssistantPlan }[]; usage?: { input_tokens: number; output_tokens: number } };
    if (data.usage) {
      const cost = (data.usage.input_tokens * 1 + data.usage.output_tokens * 5) / 1_000_000;
      console.info(`[assistant] ${data.usage.input_tokens} tokens lus + ${data.usage.output_tokens} écrits ≈ ${cost.toFixed(4)} $`);
    }
    const call = data.content.find((c) => c.type === "tool_use");
    if (!call?.input) return { error: "L'assistant n'a rien proposé." };
    return { plan: { actions: Array.isArray(call.input.actions) ? call.input.actions : [], reply: String(call.input.reply ?? "") }, ctx };
  } catch {
    return { error: "L'assistant ne répond pas." };
  }
}
