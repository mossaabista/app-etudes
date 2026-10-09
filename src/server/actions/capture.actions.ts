"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { currentZone, addDays, fromISODate, toISODate, wallTimeToUtc } from "@/lib/dates";
import { parseCapture } from "@/lib/capture";
import { addMinutes, describeSource, intentsOf, isDeadline, minutesBetween, parseIntent, politeless, score, splitCommands, type Intent } from "@/lib/command";
import { fold } from "@/lib/capture";
import { assistantEnabled, type Turn } from "@/server/assistant";
import { runAssistant, runConfirmedPlan, type Confirmation } from "@/server/assistant-run";
import { assessRisk } from "@/lib/risk";
import { getAutonomy } from "@/server/autonomy";
import { newOpId, openPending, sealPending } from "@/server/pending";
import { applyWorkspace } from "@/server/workspaces";
import { radarText, riskRadar } from "@/server/radar";
import { addFact, forgetFacts, listFacts } from "@/server/memory";
import { appendTurns, clearTurns, listTurns, type Outcome } from "@/server/conversation";
import { allow } from "@/server/rate-limit";
import { detectTemplate, nameFrom } from "@/lib/workspaces";
import { claim, findOp, isUndoable, markUndone, recentActions, settle, type LoggedAction } from "@/server/agent-log";
import { saveLayout, LAYOUT_MODULE } from "@/server/layout";
import type { Layout } from "@/lib/layout";
import { briefing } from "@/server/briefing";
import { areaByKey } from "@/lib/task-areas";

/** Enough to put back exactly what a command changed. Checked against the user on undo. */
export type Undo =
  | { t: "delete-event"; id: string }
  | { t: "delete-task"; id: string }
  | { t: "event-was"; id: string; date: string; startTime: string | null; endTime: string | null; title: string; notes?: string | null }
  | { t: "task-was"; id: string; dueDate: string | null; title: string }
  | { t: "restore-event"; data: { title: string; type: string; date: string; startTime: string | null; endTime: string | null; allDay: boolean; notes: string | null; courseId: string | null } }
  | { t: "many"; list: Undo[] }
  | { t: "delete-project"; id: string }
  | { t: "delete-milestone"; id: string }
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
  /** Nothing was changed: the user is asked first, and confirms with the token. */
  | { confirm: Confirmation }
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
  new Intl.DateTimeFormat("en-GB", { timeZone: currentZone(), hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

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
type CommandOptions = {
  area?: string;
  sub?: string;
  pick?: { kind: "event" | "task"; id: string };
  page?: string;
  history?: Turn[];
  /** One id per submission, made by the browser: the same submission twice runs once. */
  opId?: string;
  /** Keep this exchange in the Assistant page's conversation. */
  record?: boolean;
};

const OP_ID = /^[\w-]{8,64}$/;

export async function commandAction(input: string, options?: CommandOptions): Promise<CommandResult> {
  const user = await requireUser();
  const text = input.trim().slice(0, 300);
  if (!text) return { error: "Dis ou écris ce que tu veux faire." };
  if (!allow(user.id, "command")) return { error: "Beaucoup de demandes d'un coup : attends une minute avant de recommencer." };
  const opId = typeof options?.opId === "string" && OP_ID.test(options.opId) ? options.opId : null;
  // Answers (history, radar, memory list) leave no trace in the log; changes (« retiens que… ») do.
  const res = await logged(user.id, opId, assistantEnabled() ? "assistant" : "rules", async () => (await metaCommand(user.id, text)) ?? runCommand(user.id, text, options));
  if (options?.record) await record(user.id, text, res);
  return res;
}

/** How a command ended, for the conversation and the voice: never "done" unless it was. */
async function outcomeOf(res: CommandResult): Promise<Outcome> {
  if ("error" in res) return "failed";
  if ("confirm" in res) return "confirm";
  if ("choose" in res) return "answer";
  return res.partial ? "partial" : res.answer || !res.undo ? "answer" : "done";
}

async function record(userId: string, text: string | null, res: CommandResult) {
  const reply = "error" in res ? res.error : "confirm" in res ? `Avant de le faire, j'ai besoin de ton accord : ${res.confirm.items.join(" ; ")}.` : "choose" in res ? res.question : res.message;
  try {
    await appendTurns(userId, [...(text ? [{ role: "user" as const, text }] : []), { role: "assistant" as const, text: reply, outcome: await outcomeOf(res) }]);
  } catch (e) {
    console.warn("[orom] conversation non enregistrée :", e instanceof Error ? e.message.split("\n")[0] : e);
  }
}

/** The Assistant page's conversation. */
export async function conversationAction() {
  const user = await requireUser();
  return listTurns(user.id);
}

export async function clearConversationAction() {
  const user = await requireUser();
  return { ok: true as const, count: await clearTurns(user.id) };
}

/**
 * Run an operation once per id, and record what it changed. Without an id, or without
 * the log table, it simply runs.
 */
async function logged(userId: string, opId: string | null, source: string, work: () => Promise<CommandResult>): Promise<CommandResult> {
  const claimed = opId ? await claim(userId, opId, source) : "unavailable";
  if (claimed === "duplicate") {
    const first = await findOp(userId, opId!);
    if (!first || first.status === "running") return { error: "Cette demande est déjà en cours." };
    return { ok: true, message: `Déjà fait : ${first.summary}`, undo: null, answer: true };
  }
  const res = await work();
  if (claimed === "claimed") {
    const changed = "ok" in res && !!res.undo;
    await settle(userId, opId!, { changed, partial: "ok" in res && !!res.partial, summary: "ok" in res ? res.message : "", undo: "ok" in res ? res.undo : null });
  }
  return res;
}

const RISK = /(qu'?est-ce qui|quoi|qu'?est ce qui|what).{0,40}(risque|a risque|en retard|pas (fini|termine)|ne sera pas|at risk|behind|late)|\bradar\b|\ba risque\b/;
const REMEMBER = /^(stp |s'il te plait )?(retiens|souviens-toi|souviens toi|rappelle-toi|memorise|note bien|remember)( bien)? (que|qu'|de |d'|that )/;
const FORGET = /^(stp |s'il te plait )?(oublie|forget)( tout)? (que |qu'|ce que tu sais sur |about |that )/;
const RECALL = /(qu'?est-ce que tu sais (de|sur) moi|que sais-tu (de|sur) moi|ta memoire|tu te souviens de quoi|what do you (know|remember) about me)/;
const HISTORY = /(qu'?est-ce que tu as|qu'?as-tu|qu'?est-ce qui a|what did you|what have you) (change|fait|modifie|ete change|ete modifie|do|done|changed)|historique (de l'assistant|des actions)/;
const UNDO_LAST = /^(stp |s'il te plait )?(annule|defais|undo) (ta|la|ma|mon|ton|le) (derniere|dernier|last) ?(action|modification|changement|commande|change)?\b|annule ce que tu (viens de faire|as fait)/;
const hhmm24 = (d: Date) => hhmm(d).replace(":", " h ");

/** "Qu'as-tu changé ?" and "annule ta dernière action": answered from the log, not the model. */
async function metaCommand(userId: string, text: string): Promise<CommandResult | null> {
  const f = fold(text).replace(/[’]/g, "'").replace(/[?!.]+$/, "").trim();
  if (HISTORY.test(f)) {
    const rows = await recentActions(userId, 5);
    if (!rows) return { ok: true, answer: true, undo: null, message: "L'historique de l'assistant n'est pas encore activé sur ce serveur : je ne peux pas te dire ce que j'ai changé avant cette session." };
    if (!rows.length) return { ok: true, answer: true, undo: null, message: "Je n'ai encore rien modifié pour toi." };
    const lines = rows.map((r) => `${toISODate(r.createdAt) === toISODate(new Date()) ? "Aujourd'hui" : dayWords(toISODate(r.createdAt))} à ${hhmm24(r.createdAt)} : ${r.summary}${r.status === "undone" ? " (annulé)" : r.status === "partial" ? " (en partie)" : ""}`);
    return { ok: true, answer: true, undo: null, message: `Mes dernières modifications. ${lines.join(" ")}` };
  }
  // Memory: only what the user explicitly asks to keep, always visible and deletable.
  if (REMEMBER.test(f)) {
    const what = text.replace(/^[^]*?\b(que|qu'|qu’|de|d'|d’|that)\s*/i, "").trim();
    const r = await addFact(userId, what);
    if ("error" in r) return { error: r.error };
    return { ok: true, message: `C'est retenu : « ${r.fact.text} ». Tu peux le voir ou l'effacer dans Réglages → Mémoire.`, undo: { t: "entry-delete", id: r.fact.id } };
  }
  if (FORGET.test(f)) {
    // « oublie ce que tu sais sur le sport » → « le sport » ; « oublie que je… » → « je… ».
    const about = (/\b(?:sais|sait|know)\s+(?:sur|de|about)\s+(.+)$/i.exec(text)?.[1] ?? text.replace(/^[^]*?\b(que|qu'|qu’|about|that)\s*/i, "")).trim();
    const gone = await forgetFacts(userId, about);
    return gone.length ? { ok: true, undo: null, message: `C'est oublié : ${gone.map((g) => `« ${g} »`).join(", ")}.` } : { error: "Je ne retenais rien là-dessus." };
  }
  if (RECALL.test(f)) {
    const facts = await listFacts(userId);
    return { ok: true, answer: true, undo: null, message: facts.length ? `Voici ce que tu m'as demandé de retenir : ${facts.map((x) => `« ${x.text} »`).join(", ")}.` : "Je ne retiens rien sur toi tant que tu ne me le demandes pas (« retiens que… »)." };
  }
  if (RISK.test(f)) return { ok: true, answer: true, undo: null, message: radarText(await riskRadar(userId)) };
  if (UNDO_LAST.test(f)) {
    const rows = await recentActions(userId, 10);
    if (!rows) return { error: "L'historique de l'assistant n'est pas encore activé sur ce serveur : utilise le bouton Annuler juste après une modification." };
    const last = rows.find((r) => isUndoable(r));
    if (!last) return { error: "Je ne trouve aucune modification récente que je peux annuler." };
    return undoLogged(userId, last);
  }
  return null;
}

async function undoLogged(userId: string, row: LoggedAction): Promise<CommandResult> {
  const missed = await revert(userId, row.undo!);
  await markUndone(userId, { id: row.id });
  done();
  return {
    ok: true,
    undo: null,
    partial: missed > 0,
    message: missed ? `Annulé en partie (${missed} élément${missed > 1 ? "s avaient" : " avait"} déjà changé) : ${row.summary}` : `J'ai annulé : ${row.summary}`,
  };
}

/** Undo one entry of the history, by its id. Only the user's own, recent, not yet undone. */
export async function undoLoggedAction(id: string): Promise<CommandResult> {
  const user = await requireUser();
  const rows = await recentActions(user.id, 50);
  const row = rows?.find((r) => r.id === id);
  if (!row || !isUndoable(row)) return { error: "Cette modification ne peut plus être annulée." };
  return undoLogged(user.id, row);
}

const WORKSPACE = /^(stp |s'il te plait )?(cree|creer|prepare|preparer|organise|organiser|monte|mets en place)[- ]?(moi|-moi)? (un |mon |l'|ma )?(espace|activite|semestre|entrainement)\b/;

/** "Crée-moi un espace pour…": built from a template and the user's real data. */
async function workspaceCommand(userId: string, text: string): Promise<CommandResult | null> {
  if (!WORKSPACE.test(fold(text).replace(/[’]/g, "'"))) return null;
  const template = detectTemplate(text);
  if (!template) return { error: "Quel genre d'espace ? Par exemple : un projet (« crée un espace pour mon projet Site web »), ton semestre, ton activité de freelance ou ton entraînement." };
  const r = await applyWorkspace(userId, template, nameFrom(text));
  if ("error" in r) return { error: r.error };
  done();
  return { ok: true, message: r.message, undo: r.undos.length === 1 ? r.undos[0] : { t: "many", list: r.undos }, navigate: r.href, partial: r.partial };
}

async function runCommand(userId: string, text: string, options?: CommandOptions): Promise<CommandResult> {
  const user = { id: userId };
  const today = toISODate(new Date());

  // With an API key, Claude reads the sentence against the agenda; the rules are the fallback.
  if (assistantEnabled() && !options?.pick) {
    const history = (options?.history ?? []).filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.text === "string").slice(-6);
    const r = await runAssistant(user.id, text, (options?.page ?? "/today").slice(0, 120), history);
    if (r && "confirm" in r) return r;
    if (r) {
      if (r.undos.length) done();
      return { ok: true, message: r.message, undo: r.undos.length ? (r.undos.length === 1 ? r.undos[0] : { t: "many", list: r.undos }) : null, answer: r.answer, navigate: r.navigate, partial: r.partial };
    }
  }

  const workspace = await workspaceCommand(user.id, text);
  if (workspace) return workspace;

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
      else if ("confirm" in r) missed.push(`« ${parts[i]} » : demande-le seul, je te demanderai confirmation`);
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
  options?: {
    area?: string;
    sub?: string;
    pick?: { kind: "event" | "task"; id: string };
    /** Confirmed: act on exactly these, and ask nothing more. */
    only?: { kind: "event" | "task"; id: string }[];
  }
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
  if (options?.only) {
    chosen = candidates.filter((c) => options.only!.some((o) => o.kind === c.kind && o.id === c.id));
    if (!chosen.length) return { error: "Ces éléments ont déjà changé ou disparu : rien n'a été supprimé." };
  } else if (picked) chosen = [picked];
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

  // Deleting asks first when the user's mode says so; the same rules as the assistant.
  if (intent.kind === "delete" && !options?.only) {
    const verdict = assessRisk(chosen.map(() => ({ op: "delete" })), await getAutonomy(userId));
    if (verdict.confirm) {
      const opId = newOpId();
      const token = sealPending(userId, { kind: "rules", text, only: chosen.map((c) => ({ kind: c.kind, id: c.id })), opId });
      return { confirm: { token, opId, risk: verdict.risk, items: chosen.map((c) => `supprimer « ${c.title} »`), reasons: verdict.reasons, reply: "" } };
    }
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
    data: { userId, title: p.title, category: `${area}:${sub}`, dueDate: atWall(p.day, p.time ?? "23:59"), estimatedTime: p.found.minutes ? p.minutes : null, priority: p.priority, status: "ToDo" },
  });
  done();
  return { ok: true, message: `${p.title} → ${section}, ${isDeadline(text) ? "à rendre " : "à faire "}${when}.`, undo: { t: "delete-task", id: t.id } };
}

/** The user said yes to what was proposed: do it now, through the usual checks. */
export async function confirmCommandAction(token: string, options?: { record?: boolean }): Promise<CommandResult> {
  const user = await requireUser();
  const res = await confirmed(user.id, token);
  if (options?.record) await record(user.id, null, res);
  return res;
}

async function confirmed(userId: string, token: string): Promise<CommandResult> {
  const user = { id: userId };
  const opened = openPending(user.id, token);
  if ("error" in opened) return { error: opened.error };
  const work = opened.work;
  // The token carries its own id: confirming twice (double tap, replay) runs it once.
  const opId = typeof work.opId === "string" && OP_ID.test(work.opId) ? work.opId : null;
  return logged(user.id, opId, "confirmed", async () => {
    if (work.kind === "plan") {
      const r = await runConfirmedPlan(user.id, work);
      if (r.undos.length) done();
      return { ok: true, message: r.message, undo: r.undos.length ? (r.undos.length === 1 ? r.undos[0] : { t: "many", list: r.undos }) : null, answer: r.answer, navigate: r.navigate, partial: r.partial };
    }
    const only = (Array.isArray(work.only) ? work.only : []).filter((o) => (o.kind === "event" || o.kind === "task") && typeof o.id === "string").slice(0, 50);
    return runOne(user.id, work.text, parseIntent(work.text), toISODate(new Date()), { only });
  });
}

function done() {
  revalidatePath("/", "layout");
}

/**
 * Put things back as they were before the last command. Only ever touches the user's own
 * rows. `missed` counts the steps that could not be put back (the row is gone, or a course
 * already holds something), so the user is never told "undone" when it was not.
 */
export async function undoCommandAction(undo: Undo, opId?: string, options?: { record?: boolean }): Promise<{ ok: true; missed: number }> {
  const user = await requireUser();
  const missed = await revert(user.id, undo);
  if (opId && OP_ID.test(opId)) await markUndone(user.id, { opId });
  // The conversation must not keep saying "done" about something that was undone.
  if (options?.record)
    await appendTurns(user.id, [{ role: "assistant", text: missed ? `Annulé en partie : ${missed} élément${missed > 1 ? "s avaient" : " avait"} déjà changé.` : "Annulé.", outcome: missed ? "partial" : "cancelled" }]).catch(() => {});
  done();
  return { ok: true, missed };
}

async function revert(userId: string, undo: Undo): Promise<number> {
  const own = { userId };
  const hit = ({ count }: { count: number }) => (count > 0 ? 0 : 1);
  switch (undo.t) {
    case "delete-milestone":
      return hit(await prisma.projectMilestone.deleteMany({ where: { id: undo.id, project: { userId } } }));
    case "delete-project": {
      // Only a project a workspace just created, and only once nothing else is filed in it.
      const p = await prisma.project.findFirst({ where: { id: undo.id, ...own }, select: { id: true } });
      if (!p || (await prisma.task.count({ where: { projectId: p.id } }))) return 1;
      await prisma.project.delete({ where: { id: p.id } });
      return 0;
    }
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
          data: { date: fromISODate(undo.date)!, startTime: undo.startTime, endTime: undo.endTime, allDay: !undo.startTime, title: undo.title.slice(0, 200), ...(undo.notes !== undefined ? { notes: undo.notes } : {}) },
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
