import { prisma } from "@/lib/db";
import { currentZone, addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { PILOT_NOTE } from "@/server/pilot";

/**
 * What is at risk of not getting done, each with a reason the user can check and one
 * thing to do about it. Nothing here is a score: every alert names the rows it comes from.
 */

export type RadarKind = "overdue" | "no-time" | "conflict" | "overload" | "undated";

export interface RadarAlert {
  kind: RadarKind;
  level: "high" | "medium";
  title: string;
  detail: string;
  href: string;
  action: string;
}

const HORIZON = 14;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: currentZone(), hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const dayFr = (iso: string) => new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const EXAMS = new Set(["Exam", "Final", "Midterm", "Quiz"]);

export async function riskRadar(userId: string, now = new Date(), locale: "fr" | "en" = "fr"): Promise<RadarAlert[]> {
  const en = locale === "en";
  const dayName_ = (iso: string) => (en ? new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(`${iso}T12:00:00Z`)) : dayFr(iso));
  const today = fromISODate(toISODate(now))!;
  const end = addDays(today, HORIZON);
  const [overdue, assessments, undated, events, schedules] = await Promise.all([
    prisma.task.findMany({ where: { userId, parentId: null, status: { notIn: ["Done", "Deferred"] }, dueDate: { lt: now } }, select: { id: true, title: true, dueDate: true, category: true }, orderBy: { dueDate: "asc" }, take: 20 }),
    prisma.assessment.findMany({
      where: { userId, status: { not: "Completed" }, dueDate: { gte: now, lt: end } },
      select: { id: true, title: true, type: true, weight: true, dueDate: true, courseId: true, course: { select: { code: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.assessment.findMany({ where: { userId, status: { not: "Completed" }, dueDate: null }, select: { id: true, title: true, courseId: true, course: { select: { code: true } } }, take: 10 }),
    prisma.calendarEvent.findMany({ where: { userId, date: { gte: today, lt: end }, startTime: { not: null } }, select: { id: true, title: true, date: true, startTime: true, endTime: true, notes: true } }),
    prisma.courseSchedule.findMany({ where: { course: { userId } }, select: { day: true, startTime: true, endTime: true, type: true, course: { select: { code: true } } } }),
  ]);

  const alerts: RadarAlert[] = [];

  // 1. Late tasks.
  for (const t of overdue) {
    const days = Math.max(0, Math.round((today.getTime() - fromISODate(toISODate(t.dueDate!))!.getTime()) / 86400000));
    const [area, sub] = (t.category ?? "").split(":");
    alerts.push({
      kind: "overdue",
      level: days >= 2 ? "high" : "medium",
      title: t.title,
      detail: en
        ? days === 0 ? `Was due today at ${hhmm(t.dueDate!)}.` : `${days} day${days > 1 ? "s" : ""} late (due ${dayName_(toISODate(t.dueDate!))}).`
        : days === 0 ? `Échéance passée aujourd'hui à ${hhmm(t.dueDate!).replace(":", " h ")}.` : `En retard depuis ${days} jour${days > 1 ? "s" : ""} (échéance : ${dayFr(toISODate(t.dueDate!))}).`,
      href: area && sub ? `/tasks/${area}/${sub}` : "/tasks",
      action: en ? "Reschedule or check off" : "Replanifier ou cocher",
    });
  }

  // 2. Assessments within a week and no study time booked for them.
  const studyBlocks = events.filter((e) => e.notes === PILOT_NOTE);
  for (const a of assessments) {
    const days = Math.round((fromISODate(toISODate(a.dueDate!))!.getTime() - today.getTime()) / 86400000);
    if (days > 7) continue;
    const key = fold(a.title);
    const booked = studyBlocks.some((e) => fold(e.title).includes(key) && e.date < a.dueDate!);
    if (booked) continue;
    alerts.push({
      kind: "no-time",
      level: days <= 2 || (a.weight ?? 0) >= 20 ? "high" : "medium",
      title: `${a.course.code} · ${a.title}`,
      detail: en
        ? `${EXAMS.has(a.type) ? "Exam" : "Due"} ${days === 0 ? "today" : days === 1 ? "tomorrow" : dayName_(toISODate(a.dueDate!))}${a.weight != null ? ` (${a.weight}%)` : ""}, and no study time is on your calendar.`
        : `${EXAMS.has(a.type) ? "À passer" : "À rendre"} ${days === 0 ? "aujourd'hui" : days === 1 ? "demain" : dayFr(toISODate(a.dueDate!))}${a.weight != null ? ` (${a.weight} %)` : ""}, et aucun temps de travail n'est prévu au calendrier.`,
      href: `/courses/${a.courseId}`,
      action: en ? "Plan study time" : "Planifier les révisions",
    });
  }

  // 3. Timed things that overlap: two events, or an event on top of a class.
  const seen = new Set<string>();
  for (let d = today; d < end; d = addDays(d, 1)) {
    const iso = toISODate(d);
    const items = [
      ...events.filter((e) => toISODate(e.date) === iso && e.notes !== PILOT_NOTE).map((e) => ({ label: en ? `“${e.title}”` : `« ${e.title} »`, course: false, a: toMin(e.startTime!), b: e.endTime ? toMin(e.endTime) : toMin(e.startTime!) + 60 })),
      ...schedules.filter((s) => s.day === dayName(d)).map((s) => ({ label: en ? `the ${s.course.code} class` : `le cours ${s.course.code}`, course: true, a: toMin(s.startTime), b: toMin(s.endTime) })),
    ];
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const x = items[i];
        const y = items[j];
        if (!(x.a < y.b && y.a < x.b)) continue;
        if (x.course && y.course) continue;
        const k = `${iso}|${[x.label, y.label].sort().join("|")}`;
        if (seen.has(k)) continue;
        seen.add(k);
        alerts.push({
          kind: "conflict",
          level: "high",
          title: en ? `Conflict on ${dayName_(iso)}` : `Conflit ${dayFr(iso)}`,
          detail: `${x.label.charAt(0).toUpperCase()}${x.label.slice(1)} ${en ? "and" : "et"} ${y.label} ${en ? "overlap" : "se chevauchent"} (${String(Math.floor(Math.max(x.a, y.a) / 60)).padStart(2, "0")}${en ? ":" : " h "}${String(Math.max(x.a, y.a) % 60).padStart(2, "0")}).`,
          href: `/calendar`,
          action: en ? "Move one of them" : "Déplacer l'un des deux",
        });
      }
  }

  // 4. Days carrying three hand-ins or exams or more.
  const perDay = new Map<string, string[]>();
  for (const a of assessments) perDay.set(toISODate(a.dueDate!), [...(perDay.get(toISODate(a.dueDate!)) ?? []), `${a.course.code} ${a.title}`]);
  for (const [iso, list] of perDay)
    if (list.length >= 3)
      alerts.push(
        en
          ? { kind: "overload", level: "high", title: `Heavy day: ${dayName_(iso)}`, detail: `${list.length} assessments on the same day: ${list.join(", ")}.`, href: "/calendar", action: "Get ahead on the days before" }
          : { kind: "overload", level: "high", title: `Journée chargée ${dayFr(iso)}`, detail: `${list.length} évaluations le même jour : ${list.join(", ")}.`, href: "/calendar", action: "Avancer le travail des jours d'avant" }
      );

  // 5. Assessments with no date: they cannot be planned.
  for (const a of undated)
    alerts.push({ kind: "undated", level: "medium", title: `${a.course.code} · ${a.title}`, detail: en ? "No known date: it can't be planned or reminded." : "Pas de date connue : elle ne peut pas être planifiée ni rappelée.", href: `/courses/${a.courseId}`, action: en ? "Add the date" : "Ajouter la date" });

  const rank = (x: RadarAlert) => (x.level === "high" ? 0 : 1) * 10 + ["conflict", "overdue", "no-time", "overload", "undated"].indexOf(x.kind);
  return alerts.sort((a, b) => rank(a) - rank(b));
}

/** The radar in one paragraph, for the assistant's answer to "what is at risk?". */
export function radarText(alerts: RadarAlert[]): string {
  if (!alerts.length) return "Rien ne semble à risque pour les deux prochaines semaines : pas de retard, pas de conflit, et chaque évaluation proche a du temps prévu.";
  const top = alerts.slice(0, 5).map((a) => `${a.title} : ${a.detail}`);
  return `${alerts.length} point${alerts.length > 1 ? "s" : ""} à surveiller. ${top.join(" ")}${alerts.length > 5 ? ` Et ${alerts.length - 5} autre${alerts.length - 5 > 1 ? "s" : ""}, visibles sur Aujourd'hui.` : ""}`;
}
