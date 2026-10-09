import { prisma } from "@/lib/db";
import { addDays, dayName, fromISODate, toISODate } from "@/lib/dates";
import { sanitizeFoodPrefs, shoppingList, weekMenu } from "@/lib/nutrition";
import { MAX_WORKFLOWS, dueOn, needsConfirm, stepLabel, validateWorkflow, type Step, type Workflow } from "@/lib/workflows";
import { executePlan } from "@/server/assistant-run";
import { addGroceries } from "@/server/groceries";
import { buildDailyDigest } from "@/server/notifications/digest";
import { pushIsConfigured, sendToUser } from "@/server/notifications/push";
import type { AssistantAction } from "@/server/assistant";
import type { Undo } from "@/server/actions/capture.actions";

/**
 * Storing and running workflows. Each run is claimed under a key before anything happens
 * (the day for a scheduled run, the request id for a manual one), so a double click or a
 * cron that fires twice never runs the same workflow twice. Every step goes through the
 * same server code, checks and ownership rules as a request made by hand; its outcome is
 * logged in words, and what a run changed can be taken back.
 */

export const WF_MODULE = "app:workflows";
export const RUNS_MODULE = "app:workflow-runs";
const KEEP_RUNS = 60;
/** A run still "running" after this long was interrupted (deploy, timeout). */
const STALE_MS = 10 * 60 * 1000;

export type StepStatus = "done" | "skipped" | "failed";
export type RunStatus = "running" | "done" | "partial" | "failed" | "skipped" | "interrupted";

export interface RunStep {
  label: string;
  status: StepStatus;
  message: string;
}

export interface Run {
  id: string;
  workflowId: string;
  name: string;
  trigger: "manual" | "schedule";
  status: RunStatus;
  steps: RunStep[];
  /** Why the run did nothing (condition not met), when it did nothing. */
  note: string | null;
  undo: Undo | null;
  undone: boolean;
  startedAt: string;
  finishedAt: string | null;
}

type Row = { id: string; text: string | null; data: unknown; createdAt: Date };

const toWorkflow = (r: Row): Workflow => {
  const d = (r.data ?? {}) as Partial<Workflow>;
  return {
    id: r.id,
    name: d.name ?? "Automatisation",
    enabled: d.enabled !== false,
    trigger: d.trigger ?? { type: "manual" },
    condition: d.condition ?? "always",
    steps: Array.isArray(d.steps) ? d.steps : [],
    authorizedAt: d.authorizedAt ?? null,
    createdAt: r.createdAt.toISOString(),
  };
};

const toRun = (r: Row): Run => {
  const d = (r.data ?? {}) as Partial<Run>;
  const status = d.status === "running" && Date.now() - r.createdAt.getTime() > STALE_MS ? "interrupted" : (d.status ?? "failed");
  return {
    id: r.id,
    workflowId: d.workflowId ?? "",
    name: d.name ?? "",
    trigger: d.trigger ?? "manual",
    status,
    steps: d.steps ?? [],
    note: d.note ?? null,
    undo: d.undo ?? null,
    undone: !!d.undone,
    startedAt: d.startedAt ?? r.createdAt.toISOString(),
    finishedAt: d.finishedAt ?? null,
  };
};

export async function listWorkflows(userId: string): Promise<Workflow[]> {
  const rows = await prisma.trackerEntry.findMany({ where: { userId, module: WF_MODULE, kind: "workflow" }, orderBy: { createdAt: "asc" }, select: { id: true, text: true, data: true, createdAt: true } });
  return rows.map(toWorkflow);
}

async function getWorkflow(userId: string, id: string): Promise<Workflow | null> {
  const row = await prisma.trackerEntry.findFirst({ where: { id, userId, module: WF_MODULE, kind: "workflow" }, select: { id: true, text: true, data: true, createdAt: true } });
  return row ? toWorkflow(row) : null;
}

/** Create, or replace the definition of, one of the user's workflows. */
export async function saveWorkflow(userId: string, raw: unknown, id?: string): Promise<{ workflow: Workflow } | { error: string }> {
  const v = validateWorkflow(raw);
  if ("error" in v) return v;
  const { authorize, ...def } = v.ok;
  const existing = id ? await getWorkflow(userId, id) : null;
  if (id && !existing) return { error: "Automatisation introuvable." };
  if (!existing && (await prisma.trackerEntry.count({ where: { userId, module: WF_MODULE, kind: "workflow" } })) >= MAX_WORKFLOWS)
    return { error: `${MAX_WORKFLOWS} automatisations au plus : supprimes-en une d'abord.` };
  // Running on its own is only ever allowed by an explicit yes, given when it is saved.
  const sameSchedule = existing && JSON.stringify(existing.trigger) === JSON.stringify(def.trigger) && JSON.stringify(existing.steps) === JSON.stringify(def.steps);
  const authorizedAt = def.trigger.type !== "daily" ? null : authorize ? new Date().toISOString() : sameSchedule ? existing!.authorizedAt : null;
  if (def.trigger.type === "daily" && !authorizedAt) return { error: "Pour qu'elle se lance seule, coche l'autorisation d'exécution automatique." };
  const data = { ...def, authorizedAt };
  const row = existing
    ? await prisma.trackerEntry.update({ where: { id: existing.id }, data: { text: def.name, data }, select: { id: true, text: true, data: true, createdAt: true } })
    : await prisma.trackerEntry.create({ data: { userId, module: WF_MODULE, kind: "workflow", date: new Date(), text: def.name, data }, select: { id: true, text: true, data: true, createdAt: true } });
  return { workflow: toWorkflow(row) };
}

export async function setWorkflowEnabled(userId: string, id: string, enabled: boolean) {
  const w = await getWorkflow(userId, id);
  if (!w) return false;
  await prisma.trackerEntry.update({ where: { id }, data: { data: { name: w.name, trigger: w.trigger, condition: w.condition, steps: w.steps, authorizedAt: w.authorizedAt, enabled } } });
  return true;
}

/** Delete a workflow and its run history. */
export async function deleteWorkflow(userId: string, id: string) {
  const { count } = await prisma.trackerEntry.deleteMany({ where: { id, userId, module: WF_MODULE, kind: "workflow" } });
  if (count) await prisma.trackerEntry.deleteMany({ where: { userId, module: RUNS_MODULE, text: { startsWith: `${id}:` } } });
  return count > 0;
}

export async function listRuns(userId: string, limit = 30): Promise<Run[]> {
  const rows = await prisma.trackerEntry.findMany({ where: { userId, module: RUNS_MODULE }, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, text: true, data: true, createdAt: true } });
  return rows.map(toRun);
}

/** Something to hand in within two days: tasks, assessments, labs. */
async function dueSoon(userId: string): Promise<boolean> {
  const now = new Date();
  const soon = addDays(now, 2);
  const [tasks, assessments, labs] = await Promise.all([
    prisma.task.count({ where: { userId, status: { not: "Done" }, dueDate: { gte: now, lt: soon } } }),
    prisma.assessment.count({ where: { userId, status: { not: "Completed" }, dueDate: { gte: now, lt: soon } } }),
    prisma.labSession.count({ where: { userId, status: { notIn: ["Completed", "Submitted"] }, dueDate: { gte: now, lt: soon } } }),
  ]);
  return tasks + assessments + labs > 0;
}

const EMPTY_CTX = { ids: new Set<string>(), assessmentIds: new Set<string>(), projectIds: new Set<string>() };

/** One step, through the same code as a request made by hand. Never throws. */
async function runStep(userId: string, s: Step, today: string): Promise<{ status: StepStatus; message: string; undos: Undo[] }> {
  try {
    const viaPlan = async (a: AssistantAction) => {
      const r = await executePlan(userId, [a], "", EMPTY_CTX);
      return { status: (r.partial ? "failed" : "done") as StepStatus, message: r.message, undos: r.undos };
    };
    switch (s.type) {
      case "plan_day":
        return await viaPlan({ op: "plan_day", date: today });
      case "plan_week":
        return await viaPlan({ op: "plan_week", date: today });
      case "plan_workouts":
        return await viaPlan({ op: "plan_workouts", sessions: s.sessions, minutes: s.minutes, when: s.when });
      case "create_task": {
        const date = toISODate(addDays(fromISODate(today)!, s.dueInDays));
        return await viaPlan({ op: "create_task", title: s.title, date });
      }
      case "groceries_week": {
        const plan = await prisma.trackerEntry.findFirst({ where: { userId, module: "sante:nutrition", kind: "plan" }, select: { data: true } });
        const d = plan?.data as { kcal?: number; prefs?: unknown } | null;
        if (!d?.kcal) return { status: "failed", message: "Remplis d'abord ton profil nutrition : sans lui, je ne sais pas quoi mettre sur la liste.", undos: [] };
        const r = await addGroceries(userId, shoppingList(weekMenu(today, d.kcal, sanitizeFoodPrefs(d.prefs))).map((i) => ({ food: i.food, grams: i.grams })));
        if ("error" in r) return { status: "failed", message: r.error, undos: [] };
        return {
          status: "done",
          message: r.added ? `${r.added} article${r.added > 1 ? "s" : ""} ajouté${r.added > 1 ? "s" : ""} aux courses${r.skipped ? ` (${r.skipped} déjà sur la liste)` : ""}.` : "Tout était déjà sur la liste de courses.",
          undos: r.ids.map((id) => ({ t: "entry-delete", id })),
        };
      }
      case "notify_briefing": {
        if (!pushIsConfigured()) return { status: "skipped", message: "Les notifications ne sont pas configurées sur ce serveur.", undos: [] };
        if (!(await prisma.pushSubscription.count({ where: { userId } }))) return { status: "skipped", message: "Aucun appareil n'a activé les notifications (Réglages).", undos: [] };
        const digest = await buildDailyDigest(userId);
        if (!digest) return { status: "skipped", message: "Rien à signaler aujourd'hui : pas de notification.", undos: [] };
        const sent = await sendToUser(userId, { ...digest, tag: "workflow-briefing" });
        return sent.sent > 0
          ? { status: "done", message: `Résumé envoyé sur ${sent.sent} appareil${sent.sent > 1 ? "s" : ""}.`, undos: [] }
          : { status: "failed", message: "La notification n'a pu être remise à aucun appareil.", undos: [] };
      }
    }
  } catch {
    // The details stay in the server logs; the user gets the plain fact.
    return { status: "failed", message: "Erreur pendant cette étape : elle n'a pas abouti.", undos: [] };
  }
}

export type RunOutcome = { run: Run } | { duplicate: true; run: Run | null } | { confirm: string } | { error: string };

/**
 * Run a workflow once under `key`. A key already used means the run already happened (or
 * is happening): nothing runs twice. Steps run in order; the first failure stops the rest,
 * so a half-done sequence never carries on as if all was well.
 */
export async function runWorkflow(userId: string, id: string, opts: { trigger: "manual" | "schedule"; key: string; confirmed?: boolean; today?: string }): Promise<RunOutcome> {
  const w = await getWorkflow(userId, id);
  if (!w) return { error: "Automatisation introuvable." };
  if (opts.trigger === "schedule" && !dueOn(w, dayName(fromISODate(opts.today ?? toISODate(new Date()))!))) return { error: "Pas prévue aujourd'hui, désactivée ou non autorisée." };
  if (opts.trigger === "manual" && needsConfirm(w) && !opts.confirmed) return { confirm: `« ${w.name} » va remplir ta semaine de blocs de travail. On y va ?` };
  if (!w.steps.length) return { error: "Cette automatisation n'a aucune étape." };

  const runKey = `${w.id}:${opts.key}`;
  const select = { id: true, text: true, data: true, createdAt: true } as const;
  const already = await prisma.trackerEntry.findFirst({ where: { userId, module: RUNS_MODULE, text: runKey }, select });
  if (already) return { duplicate: true, run: toRun(already) };
  const startedAt = new Date().toISOString();
  const base = { workflowId: w.id, name: w.name, trigger: opts.trigger, startedAt };
  const mine = await prisma.trackerEntry.create({ data: { userId, module: RUNS_MODULE, kind: "run", date: new Date(), text: runKey, data: { ...base, status: "running", steps: [] } }, select });
  // Two claims raced: the first one written runs, the other steps aside.
  const claims = await prisma.trackerEntry.findMany({ where: { userId, module: RUNS_MODULE, text: runKey }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select });
  if (claims[0] && claims[0].id !== mine.id) {
    await prisma.trackerEntry.deleteMany({ where: { id: mine.id, userId } });
    return { duplicate: true, run: toRun(claims[0]) };
  }

  const today = opts.today ?? toISODate(new Date());
  const steps: RunStep[] = [];
  const undos: Undo[] = [];
  let note: string | null = null;
  let status: RunStatus;
  if (w.condition === "if_due_soon" && !(await dueSoon(userId).catch(() => true))) {
    note = "Rien à rendre dans les deux prochains jours : la condition n'est pas remplie, rien n'a été fait.";
    status = "skipped";
  } else {
    let stopped = false;
    for (const s of w.steps) {
      if (stopped) {
        steps.push({ label: stepLabel(s), status: "skipped", message: "Pas lancée : l'étape précédente a échoué." });
        continue;
      }
      const r = await runStep(userId, s, today);
      steps.push({ label: stepLabel(s), status: r.status, message: r.message });
      undos.push(...r.undos);
      if (r.status === "failed") stopped = true;
    }
    const done = steps.filter((s) => s.status === "done").length;
    const failed = steps.some((s) => s.status === "failed");
    status = !failed ? "done" : done ? "partial" : "failed";
  }
  const finished = { ...base, status, steps, note, undo: undos.length ? ({ t: "many", list: undos } as Undo) : null, finishedAt: new Date().toISOString() };
  const row = await prisma.trackerEntry.update({ where: { id: mine.id }, data: { data: JSON.parse(JSON.stringify(finished)) }, select });
  await pruneRuns(userId);
  return { run: toRun(row) };
}

async function pruneRuns(userId: string) {
  const old = await prisma.trackerEntry.findMany({ where: { userId, module: RUNS_MODULE }, orderBy: { createdAt: "desc" }, skip: KEEP_RUNS, select: { id: true } });
  if (old.length) await prisma.trackerEntry.deleteMany({ where: { userId, id: { in: old.map((o) => o.id) } } });
}

/** Mark a run as taken back, once its changes were reverted. */
export async function markRunUndone(userId: string, runId: string): Promise<Run | null> {
  const row = await prisma.trackerEntry.findFirst({ where: { id: runId, userId, module: RUNS_MODULE }, select: { id: true, text: true, data: true, createdAt: true } });
  if (!row) return null;
  const updated = await prisma.trackerEntry.update({ where: { id: row.id }, data: { data: { ...((row.data as object) ?? {}), undone: true, undo: null } }, select: { id: true, text: true, data: true, createdAt: true } });
  return toRun(updated);
}

/** The morning job: every enabled, authorised workflow due today, once per day each. */
export async function runScheduledWorkflows(now = new Date()) {
  const today = toISODate(now);
  const weekday = dayName(now);
  const rows = await prisma.trackerEntry.findMany({ where: { module: WF_MODULE, kind: "workflow" }, select: { id: true, userId: true, text: true, data: true, createdAt: true } });
  const results: { workflowId: string; status: RunStatus | "duplicate" | "error" }[] = [];
  for (const r of rows) {
    const w = toWorkflow(r);
    if (!dueOn(w, weekday)) continue;
    try {
      const out = await runWorkflow(r.userId, w.id, { trigger: "schedule", key: `day:${today}`, today });
      results.push({ workflowId: w.id, status: "run" in out && out.run && !("duplicate" in out) ? out.run.status : "duplicate" in out ? "duplicate" : "error" });
    } catch {
      results.push({ workflowId: w.id, status: "error" });
    }
  }
  return results;
}
