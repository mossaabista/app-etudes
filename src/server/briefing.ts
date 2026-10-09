import { prisma } from "@/lib/db";
import { APP_TIMEZONE, addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { parseCapture } from "@/lib/capture";
import { label } from "@/lib/labels";
import { PILOT_NOTE } from "@/server/pilot";

const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const fr = (t: string) => t.replace(/^0/, "").replace(":00", " h").replace(":", " h ");
const dayWords = (iso: string) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`);
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * A spoken-style review of a day. Today: what is done, what is left, what is due tomorrow.
 * Another day (usually tomorrow, asked before bed): the timetable, the hand-ins, the
 * to-dos, and when to go to sleep to get eight hours before the first commitment.
 */
export async function briefing(userId: string, sentence: string): Promise<string> {
  const today = toISODate(new Date());
  const p = parseCapture(sentence, today);
  const day = p.found.day ? p.day : /\bdemain\b/.test(sentence) ? toISODate(addDays(fromISODate(today)!, 1)) : today;
  const date = fromISODate(day)!;
  const next = addDays(date, 1);
  const isToday = day === today;

  const [classes, events, tasks, doneToday, assessments, labs] = await Promise.all([
    prisma.courseSchedule.findMany({ where: { course: { userId }, day: dayName(date) }, include: { course: { select: { code: true } } }, orderBy: { startTime: "asc" } }),
    prisma.calendarEvent.findMany({ where: { userId, date: { gte: date, lt: next } }, orderBy: { startTime: "asc" } }),
    prisma.task.findMany({ where: { userId, parentId: null, status: { not: "Done" }, dueDate: { gte: date, lt: next } }, orderBy: { dueDate: "asc" } }),
    isToday ? prisma.task.findMany({ where: { userId, status: "Done", updatedAt: { gte: date, lt: next } }, select: { title: true } }) : Promise.resolve([]),
    prisma.assessment.findMany({ where: { userId, status: { not: "Completed" }, dueDate: { gte: date, lt: addDays(date, isToday ? 2 : 1) } }, include: { course: { select: { code: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.labSession.findMany({ where: { userId, status: { notIn: ["Completed", "Submitted"] }, dueDate: { gte: date, lt: addDays(date, isToday ? 2 : 1) } }, include: { course: { select: { code: true } } }, orderBy: { dueDate: "asc" } }),
  ]);

  const now = hhmm(new Date());
  const lines: string[] = [];
  const head = isToday ? "Aujourd'hui" : day === toISODate(addDays(fromISODate(today)!, 1)) ? `Demain, ${dayWords(day)}` : dayWords(day).replace(/^./, (c) => c.toUpperCase());

  const cls = classes.map((c) => `${c.course.code} à ${fr(c.startTime)}`);
  const timed = events.filter((e) => e.startTime);
  if (isToday) {
    const past = [...classes.filter((c) => c.endTime <= now).map((c) => c.course.code), ...timed.filter((e) => (e.endTime ?? e.startTime!) <= now).map((e) => e.title)];
    const done = [...doneToday.map((t) => t.title), ...past];
    lines.push(done.length ? `${head}, tu as fait : ${list(done)}.` : `${head}, rien de terminé pour l'instant.`);
    const left = [
      ...classes.filter((c) => c.endTime > now).map((c) => `${c.course.code} à ${fr(c.startTime)}`),
      ...timed.filter((e) => (e.endTime ?? e.startTime!) > now).map((e) => `${e.title}${e.notes === PILOT_NOTE ? " (Pilote)" : ""} à ${fr(e.startTime!)}`),
      ...tasks.map((t) => t.title),
    ];
    lines.push(left.length ? `Il reste : ${list(left)}.` : "Il ne reste rien : ta journée est bouclée.");
    const due = [...assessments, ...labs].filter((a) => toISODate(a.dueDate!) !== today);
    if (due.length) lines.push(`Pour demain : ${list(due.map((a) => `${a.title} (${a.course.code}, ${fr(hhmm(a.dueDate!))})`))}.`);
  } else {
    lines.push(cls.length ? `${head} : ${cls.length} cours — ${list(cls)}.` : `${head} : pas de cours.`);
    const due = [...assessments.map((a) => `${label(a.type).toLowerCase()} « ${a.title} » (${a.course.code}, ${fr(hhmm(a.dueDate!))})`), ...labs.map((l) => `« ${l.title} » (${l.course.code})`)];
    if (due.length) lines.push(`À rendre : ${list(due)}.`);
    if (timed.length) lines.push(`Au programme : ${list(timed.map((e) => `${e.title} à ${fr(e.startTime!)}`))}.`);
    if (tasks.length) lines.push(`À faire : ${list(tasks.map((t) => t.title))}.`);
    if (!due.length && !timed.length && !tasks.length && !cls.length) lines.push("Journée libre.");
    // Eight hours of sleep and an hour to get ready before the first fixed thing.
    const first = [...classes.map((c) => c.startTime), ...timed.map((e) => e.startTime!)].sort()[0];
    if (first) {
      const bed = (toMin(first) - 60 - 8 * 60 + 24 * 60) % (24 * 60);
      lines.push(`Premier engagement à ${fr(first)} : couche-toi vers ${fr(`${String(Math.floor(bed / 60)).padStart(2, "0")}:${String(bed % 60).padStart(2, "0")}`)} pour dormir 8 h.`);
    }
  }
  return lines.join(" ");
}
