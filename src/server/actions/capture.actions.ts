"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { APP_TIMEZONE, addDays, fromISODate, toISODate, wallTimeToUtc } from "@/lib/dates";
import { parseCapture } from "@/lib/capture";
import { addMinutes, describeSource, intentsOf, isDeadline, minutesBetween, parseIntent, politeless, score, splitCommands, type Intent } from "@/lib/command";
import { fold } from "@/lib/capture";
import { assistantEnabled, type Turn } from "@/server/assistant";
import { runAssistant } from "@/server/assistant-run";
import { saveLayout, LAYOUT_MODULE } from "@/server/layout";
import type { Layout } from "@/lib/layout";
import { briefing } from "@/server/briefing";
import { areaByKey } from "@/lib/task-areas";

/** Enough to put back exactly what a command changed. Checked against the user on undo. */
export type Undo =
  | { t: "delete-event"; id: string }
  | { t: "delete-task"; id: string }
  | { t: "event-was"; id: string; date: string; startTime: string | null; endTime: string | null; title: string }
  | { t: "task-was"; id: string; dueDate: string | null; title: string }
  | { t: "restore-event"; data: { title: string; type: string; date: string; startTime: string | null; endTime: string | null; allDay: boolean; notes: string | null; courseId: string | null } }
  | { t: "many"; list: Undo[] }
  | { t: "task-status"; id: string; status: string }
  | { t: "delete-course"; id: string }
  | { t: "layout-was"; data: Layout }
  | { t: "entry-delete"; id: string }
  | { t: "entry-value"; id: string; value: number }
  | { t: "restore-task"; data: { title: string; description: string | null; category: string | null; dueDate: string | null; estimatedTime: number | null; priority: string; status: string; courseId: string | null; projectId: string | null } };

export interface Choice {
  kind: "event" | "task";
  id: string;
  label: string;
}

export type CommandResult =
  | { error: string }
  | { choose: Choice[]; question: string }
  | {
      ok: true;
      message: string;
      undo: Undo | null;
      /** A spoken-style answer (a review, a question): shown in full. */
      answer?: boolean;
      navigate?: string | null;
      /** Some of what was asked could not be done: the message says which. */
      partial?: boolean;
    };

const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/** A task due at 23:59 has a day, not a time. */
const taskTime = (d: Date | null) => (d && hhmm(d) !== "23:59" ? hhmm(d) : null);

const dayWords = (iso: string) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
const fr = (t: string) => t.replace(/^0/, "").replace(":00", " h").replace(":", " h ");

const atWall = (day: string, time: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return wallTimeToUtc([y, m, d, hh, mm, 0]);
};

/**
 * One sentence in. It either adds something — an appointment when it has a time, a to-do
 * (or a deadline) otherwise, never both — or acts on what is already planned: move,
 * delete, rename. Every change comes back with what is needed to undo it.
 */
export async function commandAction(
  input: string,
  options?: { area?: string; sub?: string; pick?: { kind: "event" | "task"; id: string }; page?: string; history?: Turn[] }
): Promise<CommandResult> {
  const user = await requireUser();
  const text = input.trim().slice(0, 300);
  if (!text) return { error: "Dis ou écris ce que tu veux faire." };
  const today = toISODate(new Date());

  // With an API key, Claude reads the sentence against the agenda; the rules are the fallback.
  if (assistantEnabled() && !options?.pick) {
    const history = (options?.history ?? []).filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string").slice(-6);
    const r = await runAssistant(user.id, text, (options?.page ?? "/today").slice(0, 120), history);
    if (r) {
      if (r.undos.length) done();
      return { ok: true, message: r.message, undo: r.undos.length ? (r.undos.length === 1 ? r.undos[0] : { t: "many", list: r.undos }) : null, answer: r.answer, navigate: r.navigate, partial: r.partial };
    }
  }

  // Several orders in one sentence run one after the other; one confirmation, one undo.
  const parts = splitCommands(text);
  if (parts.length > 1) {
    const intents = intentsOf(parts);
    const done: string[] = [];
    const missed: string[] = [];
    const undos: Undo[] = [];
    for (let i = 0; i < parts.length; i++) {
      const r = await runOne(user.id, parts[i], intents[i], today, { area: options?.area, sub: options?.sub });
      if ("ok" in r) {
        done.push(r.message);
        if (r.undo) undos.push(r.undo);
      } else if ("error" in r) missed.push(`« ${parts[i]} » : ${r.error}`);
    }
    if (!done.length) return { error: missed.join(" ") || "Rien n'a pu être fait." };
    return { ok: true, message: [...done, ...missed].join(" "), undo: undos.length ? { t: "many", list: undos } : null };
  }
  return runOne(user.id, text, parseIntent(text), today, options);
}

async function runOne(
  userId: string,
  text: string,
  intent: Intent,
  today: string,
  options?: { area?: string; sub?: string; pick?: { kind: "event" | "task"; id: string } }
): Promise<CommandResult> {
  const user = { id: userId };
  if (intent.kind === "summary") return { ok: true, message: await briefing(userId, fold(text)), undo: null, answer: true };
  if (intent.kind === "create") return create(user.id, politeless(text), today, options);

  // Find what the sentence points at.
  const src = describeSource(intent.source, today);
  const from = fromISODate(src.day ?? today)!;
  const to = src.day ? addDays(from, 1) : addDays(from, 61);
  const [events, tasks] = await Promise.all([
    prisma.calendarEvent.findMany({ where: { userId: user.id, date: { gte: from, lt: to } }, orderBy: { date: "asc" } }),
    prisma.task.findMany({ where: { userId: user.id, parentId: null, status: { not: "Done" }, dueDate: { gte: from, lt: to } }, orderBy: { dueDate: "asc" } }),
  ]);
  const candidates = [
    ...events.map((e) => ({ kind: "event" as const, id: e.id, title: e.title, day: toISODate(e.date), time: e.startTime, tag: e.type })),
    ...tasks.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, day: toISODate(t.dueDate!), time: taskTime(t.dueDate), tag: t.category })),
  ];

  type Candidate = (typeof candidates)[number];
  let chosen: Candidate[];
  const picked = options?.pick ? candidates.find((c) => c.kind === options.pick!.kind && c.id === options.pick!.id) : undefined;
  if (picked) chosen = [picked];
  else {
    const ranked = candidates
      .map((c) => ({ c, s: score(src, c) + (c.day >= today ? 1 : 0) }))
      .filter((r) => r.s > 0)
      // Ties: the title closest to what was said (fewest extra words), then the soonest.
      .sort((a, b) => b.s - a.s || a.c.title.length - b.c.title.length || a.c.day.localeCompare(b.c.day) || (a.c.time ?? "").localeCompare(b.c.time ?? ""));
    if (!ranked.length) return { error: "Je n'ai rien trouvé qui corresponde. Précise le jour, l'heure ou le nom." };
    // "les trois séances de sport": every equally good match, or exactly that many.
    // Otherwise the single best match — no question asked.
    // Named only by its kind and day ("plus de sport aujourd'hui"): that is all of them.
    const byKindOnly = intent.kind === "delete" && !!src.day && !!src.section && !src.words.some((w) => fold(ranked[0].c.title).includes(w));
    if (src.count) chosen = ranked.slice(0, src.count).map((r) => r.c);
    else if (src.all || byKindOnly) chosen = ranked.filter((r) => r.s === ranked[0].s).map((r) => r.c);
    else chosen = [ranked[0].c];
  }

  const undos: Undo[] = [];
  const names: string[] = [];
  const target = intent.kind === "move" && intent.target ? parseCapture(intent.target, today) : null;

  for (const c of chosen) {
    const event = c.kind === "event" ? events.find((e) => e.id === c.id)! : null;
    const task = c.kind === "task" ? tasks.find((t) => t.id === c.id)! : null;
    names.push(c.title);

    if (intent.kind === "delete") {
      if (event) {
        await prisma.calendarEvent.delete({ where: { id: event.id } });
        undos.push({ t: "restore-event", data: { title: event.title, type: event.type, date: toISODate(event.date), startTime: event.startTime, endTime: event.endTime, allDay: event.allDay, notes: event.notes, courseId: event.courseId } });
      } else {
        await prisma.task.delete({ where: { id: task!.id } });
        undos.push({
          t: "restore-task",
          data: { title: task!.title, description: task!.description, category: task!.category, dueDate: task!.dueDate?.toISOString() ?? null, estimatedTime: task!.estimatedTime, priority: task!.priority, status: task!.status, courseId: task!.courseId, projectId: task!.projectId },
        });
      }
      continue;
    }

    if (intent.kind === "rename") {
      const title = intent.title.trim().slice(0, 200);
      if (event) await prisma.calendarEvent.update({ where: { id: event.id }, data: { title } });
      else await prisma.task.update({ where: { id: task!.id }, data: { title } });
      undos.push(
        event
          ? { t: "event-was", id: event.id, date: toISODate(event.date), startTime: event.startTime, endTime: event.endTime, title: event.title }
          : { t: "task-was", id: task!.id, dueDate: task!.dueDate?.toISOString() ?? null, title: task!.title }
      );
      continue;
    }

    // Move: to another day and/or time, or by a shift.
    const newDay = target?.found.day ? target.day : c.day;
    let newTime = target?.time ?? c.time;
    if (intent.shift != null) {
      if (!c.time) continue;
      newTime = addMinutes(c.time, intent.shift);
    }
    if (newDay === c.day && newTime === c.time) continue;
    if (event) {
      const length = event.startTime && event.endTime ? minutesBetween(event.startTime, event.endTime) : 60;
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { date: fromISODate(newDay)!, startTime: newTime, endTime: newTime ? addMinutes(newTime, length) : event.endTime, allDay: newTime ? false : event.allDay },
      });
      undos.push({ t: "event-was", id: event.id, date: c.day, startTime: event.startTime, endTime: event.endTime, title: event.title });
    } else {
      await prisma.task.update({ where: { id: task!.id }, data: { dueDate: atWall(newDay, newTime ?? "23:59") } });
      undos.push({ t: "task-was", id: task!.id, dueDate: task!.dueDate?.toISOString() ?? null, title: task!.title });
    }
  }

  if (!undos.length) return { error: intent.kind === "move" ? "C'est déjà à ce moment-là." : "Rien à changer." };
  done();
  const what = names.length === 1 ? `« ${names[0]} »` : `${names.length} éléments (${names.map((n) => `« ${n} »`).join(", ")})`;
  const plural = names.length > 1;
  const message =
    intent.kind === "delete"
      ? `${what} supprimé${plural ? "s" : ""}.`
      : intent.kind === "rename"
        ? `${what} renommé${plural ? "s" : ""} en « ${intent.title} ».`
        : `${what} déplacé${plural ? "s" : ""}${target?.found.day ? ` au ${dayWords(target.day)}` : ""}${target?.time ? ` à ${fr(target.time)}` : intent.shift != null ? ` ${intent.shift > 0 ? "plus tard" : "plus tôt"} de ${Math.abs(intent.shift) >= 60 ? `${Math.floor(Math.abs(intent.shift) / 60)} h${Math.abs(intent.shift) % 60 ? ` ${Math.abs(intent.shift) % 60}` : ""}` : `${Math.abs(intent.shift)} min`}` : ""}.`;
  return { ok: true, message, undo: undos.length === 1 ? undos[0] : { t: "many", list: undos } };
}

async function create(userId: string, text: string, today: string, options?: { area?: string; sub?: string }): Promise<CommandResult> {
  const p = parseCapture(text, today);
  const area = options?.area && areaByKey(options.area) ? options.area : p.area;
  const sub = options?.sub ?? p.sub;
  const a = areaByKey(area);
  const section = `${a?.label ?? area} · ${a?.subs.find((s) => s.key === sub)?.label ?? sub}`;
  const when = `${p.day === today ? "aujourd'hui" : dayWords(p.day)}${p.time ? ` à ${fr(p.time)}` : ""}`;

  // A time makes it an appointment on the calendar — unless it is a hand-in time.
  if (p.time && !isDeadline(text)) {
    const e = await prisma.calendarEvent.create({
      data: { userId, title: p.title, type: `Area:${area}:${sub}`, date: fromISODate(p.day)!, startTime: p.time, endTime: addMinutes(p.time, p.minutes), allDay: false },
    });
    done();
    return { ok: true, message: `${p.title} → ${section}, ${when}. Ajouté au calendrier.`, undo: { t: "delete-event", id: e.id } };
  }

  const t = await prisma.task.create({
    data: { userId, title: p.title, category: `${area}:${sub}`, dueDate: atWall(p.day, p.time ?? "23:59"), estimatedTime: p.found.minutes ? p.minutes : null, priority: "Medium", status: "ToDo" },
  });
  done();
  return { ok: true, message: `${p.title} → ${section}, ${isDeadline(text) ? "à rendre " : "à faire "}${when}.`, undo: { t: "delete-task", id: t.id } };
}

function done() {
  revalidatePath("/", "layout");
}

/**
 * Put things back as they were before the last command. Only ever touches the user's own
 * rows. `missed` counts the steps that could not be put back (the row is gone, or a course
 * already holds something), so the user is never told "undone" when it was not.
 */
export async function undoCommandAction(undo: Undo): Promise<{ ok: true; missed: number }> {
  const user = await requireUser();
  const missed = await revert(user.id, undo);
  done();
  return { ok: true, missed };
}

async function revert(userId: string, undo: Undo): Promise<number> {
  const own = { userId };
  const hit = ({ count }: { count: number }) => (count > 0 ? 0 : 1);
  switch (undo.t) {
    case "delete-course": {
      // Only a course the assistant just created, and only while it is still empty.
      const c = await prisma.course.findFirst({ where: { id: undo.id, ...own }, include: { _count: { select: { assessments: true, tasks: true, schedules: true } } } });
      if (!c || c._count.assessments || c._count.tasks || c._count.schedules) return 1;
      await prisma.course.delete({ where: { id: c.id } });
      return 0;
    }
    case "layout-was":
      await saveLayout(userId, undo.data);
      return 0;
    case "entry-delete":
      return hit(await prisma.trackerEntry.deleteMany({ where: { id: undo.id, ...own, NOT: { module: LAYOUT_MODULE } } }));
    case "entry-value":
      return hit(await prisma.trackerEntry.updateMany({ where: { id: undo.id, ...own }, data: { value: undo.value } }));
    case "task-status":
      return hit(await prisma.task.updateMany({ where: { id: undo.id, ...own }, data: { status: undo.status } }));
    case "many": {
      let missed = 0;
      for (const u of undo.list.slice(0, 50)) if (u.t !== "many") missed += await revert(userId, u);
      return missed;
    }
    case "delete-event":
      return hit(await prisma.calendarEvent.deleteMany({ where: { id: undo.id, ...own } }));
    case "delete-task":
      return hit(await prisma.task.deleteMany({ where: { id: undo.id, ...own } }));
    case "event-was":
      return hit(
        await prisma.calendarEvent.updateMany({
          where: { id: undo.id, ...own },
          data: { date: fromISODate(undo.date)!, startTime: undo.startTime, endTime: undo.endTime, title: undo.title.slice(0, 200) },
        })
      );
    case "task-was":
      return hit(await prisma.task.updateMany({ where: { id: undo.id, ...own }, data: { dueDate: undo.dueDate ? new Date(undo.dueDate) : null, title: undo.title.slice(0, 200) } }));
    case "restore-event": {
      const d = undo.data;
      const date = fromISODate(d.date);
      if (!date) return 1;
      const course = d.courseId ? await prisma.course.findFirst({ where: { id: d.courseId, ...own }, select: { id: true } }) : null;
      await prisma.calendarEvent.create({
        data: { ...own, title: d.title.slice(0, 200), type: d.type.slice(0, 80), date, startTime: d.startTime, endTime: d.endTime, allDay: d.allDay, notes: d.notes, courseId: course?.id ?? null },
      });
      return 0;
    }
    case "restore-task": {
      const d = undo.data;
      const [course, project] = await Promise.all([
        d.courseId ? prisma.course.findFirst({ where: { id: d.courseId, ...own }, select: { id: true } }) : null,
        d.projectId ? prisma.project.findFirst({ where: { id: d.projectId, ...own }, select: { id: true } }) : null,
      ]);
      await prisma.task.create({
        data: {
          ...own,
          title: d.title.slice(0, 200),
          description: d.description,
          category: d.category,
          dueDate: d.dueDate ? new Date(d.dueDate) : null,
          estimatedTime: d.estimatedTime,
          priority: d.priority,
          status: d.status,
          courseId: course?.id ?? null,
          projectId: project?.id ?? null,
        },
      });
      return 0;
    }
  }
  return 1;
}
