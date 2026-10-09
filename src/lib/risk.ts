/**
 * How much the assistant may do on its own. What the user asks for explicitly runs
 * straight away — additions, changes, deletions — and stays undoable from the
 * confirmation. It stops to ask only before work that is large or cannot be taken back:
 * a mass deletion, a request that changes many things at once, a plan spread over all
 * upcoming assessments. Pure functions: the server applies them, the settings page
 * explains them.
 */

export type Risk = "none" | "low" | "medium" | "high";
export type AutonomyMode = "prudent" | "equilibre" | "autonome";
/** Kinds of large work the user can let run without asking, in autonomous mode. */
export type Grant = "plans" | "batches";

export interface Autonomy {
  mode: AutonomyMode;
  grants: Grant[];
}

export const DEFAULT_AUTONOMY: Autonomy = { mode: "equilibre", grants: [] };

/** More deletions than this in one request is a mass deletion: always confirmed. */
export const MASS_DELETE = 10;
/** More changes than this in one request is a batch. */
export const BATCH_SIZE = 10;

export const MODES: { mode: AutonomyMode; label: string; desc: string }[] = [
  { mode: "prudent", label: "Prudent", desc: "Je te montre chaque modification et j'attends ton accord avant de la faire." },
  {
    mode: "equilibre",
    label: "Direct",
    desc: `Je fais tout de suite ce que tu demandes — ajouter, modifier, supprimer — avec un bouton Annuler. Je te demande seulement avant plus de ${BATCH_SIZE} changements d'un coup ou un plan sur toutes tes évaluations.`,
  },
  { mode: "autonome", label: "Autonome", desc: "Comme Direct, et je fais aussi sans demander les gros lots que tu autorises ci-dessous." },
];

export const GRANTS: { grant: Grant; label: string }[] = [
  { grant: "plans", label: "Planifier les révisions de toutes mes évaluations" },
  { grant: "batches", label: `Faire plus de ${BATCH_SIZE} changements d'un coup` },
];

/** What the risk rules need to know about an action. */
export interface RiskInput {
  op: string;
  assessment_ids?: unknown[];
}

const READ_ONLY = new Set(["navigate"]);
/**
 * Operations that cannot be taken back: always confirmed, whatever the mode. None of the
 * assistant's current operations is in this set — each one comes with its undo — but a
 * future one (sending a message, sharing outside the app) must be listed here.
 */
export const IRREVERSIBLE = new Set<string>([]);

export interface RiskVerdict {
  risk: Risk;
  /** Whether to stop and ask before doing anything. */
  confirm: boolean;
  /** Why, in words, for the confirmation panel. */
  reasons: string[];
}

/** A revision plan over every upcoming assessment can fill weeks of calendar. */
const isLargePlan = (a: RiskInput) => a.op === "plan_revision" && !(Array.isArray(a.assessment_ids) && a.assessment_ids.length > 0);

/** Rate a whole request and decide, for this user's settings, whether to ask first. */
export function assessRisk(actions: RiskInput[], autonomy: Autonomy = DEFAULT_AUTONOMY): RiskVerdict {
  const writes = actions.filter((a) => !READ_ONLY.has(a.op));
  const deletes = actions.filter((a) => a.op === "delete").length;
  const irreversible = actions.filter((a) => IRREVERSIBLE.has(a.op));

  // Never on autopilot, whatever the mode.
  if (deletes > MASS_DELETE) return { risk: "high", confirm: true, reasons: [`Ça supprime ${deletes} éléments d'un coup.`] };
  if (irreversible.length) return { risk: "high", confirm: true, reasons: ["Ça ne pourra pas être annulé."] };

  const needed: { grant: Grant; reason: string }[] = [];
  if (actions.some(isLargePlan)) needed.push({ grant: "plans", reason: "Ça planifie des révisions pour toutes tes évaluations à venir." });
  if (writes.length > BATCH_SIZE) needed.push({ grant: "batches", reason: `Ça fait ${writes.length} changements d'un coup.` });

  const risk: Risk = needed.length ? "medium" : writes.length ? "low" : "none";
  if (!writes.length) return { risk, confirm: false, reasons: [] };
  if (autonomy.mode === "prudent") return { risk, confirm: true, reasons: needed.length ? needed.map((n) => n.reason) : ["Tu as choisi le mode prudent."] };
  const missing = autonomy.mode === "autonome" ? needed.filter((n) => !autonomy.grants.includes(n.grant)) : needed;
  return { risk, confirm: missing.length > 0, reasons: missing.map((n) => n.reason) };
}

/** Read stored settings defensively: anything unknown falls back to the default. */
export function sanitizeAutonomy(raw: unknown): Autonomy {
  const r = (raw ?? {}) as { mode?: unknown; grants?: unknown };
  const mode = MODES.some((m) => m.mode === r.mode) ? (r.mode as AutonomyMode) : DEFAULT_AUTONOMY.mode;
  const grants = Array.isArray(r.grants) ? [...new Set(r.grants.filter((g): g is Grant => GRANTS.some((x) => x.grant === g)))] : [];
  return { mode, grants };
}
