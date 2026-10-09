import { prisma } from "@/lib/db";
import { currentZone, addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { parseCapture } from "@/lib/capture";
import { labelIn } from "@/lib/labels";
import { PILOT_NOTE } from "@/server/pilot";

const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: currentZone(), hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
type Lang = "fr" | "en";
/** The day's review in the user's language: same facts, two phrasings. */
const W = {
  fr: {
    time: (t: string) => t.replace(/^0/, "").replace(":00", " h").replace(":", " h "),
    intl: "fr-CA",
    and: "et",
    today: "Aujourd'hui",
    tomorrow: (d: string) => `Demain, ${d}`,
    at: "à",
    pilot: " (Jarvis)",
    did: (h: string, l: string) => `${h}, tu as fait : ${l}.`,
    nothingDone: (h: string) => `${h}, rien de terminé pour l'instant.`,
    left: (l: string) => `Il reste : ${l}.`,
    allDone: "Il ne reste rien : ta journée est bouclée.",
    forTomorrow: (l: string) => `Pour demain : ${l}.`,
    classes: (h: string, n: number, l: string) => `${h} : ${n} cours — ${l}.`,
    noClasses: (h: string) => `${h} : pas de cours.`,
    due: (l: string) => `À rendre : ${l}.`,
    planned: (l: string) => `Au programme : ${l}.`,
    todo: (l: string) => `À faire : ${l}.`,
    free: "Journée libre.",
    bed: (first: string, bed: string) => `Premier engagement à ${first} : couche-toi vers ${bed} pour dormir 8 h.`,
    quote: (x: string) => `« ${x} »`,
  },
  en: {
    time: (t: string) => t,
    intl: "en-CA",
    and: "and",
    today: "Today",
    tomorrow: (d: string) => `Tomorrow, ${d}`,
    at: "at",
    pilot: " (Jarvis)",
    did: (h: string, l: string) => `${h}, you've done: ${l}.`,
    nothingDone: (h: string) => `${h}, nothing finished yet.`,
    left: (l: string) => `Still to come: ${l}.`,
    allDone: "Nothing left: your day is wrapped up.",
    forTomorrow: (l: string) => `Due tomorrow: ${l}.`,
    classes: (h: string, n: number, l: string) => `${h}: ${n} class${n > 1 ? "es" : ""} — ${l}.`,
    noClasses: (h: string) => `${h}: no classes.`,
    due: (l: string) => `Due: ${l}.`,
    planned: (l: string) => `Planned: ${l}.`,
    todo: (l: string) => `To do: ${l}.`,
    free: "A free day.",
    bed: (first: string, bed: string) => `First commitment at ${first}: go to bed around ${bed} to get 8 hours of sleep.`,
    quote: (x: string) => `“${x}”`,
  },
};
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * A spoken-style review of a day. Today: what is done, what is left, what is due tomorrow.
 * Another day (usually tomorrow, asked before bed): the timetable, the hand-ins, the
 * to-dos, and when to go to sleep to get eight hours before the first commitment.
 */
export async function briefing(userId: string, sentence: string, lang: Lang = "fr"): Promise<string> {
  const w = W[lang];
  const fr = w.time;
  const dayWords = (iso: string) => new Intl.DateTimeFormat(w.intl, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${w.and} ${xs[xs.length - 1]}`);
  const today = toISODate(new Date());
  const p = parseCapture(sentence, today);
  const day = p.found.day ? p.day : /\b(demain|tomorrow)\b/i.test(sentence) ? toISODate(addDays(fromISODate(today)!, 1)) : today;
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
  const head = isToday ? w.today : day === toISODate(addDays(fromISODate(today)!, 1)) ? w.tomorrow(dayWords(day)) : dayWords(day).replace(/^./, (c) => c.toUpperCase());

  const cls = classes.map((c) => `${c.course.code} ${w.at} ${fr(c.startTime)}`);
  const timed = events.filter((e) => e.startTime);
  if (isToday) {
    const past = [...classes.filter((c) => c.endTime <= now).map((c) => c.course.code), ...timed.filter((e) => (e.endTime ?? e.startTime!) <= now).map((e) => e.title)];
    const done = [...doneToday.map((t) => t.title), ...past];
    lines.push(done.length ? w.did(head, list(done)) : w.nothingDone(head));
    const left = [
      ...classes.filter((c) => c.endTime > now).map((c) => `${c.course.code} ${w.at} ${fr(c.startTime)}`),
      ...timed.filter((e) => (e.endTime ?? e.startTime!) > now).map((e) => `${e.title}${e.notes === PILOT_NOTE ? w.pilot : ""} ${w.at} ${fr(e.startTime!)}`),
      ...tasks.map((t) => t.title),
    ];
    lines.push(left.length ? w.left(list(left)) : w.allDone);
    const due = [...assessments, ...labs].filter((a) => toISODate(a.dueDate!) !== today);
    if (due.length) lines.push(w.forTomorrow(list(due.map((a) => `${a.title} (${a.course.code}, ${fr(hhmm(a.dueDate!))})`))));
  } else {
    lines.push(cls.length ? w.classes(head, cls.length, list(cls)) : w.noClasses(head));
    const due = [...assessments.map((a) => `${labelIn(a.type, lang).toLowerCase()} ${w.quote(a.title)} (${a.course.code}, ${fr(hhmm(a.dueDate!))})`), ...labs.map((l) => `${w.quote(l.title)} (${l.course.code})`)];
    if (due.length) lines.push(w.due(list(due)));
    if (timed.length) lines.push(w.planned(list(timed.map((e) => `${e.title} ${w.at} ${fr(e.startTime!)}`))));
    if (tasks.length) lines.push(w.todo(list(tasks.map((t) => t.title))));
    if (!due.length && !timed.length && !tasks.length && !cls.length) lines.push(w.free);
    // Eight hours of sleep and an hour to get ready before the first fixed thing.
    const first = [...classes.map((c) => c.startTime), ...timed.map((e) => e.startTime!)].sort()[0];
    if (first) {
      const bed = (toMin(first) - 60 - 8 * 60 + 24 * 60) % (24 * 60);
      lines.push(w.bed(fr(first), fr(`${String(Math.floor(bed / 60)).padStart(2, "0")}:${String(bed % 60).padStart(2, "0")}`)));
    }
  }
  return lines.join(" ");
}
