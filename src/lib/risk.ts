/**
 * How much the assistant may do on its own. Every action it proposes gets a risk level;
 * the user's autonomy mode decides which levels run straight away and which wait for a
 * yes. Pure functions: the server applies them, the settings page explains them.
 */

export type Risk = "none" | "low" | "medium" | "high";
export type AutonomyMode = "prudent" | "equilibre" | "autonome";
/** Kinds of medium-risk work the user can let run without asking, in autonomous mode. */
export type Grant = "plans" | "sectors" | "deletes" | "batches";

export interface Autonomy {
  mode: AutonomyMode;
  grants: Grant[];
}

export const DEFAULT_AUTONOMY: Autonomy = { mode: "equilibre", grants: [] };

export const MODES: { mode: AutonomyMode; label: string; desc: string }[] = [
  { mode: "prudent", label: "Prudent", desc: "Je te montre chaque modification et j'attends ton accord avant de la faire." },
  { mode: "equilibre", label: "Équilibré", desc: "Je fais directement les petites choses claires (ajouter, déplacer, cocher). Je te demande avant un plan, une suppression ou un lot." },
  { mode: "autonome", label: "Autonome", desc: "Je fais aussi sans demander ce que tu m'autorises ci-dessous. Les suppressions en masse demandent toujours ton accord." },
];

export const GRANTS: { grant: Grant; label: string }[] = [
  { grant: "plans", label: "Planifier ma journée ou mes révisions" },
  { grant: "sectors", label: "Créer, masquer ou réorganiser mes secteurs" },
  { grant: "deletes", label: "Supprimer un élément à la fois" },
  { grant: "batches", label: "Faire plusieurs ajouts d'un coup (plus de 5)" },
];

/** What the risk rules need to know about an action. */
export interface RiskInput {
  op: string;
  sections?: unknown[];
}

/** Above this many changes in one request, it is a batch. */
export const BATCH_SIZE = 5;

const READ_ONLY = new Set(["navigate"]);
const MEDIUM: Record<string, Grant> = {
  plan_day: "plans",
  plan_revision: "plans",
  remove_area: "sectors",
  remove_section: "sectors",
  delete: "deletes",
};

export interface RiskVerdict {
  risk: Risk;
  /** Whether to stop and ask before doing anything. */
  confirm: boolean;
  /** Why, in words, for the confirmation panel. */
  reasons: string[];
}

/** Rate one action on its own. */
export function actionRisk(a: RiskInput): { risk: Risk; grant: Grant | null } {
  if (READ_ONLY.has(a.op)) return { risk: "none", grant: null };
  if (MEDIUM[a.op]) return { risk: "medium", grant: MEDIUM[a.op] };
  // A sector created with its sections already inside is a structure, not one folder.
  if (a.op === "add_area" && Array.isArray(a.sections) && a.sections.length > 0) return { risk: "medium", grant: "sectors" };
  return { risk: "low", grant: null };
}

const REASONS: Record<Grant, string> = {
  plans: "Ça ajoute plusieurs blocs à ton calendrier.",
  sectors: "Ça change l'organisation de tes secteurs.",
  deletes: "Ça supprime un élément.",
  batches: "Ça fait beaucoup de changements d'un coup.",
};

/** Rate a whole request and decide, for this user's settings, whether to ask first. */
export function assessRisk(actions: RiskInput[], autonomy: Autonomy = DEFAULT_AUTONOMY): RiskVerdict {
  const rated = actions.map(actionRisk);
  const writes = rated.filter((r) => r.risk !== "none");
  const deletes = actions.filter((a) => a.op === "delete").length;
  const needed = new Set<Grant>(rated.flatMap((r) => (r.risk === "medium" && r.grant ? [r.grant] : [])));
  if (writes.length > BATCH_SIZE) needed.add("batches");

  const reasons: string[] = [];
  // Never on autopilot, whatever the mode: several deletions at once.
  if (deletes > 1) {
    reasons.push(`Ça supprime ${deletes} éléments.`);
    return { risk: "high", confirm: true, reasons };
  }
  const risk: Risk = needed.size ? "medium" : writes.length ? "low" : "none";
  for (const g of needed) reasons.push(REASONS[g]);

  if (!writes.length) return { risk, confirm: false, reasons };
  if (autonomy.mode === "prudent") return { risk, confirm: true, reasons: reasons.length ? reasons : ["Tu as choisi le mode prudent."] };
  if (autonomy.mode === "autonome") {
    const missing = [...needed].filter((g) => !autonomy.grants.includes(g));
    return { risk, confirm: missing.length > 0, reasons: missing.map((g) => REASONS[g]) };
  }
  return { risk, confirm: needed.size > 0, reasons };
}

/** Read stored settings defensively: anything unknown falls back to the default. */
export function sanitizeAutonomy(raw: unknown): Autonomy {
  const r = (raw ?? {}) as { mode?: unknown; grants?: unknown };
  const mode = MODES.some((m) => m.mode === r.mode) ? (r.mode as AutonomyMode) : DEFAULT_AUTONOMY.mode;
  const grants = Array.isArray(r.grants) ? [...new Set(r.grants.filter((g): g is Grant => GRANTS.some((x) => x.grant === g)))] : [];
  return { mode, grants };
}
