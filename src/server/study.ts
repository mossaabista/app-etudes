import { prisma } from "@/lib/db";
import { currentZone, addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { PILOT_NOTE } from "@/server/pilot";
import { getPlanningPrefs } from "@/server/planning-prefs";

/**
 * Revision plans. For one assessment (or every one coming up), find the real free time
 * between now and the exam — classes, appointments, sport, family, meals and sleep are
 * off limits — then decide what to revise and when. With an API key Claude does the
 * teaching part (chapters, difficulty, how long, in which order, which method); without
 * one a spaced-repetition rule does it. Either way every session sits inside a free slot
 * and ends well before the exam.
 */

export interface StudySession {
  assessmentId: string;
  date: string;
  start: string;
  end: string;
  topic: string;
  method: string;
}

export interface StudyTarget {
  id: string;
  title: string;
  type: string;
  weight: number | null;
  due: string;
  dueTime: string;
  course: { id: string; code: string; name: string; color: string };
}

export interface StudyPlan {
  targets: StudyTarget[];
  chapters: { assessmentId: string; title: string; difficulty: 1 | 2 | 3; minutes: number }[];
  sessions: StudySession[];
  advice: string;
  source: "ai" | "rules";
  totalMinutes: number;
}

const MEALS: [number, number][] = [
  [12 * 60, 13 * 60],
  [18 * 60 + 30, 19 * 60 + 30],
];
/** No more than this much revision a day across all plans: a plan that burns you out fails. */
const DAILY_CAP = 4 * 60;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: currentZone(), hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

const BASE: Record<string, number> = { Final: 480, Exam: 420, Midterm: 360, Quiz: 120, Presentation: 240, Project: 360, Report: 240, Lab: 180, Assignment: 180 };
const EXAM = new Set(["Final", "Exam", "Midterm", "Quiz"]);

/** Free windows per day, from now until the last due date, within the user's planning limits. */
async function freeSlots(userId: string, until: Date) {
  const { dayStart: DAY_START, dayEnd: DAY_END, buffer: BUFFER, restDays } = await getPlanningPrefs(userId);
  const today = toISODate(new Date());
  const start = fromISODate(today)!;
  const [schedules, events] = await Promise.all([
    prisma.courseSchedule.findMany({ where: { course: { userId } } }),
    prisma.calendarEvent.findMany({ where: { userId, date: { gte: start, lte: until } } }),
  ]);
  const nowMin = toMin(hhmm(new Date()));
  const days: { date: string; slots: [number, number][]; booked: number }[] = [];
  for (let d = start; d <= until; d = addDays(d, 1)) {
    const iso = toISODate(d);
    if (restDays.includes(dayName(d))) {
      days.push({ date: iso, slots: [], booked: 0 });
      continue;
    }
    const busy: [number, number][] = [
      ...schedules.filter((s) => s.day === dayName(d)).map((s) => [toMin(s.startTime), toMin(s.endTime)] as [number, number]),
      ...events.filter((e) => toISODate(e.date) === iso && e.startTime).map((e) => [toMin(e.startTime!), toMin(e.endTime ?? fmt(toMin(e.startTime!) + 60))] as [number, number]),
    ].map(([a, b]) => [a - BUFFER, b + BUFFER] as [number, number]);
    // Study the Pilot already placed that day counts against the daily cap.
    const booked = events.filter((e) => toISODate(e.date) === iso && e.notes === PILOT_NOTE && e.startTime && e.endTime).reduce((s, e) => s + toMin(e.endTime!) - toMin(e.startTime!), 0);
    const all = [...busy, ...MEALS].sort((a, b) => a[0] - b[0]);
    let cursor = iso === today ? Math.max(DAY_START, Math.ceil((nowMin + 15) / 15) * 15) : DAY_START;
    const slots: [number, number][] = [];
    for (const [a, b] of all) {
      if (a > cursor) slots.push([cursor, Math.min(a, DAY_END)]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < DAY_END) slots.push([cursor, DAY_END]);
    days.push({ date: iso, slots: slots.filter(([a, b]) => b - a >= 30), booked });
  }
  return days;
}

async function loadTargets(userId: string, ids: string[] | "upcoming"): Promise<StudyTarget[]> {
  const now = new Date();
  const rows = await prisma.assessment.findMany({
    where: { userId, status: { not: "Completed" }, dueDate: { gt: now, lt: addDays(now, 21) }, ...(ids === "upcoming" ? {} : { id: { in: ids } }) },
    include: { course: { select: { id: true, code: true, name: true, color: true } } },
    orderBy: { dueDate: "asc" },
    take: 12,
  });
  return rows.map((a) => ({ id: a.id, title: a.title, type: a.type, weight: a.weight, due: toISODate(a.dueDate!), dueTime: hhmm(a.dueDate!), course: a.course }));
}

export async function planStudy(userId: string, ids: string[] | "upcoming"): Promise<StudyPlan | { error: string }> {
  const targets = await loadTargets(userId, ids);
  if (!targets.length) return { error: "Aucune évaluation à venir dans les 3 prochaines semaines." };
  const last = fromISODate(targets[targets.length - 1].due)!;
  const days = await freeSlots(userId, last);

  // Each target may only use days before it (or the morning of, ending 45 min before).
  const latestFor = (t: StudyTarget) => ({ date: t.due, end: toMin(t.dueTime) - (EXAM.has(t.type) ? 45 : 90) });

  const ai = process.env.ANTHROPIC_API_KEY ? await planWithClaude(targets, days, latestFor) : null;
  const plan = ai ?? planWithRules(targets, days, latestFor);
  return plan;
}

/** Clip a proposed session to the real free time; drop it if it no longer fits. */
function fits(days: { date: string; slots: [number, number][] }[], s: { date: string; start: string; end: string }) {
  const day = days.find((d) => d.date === s.date);
  if (!day || !/^\d\d:\d\d$/.test(s.start) || !/^\d\d:\d\d$/.test(s.end)) return false;
  const a = toMin(s.start);
  const b = toMin(s.end);
  return b - a >= 20 && day.slots.some(([x, y]) => a >= x && b <= y);
}

function planWithRules(
  targets: StudyTarget[],
  days: { date: string; slots: [number, number][]; booked: number }[],
  latestFor: (t: StudyTarget) => { date: string; end: number }
): StudyPlan {
  const used = new Map(days.map((d) => [d.date, d.booked]));
  const slots = new Map(days.map((d) => [d.date, d.slots.map((s) => [...s] as [number, number])]));
  const sessions: StudySession[] = [];
  const chapters: StudyPlan["chapters"] = [];
  let total = 0;
  for (const t of targets) {
    const need = Math.round((BASE[t.type] ?? 180) * (t.weight != null ? Math.min(1.5, Math.max(0.5, t.weight / 20)) : 1));
    total += need;
    const exam = EXAM.has(t.type);
    const phases = exam
      ? [
          { share: 0.4, topic: "Relire le cours et refaire les fiches", method: "Lecture active : résumer chaque chapitre en une page" },
          { share: 0.35, topic: "Exercices types et problèmes", method: "Faire les exercices sans regarder la solution, corriger ensuite" },
          { share: 0.25, topic: "Examen blanc et points faibles", method: "Annales en temps limité, puis revoir les erreurs" },
        ]
      : [
          { share: 0.3, topic: "Comprendre l'énoncé et planifier", method: "Lister les livrables et découper en étapes" },
          { share: 0.5, topic: "Réaliser le travail", method: "Blocs de concentration de 45 à 90 min" },
          { share: 0.2, topic: "Relire, vérifier et remettre", method: "Relecture complète et vérification des consignes" },
        ];
    phases.forEach((p) => chapters.push({ assessmentId: t.id, title: p.topic, difficulty: 2, minutes: Math.round(need * p.share) }));
    const limit = latestFor(t);
    const usable = days.filter((d) => d.date <= limit.date);
    // Phase by phase, earliest days first for understanding, last days for practice.
    let remaining = need;
    let phase = 0;
    let phaseLeft = Math.round(need * phases[0].share);
    for (const d of usable) {
      if (remaining <= 0) break;
      for (const sl of slots.get(d.date) ?? []) {
        if (remaining <= 0) break;
        const end = d.date === limit.date ? Math.min(sl[1], limit.end) : sl[1];
        const room = Math.min(end - sl[0], DAILY_CAP - (used.get(d.date) ?? 0));
        if (room < 30) continue;
        const len = Math.min(90, room, Math.max(30, Math.ceil(phaseLeft / 15) * 15));
        sessions.push({ assessmentId: t.id, date: d.date, start: fmt(sl[0]), end: fmt(sl[0] + len), topic: phases[phase].topic, method: phases[phase].method });
        used.set(d.date, (used.get(d.date) ?? 0) + len);
        sl[0] += len + 15;
        remaining -= len;
        phaseLeft -= len;
        if (phaseLeft <= 0 && phase < phases.length - 1) phaseLeft = Math.round(need * phases[++phase].share);
        break; // one session per target per day: spacing beats cramming
      }
    }
  }
  sessions.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return {
    targets,
    chapters,
    sessions,
    advice: "Plan réparti dans tes créneaux libres, une séance par jour et par évaluation, la plus difficile partie en premier. Ajoute une clé d'assistant pour un plan par chapitre.",
    source: "rules",
    totalMinutes: total,
  };
}

async function planWithClaude(
  targets: StudyTarget[],
  days: { date: string; slots: [number, number][]; booked: number }[],
  latestFor: (t: StudyTarget) => { date: string; end: number }
): Promise<StudyPlan | null> {
  const syllabi = await prisma.syllabus.findMany({
    where: { courseId: { in: [...new Set(targets.map((t) => t.course.id))] } },
    orderBy: { createdAt: "desc" },
    select: { courseId: true, rawData: true },
  });
  const topicsOf = (courseId: string) => {
    const raw = syllabi.find((s) => s.courseId === courseId)?.rawData as { text?: string; topics?: string[] } | null;
    const topics = raw?.topics?.length ? `Chapitres : ${raw.topics.join(" ; ")}\n` : "";
    return topics || raw?.text ? `${topics}${raw?.text?.slice(0, 3000) ?? ""}` : null;
  };
  const fmtDay = (iso: string) => new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
  const lines: string[] = [];
  lines.push("ÉVALUATIONS À PRÉPARER :");
  for (const t of targets) {
    const lim = latestFor(t);
    lines.push(`- id=${t.id} | ${t.course.code} « ${t.course.name} » | ${t.type} « ${t.title} »${t.weight != null ? ` | ${t.weight} %` : ""} | le ${fmtDay(t.due)} ${t.due} à ${t.dueTime} | dernière fin de séance possible : ${lim.date} ${fmt(Math.max(0, lim.end))}`);
    const topics = topicsOf(t.course.id);
    if (topics) lines.push(`  Extrait du plan de cours :\n${topics.replace(/\n{2,}/g, "\n").slice(0, 3500)}`);
  }
  lines.push(`CRÉNEAUX LIBRES (seuls endroits possibles ; max ${DAILY_CAP / 60} h de révision par jour, déjà planifié indiqué) :`);
  for (const d of days) {
    if (!d.slots.length) continue;
    lines.push(`- ${fmtDay(d.date)} ${d.date}${d.booked ? ` (déjà ${d.booked} min de révision)` : ""} : ${d.slots.map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(", ")}`);
  }

  const tool = {
    name: "plan",
    description: "Le plan de révision.",
    input_schema: {
      type: "object",
      properties: {
        chapters: {
          type: "array",
          items: {
            type: "object",
            properties: { assessmentId: { type: "string" }, title: { type: "string" }, difficulty: { type: "integer", enum: [1, 2, 3] }, minutes: { type: "integer" } },
            required: ["assessmentId", "title", "difficulty", "minutes"],
          },
        },
        sessions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              assessmentId: { type: "string" },
              date: { type: "string" },
              start: { type: "string" },
              end: { type: "string" },
              topic: { type: "string", description: "Chapitre ou partie précise travaillée" },
              method: { type: "string", description: "Comment travailler (fiches, exercices, annales, rappel actif…)" },
            },
            required: ["assessmentId", "date", "start", "end", "topic", "method"],
          },
        },
        advice: { type: "string", description: "2 ou 3 phrases de conseil personnalisé, en français, tutoiement." },
      },
      required: ["chapters", "sessions", "advice"],
    },
  };
  const system = [
    "Tu es un tuteur universitaire expert en méthodes d'apprentissage. Tu construis un plan de révision réaliste.",
    "1. Pour chaque évaluation, déduis du code et du nom du cours (et de l'extrait du plan de cours s'il existe) les chapitres ou notions probablement évalués, leur difficulté (1 à 3) et le temps nécessaire pour les maîtriser, exercices compris. Un quiz de 3 % ne demande pas autant qu'un examen de 30 %.",
    "2. Place les séances UNIQUEMENT dans les créneaux libres listés, sans dépasser la dernière fin de séance possible, ni le plafond quotidien.",
    "3. Principes : répétition espacée (revenir sur une notion après 1–3 jours), notions difficiles tôt, exercices ensuite, examen blanc et révision des erreurs à la fin ; séances de 45 à 90 min ; si plusieurs évaluations, alterne et priorise la plus proche et la plus lourde.",
    "4. Sois précis : « Ch. 3 — Premier principe, systèmes fermés », pas « Révision ».",
    "5. Le total des séances d'une évaluation ne dépasse pas le total de ses chapitres (+10 %).",
    "6. Dans advice, n'écris AUCUNE date ni aucun jour de la semaine : seulement la stratégie et la méthode.",
  ].join("\n");

  try {
    // Plans are rarer and harder than commands: the stronger model first, the fast one if
    // it is unavailable.
    const call = (model: string) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 3000, system, tools: [tool], tool_choice: { type: "tool", name: "plan" }, messages: [{ role: "user", content: lines.join("\n") }] }),
        signal: AbortSignal.timeout(60000),
      });
    let res = await call(process.env.STUDY_MODEL || "claude-sonnet-5-5");
    if (!res.ok) res = await call(process.env.ASSISTANT_MODEL || "claude-haiku-4-5-20251001");
    if (!res.ok) return null;
    const data = (await res.json()) as { content: { type: string; input?: { chapters?: StudyPlan["chapters"]; sessions?: StudySession[]; advice?: string } }[]; usage?: { input_tokens: number; output_tokens: number } };
    if (data.usage) console.info(`[révision] ${data.usage.input_tokens} tokens lus + ${data.usage.output_tokens} écrits`);
    const out = data.content.find((c) => c.type === "tool_use")?.input;
    if (!out) return null;
    const ids = new Set(targets.map((t) => t.id));
    const sessions = (out.sessions ?? [])
      .filter((s) => ids.has(s.assessmentId) && fits(days, s))
      .filter((s) => {
        const lim = latestFor(targets.find((t) => t.id === s.assessmentId)!);
        return s.date < lim.date || (s.date === lim.date && toMin(s.end) <= lim.end);
      })
      .map((s) => ({ ...s, topic: String(s.topic).slice(0, 120), method: String(s.method).slice(0, 160) }))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const chapters = (out.chapters ?? []).filter((c) => ids.has(c.assessmentId)).slice(0, 40);
    // Overlapping sessions keep the first; a target stops getting sessions once it has
    // what its chapters need (+10 %).
    const budget = new Map(targets.map((t) => [t.id, Math.round(chapters.filter((c) => c.assessmentId === t.id).reduce((s, c) => s + (c.minutes || 0), 0) * 1.1) || 600]));
    const kept: StudySession[] = [];
    for (const s of sessions) {
      if (kept.some((k) => k.date === s.date && toMin(s.start) < toMin(k.end) && toMin(k.start) < toMin(s.end))) continue;
      const left = budget.get(s.assessmentId) ?? 0;
      const length = toMin(s.end) - toMin(s.start);
      if (left < 20) continue;
      const trimmed = length > left ? { ...s, end: fmt(toMin(s.start) + Math.max(30, Math.ceil(left / 15) * 15)) } : s;
      budget.set(s.assessmentId, left - (toMin(trimmed.end) - toMin(trimmed.start)));
      kept.push(trimmed);
    }
    if (!kept.length) return null;
    return { targets, chapters, sessions: kept, advice: String(out.advice ?? ""), source: "ai", totalMinutes: chapters.reduce((s, c) => s + (c.minutes || 0), 0) };
  } catch {
    return null;
  }
}

export const STUDY_PREFIX = "Réviser · ";
