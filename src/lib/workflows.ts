/**
 * Workflows: a name, a trigger, an optional condition and a few steps drawn from a fixed
 * catalogue of things OROM already knows how to do safely. No free code, no model call,
 * no step outside the catalogue: a workflow can only do what the user could ask for by
 * hand, under the same checks. Pure: validated here, run in src/server/workflows.ts.
 */

import { WEEKDAYS, WEEKDAY_FR } from "@/lib/planning-prefs";

export type StepType = "plan_day" | "plan_week" | "plan_workouts" | "create_task" | "groceries_week" | "notify_briefing";

export type Step =
  | { type: "plan_day" }
  | { type: "plan_week" }
  | { type: "plan_workouts"; sessions: number; minutes: number; when: "matin" | "midi" | "soir" | "libre" }
  | { type: "create_task"; title: string; dueInDays: number }
  | { type: "groceries_week" }
  | { type: "notify_briefing" };

export type Trigger = { type: "manual" } | { type: "daily"; days: string[] };

export type Condition = "always" | "if_due_soon";

export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  condition: Condition;
  steps: Step[];
  /** When the user allowed it to run on its own; a daily workflow never runs without it. */
  authorizedAt: string | null;
  createdAt: string;
}

export type WorkflowInput = Omit<Workflow, "id" | "createdAt" | "authorizedAt"> & { authorize?: boolean };

export const MAX_WORKFLOWS = 20;
export const MAX_STEPS = 6;

export const STEP_CATALOG: { type: StepType; label: string; desc: string; large?: boolean }[] = [
  { type: "plan_day", label: "Planifier ma journée", desc: "Place le travail du jour dans tes créneaux libres." },
  { type: "plan_week", label: "Planifier ma semaine", desc: "Remplit la semaine de blocs de travail autour de tes engagements.", large: true },
  { type: "plan_workouts", label: "Réserver mes séances de sport", desc: "Trouve des créneaux libres pour tes séances de la semaine." },
  { type: "create_task", label: "Ajouter une tâche", desc: "Une tâche récurrente, avec une échéance à quelques jours." },
  { type: "groceries_week", label: "Liste de courses de la semaine", desc: "Ajoute les courses de ton menu de la semaine (profil nutrition requis)." },
  { type: "notify_briefing", label: "M'envoyer le résumé du jour", desc: "Une notification avec ta journée (notifications à activer sur l'appareil)." },
];

export const CONDITIONS: { key: Condition; label: string }[] = [
  { key: "always", label: "Toujours" },
  { key: "if_due_soon", label: "Seulement si quelque chose est à rendre dans les 2 jours" },
];

/** Workflows ready to use. */
export const TEMPLATES: { name: string; desc: string; input: Omit<WorkflowInput, "enabled"> }[] = [
  {
    name: "Matin organisé",
    desc: "Chaque matin de semaine : la journée planifiée et son résumé en notification.",
    input: { name: "Matin organisé", trigger: { type: "daily", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }, condition: "always", steps: [{ type: "plan_day" }, { type: "notify_briefing" }] },
  },
  {
    name: "Dimanche de préparation",
    desc: "Le dimanche : la semaine planifiée, trois séances réservées et la liste de courses.",
    input: {
      name: "Dimanche de préparation",
      trigger: { type: "daily", days: ["Sunday"] },
      condition: "always",
      steps: [{ type: "plan_week" }, { type: "plan_workouts", sessions: 3, minutes: 60, when: "libre" }, { type: "groceries_week" }],
    },
  },
  {
    name: "Sprint d'échéances",
    desc: "À la demande : seulement si une remise approche, la journée planifiée pour la tenir.",
    input: { name: "Sprint d'échéances", trigger: { type: "manual" }, condition: "if_due_soon", steps: [{ type: "plan_day" }] },
  },
];

const num = (v: unknown, min: number, max: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d);

function cleanStep(raw: unknown): Step | null {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  switch (s.type) {
    case "plan_day":
    case "plan_week":
    case "groceries_week":
    case "notify_briefing":
      return { type: s.type };
    case "plan_workouts":
      return {
        type: "plan_workouts",
        sessions: num(s.sessions, 1, 7, 3),
        minutes: Math.round(num(s.minutes, 15, 180, 60) / 5) * 5,
        when: (["matin", "midi", "soir", "libre"] as const).includes(s.when as "matin") ? (s.when as "matin") : "libre",
      };
    case "create_task": {
      const title = typeof s.title === "string" ? s.title.replace(/\s+/g, " ").trim().slice(0, 120) : "";
      if (!title) return null;
      return { type: "create_task", title, dueInDays: num(s.dueInDays, 0, 30, 0) };
    }
    default:
      return null;
  }
}

/** A workflow as submitted, made safe, or why it cannot be. */
export function validateWorkflow(raw: unknown): { ok: WorkflowInput } | { error: string } {
  const w = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const name = typeof w.name === "string" ? w.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  if (!name) return { error: "Donne un nom à l'automatisation." };
  const rawSteps = Array.isArray(w.steps) ? w.steps : [];
  if (rawSteps.length > MAX_STEPS) return { error: `${MAX_STEPS} étapes au plus.` };
  const steps = rawSteps.map(cleanStep);
  if (steps.some((s) => !s)) return { error: "Une étape n'est pas reconnue ou est incomplète (une tâche a besoin d'un titre)." };
  if (!steps.length) return { error: "Ajoute au moins une étape." };
  const t = (w.trigger && typeof w.trigger === "object" ? w.trigger : {}) as Record<string, unknown>;
  let trigger: Trigger = { type: "manual" };
  if (t.type === "daily") {
    const days = Array.isArray(t.days) ? [...new Set(t.days.filter((d): d is string => (WEEKDAYS as readonly string[]).includes(d as string)))] : [];
    if (!days.length) return { error: "Choisis au moins un jour pour le déclenchement automatique." };
    trigger = { type: "daily", days: WEEKDAYS.filter((d) => days.includes(d)) };
  }
  const condition: Condition = CONDITIONS.some((c) => c.key === w.condition) ? (w.condition as Condition) : "always";
  return { ok: { name, enabled: w.enabled !== false, trigger, condition, steps: steps as Step[], authorize: w.authorize === true } };
}

/** A scheduled workflow is due on this weekday ("Monday"…), only if enabled and authorised. */
export const dueOn = (w: Workflow, weekday: string) => w.enabled && w.trigger.type === "daily" && !!w.authorizedAt && w.trigger.days.includes(weekday);

/** Whether running it needs an explicit yes first (it changes a lot at once). */
export const needsConfirm = (w: Pick<Workflow, "steps">) => w.steps.some((s) => STEP_CATALOG.find((c) => c.type === s.type)?.large);

export function stepLabel(s: Step): string {
  const base = STEP_CATALOG.find((c) => c.type === s.type)?.label ?? s.type;
  if (s.type === "plan_workouts") return `${base} (${s.sessions} × ${s.minutes} min${s.when !== "libre" ? `, ${s.when}` : ""})`;
  if (s.type === "create_task") return `Ajouter la tâche « ${s.title} », à faire ${s.dueInDays === 0 ? "le jour même" : `sous ${s.dueInDays} j`}`;
  return base;
}

export function triggerLabel(t: Trigger): string {
  if (t.type === "manual") return "À la demande";
  if (t.days.length === 7) return "Chaque matin";
  return `Le matin : ${t.days.map((d) => WEEKDAY_FR[d].toLowerCase()).join(", ")}`;
}
