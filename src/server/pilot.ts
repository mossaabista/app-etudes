import { prisma } from "@/lib/db";
import { currentZone, addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { areaOfTag } from "@/lib/task-areas";
import { getPlanningPrefs } from "@/server/planning-prefs";
import { hm, type PlanningPrefs } from "@/lib/planning-prefs";

/** A block the Pilot proposes to put on the calendar. */
export interface PlanBlock {
  title: string;
  start: string;
  end: string;
  tag: string;
  color: string;
  why: string;
  /** A task block, as opposed to a share of study. */
  task?: boolean;
}

export const PILOT_NOTE = "Planifié par le Pilote";

/** Something that wanted a slot and did not get one, and why. */
export interface Unplaced {
  title: string;
  why: string;
  reason: string;
}

export interface DayPlan {
  blocks: PlanBlock[];
  left: number;
  free: number;
  unplaced: Unplaced[];
  /** A rest day: nothing is planned on it. */
  rest?: boolean;
}

/** A block planned in memory (earlier in the same week plan), not yet on the calendar. */
export interface VirtualBlock {
  date: string;
  title: string;
  start: string;
  end: string;
  /** Set for a task block: the task is not proposed again on a later day. */
  task?: boolean;
}

/** Meals stay free unless something is already booked there. */
const MEALS: [number, number][] = [
  [12 * 60, 13 * 60],
  [18 * 60 + 30, 19 * 60 + 30],
];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const frTime = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
const PRIORITY: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

const wallMinutes = (d: Date) => toMin(new Intl.DateTimeFormat("en-GB", { timeZone: currentZone(), hour: "2-digit", minute: "2-digit", hour12: false }).format(d));
const nowMinutes = () => wallMinutes(new Date());

/** Study each kind of assessment needs in total, and how many days ahead it starts. */
const PREP: Record<string, { minutes: number; lead: number; verb: string; label: string; exam: boolean }> = {
  Final: { minutes: 420, lead: 12, verb: "Réviser", label: "Examen final", exam: true },
  Exam: { minutes: 360, lead: 10, verb: "Réviser", label: "Examen", exam: true },
  Midterm: { minutes: 300, lead: 8, verb: "Réviser", label: "Mi-session", exam: true },
  Quiz: { minutes: 90, lead: 4, verb: "Réviser", label: "Quiz", exam: true },
  Presentation: { minutes: 240, lead: 7, verb: "Préparer", label: "Présentation", exam: false },
  Project: { minutes: 360, lead: 12, verb: "Avancer", label: "Projet", exam: false },
  Report: { minutes: 240, lead: 7, verb: "Rédiger", label: "Rapport", exam: false },
  Lab: { minutes: 180, lead: 6, verb: "Avancer", label: "Labo", exam: false },
  Assignment: { minutes: 180, lead: 6, verb: "Avancer", label: "Devoir", exam: false },
};

/** Life sections: their to-dos are fitted in, but after the work that has a deadline. */
const LIFE = new Set(["sante", "esprit", "social", "quotidien"]);

interface Candidate {
  title: string;
  minutes: number;
  /** Latest minute of the day the block may end (before an exam, before a hand-in). */
  latest: number;
  /** Earliest minute it may start (sport once the work is done, say). */
  earliest: number;
  score: number;
  focus: boolean;
  /** A task (placed once), as opposed to a share of study for an assessment. */
  task: boolean;
  tag: string;
  color: string;
  why: string;
}

/**
 * Plan a day the way a good tutor would:
 *  - only in the free time between classes, appointments and meals, never in the past;
 *  - for each upcoming assessment, a share of the study it needs, spread over the days
 *    left (an exam in five days gets a fifth of what remains), and always finished before
 *    the assessment itself — never "revise for the quiz" after the quiz;
 *  - tasks before their due time, the most urgent and heaviest first;
 *  - a 15-minute break after 90 minutes of work in a row, and no more than six hours of
 *    focused work in a day.
 */
export async function planDay(userId: string, day: string, opts?: { prefs?: PlanningPrefs; virtual?: VirtualBlock[] }): Promise<DayPlan> {
  const todayIso = toISODate(new Date());
  if (day < todayIso) return { blocks: [], left: 0, free: 0, unplaced: [] };
  const prefs = opts?.prefs ?? (await getPlanningPrefs(userId));
  const { dayStart: DAY_START, dayEnd: DAY_END, buffer: BUFFER, streak: MAX_STREAK, breakMin: BREAK, focusCap: FOCUS_CAP } = prefs;
  const date = fromISODate(day)!;
  if (prefs.restDays.includes(dayName(date))) return { blocks: [], left: 0, free: 0, unplaced: [], rest: true };
  const virtual = opts?.virtual ?? [];
  const virtualToday = virtual.filter((v) => v.date === day);
  const next = addDays(date, 1);
  const horizon = addDays(date, 14);
  const [schedules, realEvents, realEarlier, tasks, assessments, labs] = await Promise.all([
    prisma.courseSchedule.findMany({ where: { course: { userId }, day: dayName(date) } }),
    prisma.calendarEvent.findMany({ where: { userId, date: { gte: date, lt: next } } }),
    // Study the Pilot already booked on the days before counts towards what is needed.
    prisma.calendarEvent.findMany({ where: { userId, notes: PILOT_NOTE, date: { gte: addDays(date, -21), lt: date } }, select: { title: true, startTime: true, endTime: true } }),
    prisma.task.findMany({
      where: { userId, parentId: null, status: { not: "Done" }, OR: [{ dueDate: { lt: horizon } }, { dueDate: null }] },
      select: { id: true, title: true, dueDate: true, priority: true, estimatedTime: true, category: true, course: { select: { code: true, color: true } } },
    }),
    prisma.assessment.findMany({
      where: { userId, status: { not: "Completed" }, dueDate: { gt: new Date(), lt: horizon } },
      select: { id: true, title: true, dueDate: true, weight: true, type: true, course: { select: { code: true, color: true } } },
    }),
    prisma.labSession.findMany({
      where: { userId, status: { notIn: ["Completed", "Submitted"] }, dueDate: { gt: new Date(), lt: horizon } },
      select: { id: true, title: true, dueDate: true, deliverable: true, course: { select: { code: true, color: true } } },
    }),
  ]);

  // What this week plan already placed counts as booked (that day) and as studied (before).
  const events = [...realEvents, ...virtualToday.map((v) => ({ title: v.title, startTime: v.start, endTime: v.end }))];
  const earlier = [...realEarlier, ...virtual.filter((v) => v.date < day).map((v) => ({ title: v.title, startTime: v.start, endTime: v.end }))];
  const placedTasks = new Set(virtual.filter((v) => v.task && v.date < day).map((v) => v.title.toLowerCase()));

  // Busy time, padded, meals protected, then the gaps between it.
  const booked: [number, number][] = [
    ...schedules.map((s) => [toMin(s.startTime), toMin(s.endTime)] as [number, number]),
    ...events.filter((e) => e.startTime).map((e) => [toMin(e.startTime!), toMin(e.endTime ?? fmt(toMin(e.startTime!) + 60))] as [number, number]),
  ].map(([a, b]) => [a - BUFFER, b + BUFFER] as [number, number]);
  const busy = [...booked, ...MEALS].sort((x, y) => x[0] - y[0]);
  let cursor = Math.max(DAY_START, day === todayIso ? Math.ceil((nowMinutes() + 5) / 15) * 15 : DAY_START);
  const gaps: [number, number][] = [];
  for (const [a, b] of busy) {
    if (a > cursor) gaps.push([cursor, Math.min(a, DAY_END)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < DAY_END) gaps.push([cursor, DAY_END]);
  const free = gaps.reduce((s, [a, b]) => s + Math.max(0, b - a), 0);

  const daysUntil = (d: Date) => Math.round((fromISODate(toISODate(d))!.getTime() - date.getTime()) / 86400000);
  const when = (d: Date) => {
    const n = daysUntil(d);
    const t = frTime(wallMinutes(d));
    if (n === 0) return `${day === todayIso ? "aujourd'hui" : "le jour même"} à ${t}`;
    if (n === 1) return `demain à ${t}`;
    return `${new Intl.DateTimeFormat("fr-CA", { timeZone: currentZone(), weekday: "long", day: "numeric" }).format(d)} à ${t}`;
  };
  // Already on the day's calendar under the same name: not proposed twice.
  const planned = new Set(events.map((e) => e.title.toLowerCase()));
  const studied = (needle: string) =>
    earlier
      .filter((e) => e.startTime && e.endTime && e.title.toLowerCase().includes(needle.toLowerCase()))
      .reduce((s, e) => s + toMin(e.endTime!) - toMin(e.startTime!), 0);

  const candidates: Candidate[] = [];

  // Assessments and labs: a share of the remaining study, finished before they happen.
  const deliverables = [
    ...assessments.map((a) => ({ key: a.title, title: a.title, type: a.type, due: a.dueDate!, weight: a.weight, code: a.course.code, color: a.course.color })),
    ...labs.map((l) => ({ key: l.title, title: l.deliverable ? `${l.title} — ${l.deliverable}` : l.title, type: "Lab", due: l.dueDate!, weight: null as number | null, code: l.course.code, color: l.course.color })),
  ];
  for (const d of deliverables) {
    const prep = PREP[d.type] ?? PREP.Assignment;
    const left = daysUntil(d.due);
    if (left < 0 || left > prep.lead) continue;
    const dueToday = left === 0;
    // Revise until 30 minutes before an exam; a hand-in keeps an hour to submit calmly.
    const latest = dueToday ? wallMinutes(d.due) - (prep.exam ? 30 : 60) : DAY_END;
    if (latest - DAY_START < 30) continue;
    const scale = d.weight != null ? Math.min(1.5, Math.max(0.5, d.weight / 20)) : 1;
    const remaining = Math.round(prep.minutes * scale) - studied(d.key);
    if (remaining < 20) continue;
    // Days still available, today included; an afternoon deadline leaves that day too.
    const days = Math.max(1, left + (!dueToday && wallMinutes(d.due) >= 14 * 60 ? 1 : 0));
    const share = Math.min(120, Math.max(30, Math.ceil(remaining / days / 15) * 15));
    const title = `${prep.verb} · ${d.title}`;
    if (planned.has(title.toLowerCase())) continue;
    candidates.push({
      title,
      minutes: share,
      latest,
      earliest: DAY_START,
      score: 60 + ((d.weight ?? 10) * (prep.exam ? 1.4 : 1)) / (left + 1) + (dueToday ? 40 : 0),
      focus: true,
      task: false,
      tag: "Area:travail:taches",
      color: d.color,
      why: `${d.code} · ${prep.label} ${when(d.due)}${d.weight != null ? ` · ${String(d.weight).replace(".", ",")} %` : ""} · reste ~${frTime(remaining)} à préparer`,
    });
  }

  for (const t of tasks) {
    if (planned.has(t.title.toLowerCase()) || placedTasks.has(t.title.toLowerCase())) continue;
    const area = t.category?.split(":")[0] ?? null;
    const life = area != null && LIFE.has(area);
    const left = t.dueDate ? daysUntil(t.dueDate) : null;
    // A life to-do for another day is that day's business.
    if (life && left != null && left > 0) continue;
    if (!life && left != null && left > 7 && (PRIORITY[t.priority] ?? 2) < 3) continue;
    const dueTime = t.dueDate ? wallMinutes(t.dueDate) : null;
    const hasTime = dueTime != null && dueTime !== 23 * 60 + 59;
    const latest = left === 0 && hasTime ? dueTime! - 15 : DAY_END;
    const tag = `Area:${t.category ?? "travail:taches"}`;
    const section = areaOfTag(tag);
    candidates.push({
      title: t.title,
      minutes: Math.min(120, Math.max(15, t.estimatedTime ?? (t.category === "sante:sport" ? 60 : 45))),
      latest,
      // Sport and errands fit better once the work is done.
      earliest: life ? 16 * 60 : DAY_START,
      score: life ? 20 : (left == null ? 25 : left < 0 ? 100 : 70 - left * 6) + (PRIORITY[t.priority] ?? 2) * 6,
      focus: !life,
      task: true,
      tag,
      color: t.course?.color ?? section?.area.color ?? "#3b82f6",
      why: [
        t.course?.code ?? section?.sub?.label,
        left == null ? "sans échéance" : left < 0 ? "en retard" : left === 0 ? (hasTime ? `avant ${frTime(dueTime!)}` : "à faire aujourd'hui") : left === 1 ? "pour demain" : `dans ${left} jours`,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const blocks: PlanBlock[] = [];
  const unplaced: Unplaced[] = [];
  let streak = 0;
  let lastEnd = -1;
  let focused = 0;
  for (const c of candidates) {
    if (c.focus && focused + c.minutes > FOCUS_CAP) {
      unplaced.push({ title: c.title, why: c.why, reason: `ta limite de ${hm(FOCUS_CAP)} de travail concentré est atteinte` });
      continue;
    }
    let placed = false;
    for (const g of gaps) {
      const follows = g[0] <= lastEnd + 5;
      let start = Math.max(g[0], c.earliest);
      if (follows && start === g[0] && streak + c.minutes > MAX_STREAK) start += BREAK;
      const end = start + c.minutes;
      if (end > g[1] || end > c.latest) continue;
      blocks.push({ title: c.title, start: fmt(start), end: fmt(end), tag: c.tag, color: c.color, why: c.why, ...(c.task ? { task: true } : {}) });
      placed = true;
      streak = follows && start === g[0] ? streak + c.minutes : c.minutes;
      lastEnd = end;
      if (c.focus) focused += c.minutes;
      // A block placed late in a gap (sport after 16 h) leaves the start of it free.
      if (start > g[0] + 30) gaps.push([g[0], start - 5]);
      g[0] = end + 5;
      gaps.sort((x, y) => x[0] - y[0]);
      break;
    }
    if (!placed)
      unplaced.push({
        title: c.title,
        why: c.why,
        reason: c.latest < DAY_END ? `pas de créneau libre de ${hm(c.minutes)} avant ${hm(c.latest)}` : `pas de créneau libre de ${hm(c.minutes)} ce jour-là`,
      });
  }
  blocks.sort((a, b) => a.start.localeCompare(b.start));
  return { blocks, left: unplaced.length, free, unplaced };
}

export interface WeekPlan {
  days: { day: string; blocks: PlanBlock[]; free: number; rest: boolean }[];
  /** What found no slot anywhere this week, and the last reason it was refused. */
  unplaced: Unplaced[];
  /** Fixed commitments, never moved: how many classes and appointments the plan works around. */
  fixed: number;
}

/**
 * Plan seven days at once, without double-counting: what one day takes (study time, a
 * task) is taken into account by the next. Only adds blocks in free time; classes,
 * appointments and deadlines are never moved.
 */
export async function planWeek(userId: string, from: string): Promise<WeekPlan> {
  const prefs = await getPlanningPrefs(userId);
  const start = fromISODate(from)!;
  const virtual: VirtualBlock[] = [];
  const days: WeekPlan["days"] = [];
  const lastRefusal = new Map<string, Unplaced>();
  const placedOnce = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const day = toISODate(addDays(start, i));
    const p = await planDay(userId, day, { prefs, virtual });
    days.push({ day, blocks: p.blocks, free: p.free, rest: !!p.rest });
    for (const b of p.blocks) {
      virtual.push({ date: day, title: b.title, start: b.start, end: b.end, task: b.task });
      placedOnce.add(b.title);
    }
    for (const u of p.unplaced) lastRefusal.set(u.title, u);
  }
  const end = addDays(start, 7);
  const [schedules, events] = await Promise.all([
    prisma.courseSchedule.findMany({ where: { course: { userId } }, select: { day: true } }),
    prisma.calendarEvent.count({ where: { userId, date: { gte: start, lt: end }, startTime: { not: null }, NOT: { notes: PILOT_NOTE } } }),
  ]);
  const weekdays = days.map((d) => dayName(fromISODate(d.day)!));
  const fixed = schedules.filter((s) => weekdays.includes(s.day)).length + events;
  return { days, unplaced: [...lastRefusal.values()].filter((u) => !placedOnce.has(u.title)), fixed };
}
