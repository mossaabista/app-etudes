/**
 * Ready-made workspaces: "crée-moi un espace pour mon semestre / mon projet / mon activité
 * de freelance / mon entraînement". A workspace is not a new kind of object: it is a
 * proportionate set of what the app already has — a sector and its sections, a project
 * with milestones, a few starting tasks — chosen by a versioned template and fitted to the
 * user's real data. Templates never invent courses, clients, meetings or dates: they
 * reuse what exists, point out what is missing, and leave the dates to the user.
 *
 * Pure: the server gathers the facts, builds the plan here, then writes it.
 */
import { LIBRARY, LIBRARY_SUBS, PALETTE, slug, type AreaSpec, type BlockSpec, type Layout, type SubSpec } from "@/lib/layout";

export type TemplateId = "projet" | "semestre" | "freelance" | "entrainement";

export interface WorkspaceTemplate {
  id: TemplateId;
  /** Bumped whenever what the template builds changes, so a result can say what made it. */
  version: number;
  label: string;
  pitch: string;
  /** Whether the user has to name it ("mon projet de site web"). */
  needsName: boolean;
}

export const TEMPLATES: WorkspaceTemplate[] = [
  { id: "projet", version: 1, label: "Projet", pitch: "Un projet avec ses jalons et ses premières tâches.", needsName: true },
  { id: "semestre", version: 1, label: "Semestre", pitch: "Tes cours existants, ce qui leur manque, et un rituel hebdomadaire.", needsName: false },
  { id: "freelance", version: 1, label: "Activité freelance", pitch: "Clients, livrables et facturation, sans rien inventer.", needsName: false },
  { id: "entrainement", version: 1, label: "Entraînement", pitch: "Sport, nutrition, sommeil et un suivi des séances.", needsName: false },
];

export const templateOf = (id: string) => TEMPLATES.find((t) => t.id === id);

/** What the user already has, as far as building a workspace is concerned. */
export interface WorkspaceFacts {
  courses: { id: string; code: string; name: string; hasSyllabus: boolean; hasSchedule: boolean; upcoming: number }[];
  projects: { id: string; title: string }[];
  layout: Layout;
  /** Titles of open tasks, to avoid adding the same one twice. */
  openTasks: string[];
}

export interface PlannedTask {
  title: string;
  /** "area:sub", or "project" for the workspace's project. */
  category: string;
  courseId?: string;
}

export interface WorkspacePlan {
  template: TemplateId;
  version: number;
  title: string;
  /** Why it is built this way, in a few short sentences. */
  why: string[];
  /** What already existed and is used as is. */
  reused: string[];
  /** Sectors to create, or sections to add to an existing sector. */
  areas: { area: AreaSpec; isNew: boolean }[];
  /** A project to create (null when there is none, or it already exists: see projectId). */
  project: { title: string; description: string; milestones: string[] } | null;
  projectId: string | null;
  tasks: PlannedTask[];
  /** What was left out because it is already there. */
  skipped: string[];
  /** Gaps the user should know about. */
  notes: string[];
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Pick a template from a sentence ("organise mon activité de freelance"). */
export function detectTemplate(text: string): TemplateId | null {
  const f = fold(text);
  if (/\b(semestre|session|trimestre|etudes|cours|universit|fac|ecole)\b/.test(f)) return "semestre";
  if (/\b(freelance|freelanc|independant|clients?|auto-?entrepreneur|consultant)\b/.test(f)) return "freelance";
  if (/\b(entrainement|entrainer|sport|musculation|muscu|course a pied|marathon|forme|fitness|coach)\b/.test(f)) return "entrainement";
  if (/\b(projet|project|chantier|lancement|site|application|app)\b/.test(f)) return "projet";
  return null;
}

/** "crée un espace pour mon nouveau projet de site web" → "Site web". */
export function nameFrom(text: string): string {
  const m = /(?:espace|projet|dossier)\s+(?:pour|de|du|sur)?\s*(?:mon|ma|mes|le|la|les|un|une)?\s*(?:nouveau|nouvelle)?\s*(?:projet\s+)?(?:de|d'|du|pour)?\s*(.+)$/i.exec(text.trim());
  const raw = (m?.[1] ?? "").replace(/[.!?]+$/, "").replace(/^(de|d'|du|pour)\s+/i, "").trim();
  if (!raw || /^(projet|nouveau projet|semestre|entrainement|activite)$/i.test(fold(raw))) return "";
  return (raw.charAt(0).toUpperCase() + raw.slice(1)).slice(0, 80);
}

const sub = (key: string, label: string, image: string, intro: string, blocks: BlockSpec[]): SubSpec => ({ key, label, image, custom: { intro, blocks } });
const lib = (id: string, label?: string): SubSpec => {
  const s = LIBRARY_SUBS.find((x) => x.id === id)!;
  return { key: s.key, label: label ?? s.label, image: s.image, lib: s.id };
};

/**
 * Fit the template's sector into the layout: a new sector, or only the sections an
 * existing one lacks. Returns null when there is nothing to add.
 */
function fitArea(layout: Layout, wanted: Omit<AreaSpec, "color"> & { color?: string }, reused: string[], skipped: string[]): { area: AreaSpec; isNew: boolean } | null {
  const existing = layout.areas.find((a) => a.key === wanted.key || slug(a.label) === slug(wanted.label));
  if (!existing) return { area: { ...wanted, color: wanted.color ?? PALETTE[layout.areas.length % PALETTE.length] }, isNew: true };
  reused.push(`le secteur ${existing.label}`);
  const has = (s: SubSpec) => existing.subs.some((x) => x.key === s.key || (s.lib && x.lib === s.lib) || slug(x.label) === slug(s.label));
  const missing = wanted.subs.filter((s) => !has(s));
  for (const s of wanted.subs.filter(has)) skipped.push(`la section ${s.label} (déjà dans ${existing.label})`);
  return missing.length ? { area: { ...existing, subs: missing }, isNew: false } : null;
}

/** Build the plan. `name` is required by templates that need one. */
export function buildWorkspace(id: TemplateId, name: string, facts: WorkspaceFacts): WorkspacePlan | { error: string } {
  const t = templateOf(id);
  if (!t) return { error: "Modèle d'espace inconnu." };
  const title = name.trim().slice(0, 80);
  if (t.needsName && !title) return { error: "Donne un nom à ce projet, par exemple « crée un espace pour mon projet Site web »." };

  const plan: WorkspacePlan = { template: id, version: t.version, title: title || t.label, why: [], reused: [], areas: [], project: null, projectId: null, tasks: [], skipped: [], notes: [] };
  const open = new Set(facts.openTasks.map(fold));
  const task = (title: string, category: string, courseId?: string) => {
    if (open.has(fold(title))) plan.skipped.push(`la tâche « ${title} » (déjà dans tes tâches)`);
    else {
      plan.tasks.push({ title, category, ...(courseId ? { courseId } : {}) });
      open.add(fold(title));
    }
  };
  const area = (wanted: Parameters<typeof fitArea>[1]) => {
    const fitted = fitArea(facts.layout, wanted, plan.reused, plan.skipped);
    if (fitted) plan.areas.push(fitted);
    return fitted?.area.key ?? facts.layout.areas.find((a) => a.key === wanted.key || slug(a.label) === slug(wanted.label))!.key;
  };

  switch (id) {
    case "projet": {
      const same = facts.projects.find((p) => fold(p.title) === fold(title));
      if (same) {
        plan.projectId = same.id;
        plan.reused.push(`le projet « ${same.title} »`);
      } else plan.project = { title, description: `Espace créé avec le modèle Projet (v${t.version}).`, milestones: ["Cadrage : objectif et livrable définis", "Réalisation", "Livraison"] };
      plan.why.push("Un projet suivi par trois jalons simples : cadrer, réaliser, livrer.", "Quatre tâches pour démarrer, sans date : c'est toi qui fixes les échéances.");
      // A project lives under the Projets sector: bring it back if it was removed.
      if (!facts.layout.areas.some((a) => a.key === "projets")) {
        plan.areas.push({ area: LIBRARY.find((a) => a.key === "projets")!, isNew: true });
        plan.why.push("J'ajoute le secteur Projets, où vivent tes projets.");
      }
      for (const x of ["Écrire l'objectif et le livrable final en une phrase", "Découper le travail en étapes", "Fixer la date de fin", "Noter ce qui pourrait bloquer le démarrage"]) task(`${x} — ${title}`, "project");
      break;
    }

    case "semestre": {
      plan.why.push("Tes cours restent dans Cours : je ne duplique pas leurs dossiers.", "Une section Semestre avec un rituel hebdomadaire pour garder la charge sous contrôle.");
      const key = area({
        key: "etudes",
        label: "Études",
        front: "Études",
        blurb: "Le semestre en un coup d'œil",
        subs: [
          sub("semestre", "Semestre", "cap", "Le rituel de la semaine et tes objectifs pour le semestre. Les cours, remises et examens restent dans Cours et le Calendrier.", [
            { type: "recurring", title: "Rituel hebdomadaire", items: [{ label: "Revoir les remises des 7 prochains jours", every: 7 }, { label: "Mettre à jour les notes reçues", every: 7 }, { label: "Planifier les révisions de la semaine", every: 7 }] },
            { type: "list", title: "Questions pour les profs", placeholder: "Une question à poser en cours ou par courriel" },
            { type: "notes", title: "Objectifs du semestre" },
          ]),
        ],
      });
      const home = `${key}:semestre`;
      if (!facts.courses.length) {
        plan.notes.push("Aucun cours enregistré : importe tes syllabus (Cours → Importer) pour que je relie ton semestre à tes vrais cours et échéances.");
        task("Importer les syllabus de mes cours", home);
      } else {
        plan.reused.push(`${facts.courses.length} dossier${facts.courses.length > 1 ? "s" : ""} de cours (${facts.courses.map((c) => c.code).join(", ")})`);
        for (const c of facts.courses) {
          if (!c.hasSyllabus) task(`Importer le syllabus de ${c.code}`, home, c.id);
          if (!c.hasSchedule) task(`Ajouter l'horaire de ${c.code}`, home, c.id);
        }
        const missing = facts.courses.filter((c) => !c.hasSyllabus).length;
        if (missing) plan.notes.push(`${missing} cours sans syllabus importé : leurs échéances ne sont pas encore connues.`);
        const upcoming = facts.courses.reduce((n, c) => n + c.upcoming, 0);
        plan.reused.push(upcoming ? `${upcoming} évaluation${upcoming > 1 ? "s" : ""} à venir, déjà dans ton calendrier` : "aucune évaluation à venir pour l'instant");
      }
      break;
    }

    case "freelance": {
      plan.why.push("Trois sections : tes clients, ce que tu dois livrer, et ce que tu dois facturer.", "Elles commencent vides : je n'invente ni client ni réunion.");
      const key = area({
        key: "activite",
        label: "Activité",
        front: "Activité",
        blurb: "Clients, livrables, facturation",
        subs: [
          sub("clients", "Clients", "network", "Tes clients actifs et les contacts à relancer.", [
            { type: "list", title: "Clients actifs", placeholder: "Nom du client — projet en cours" },
            { type: "list", title: "Contacts à relancer", placeholder: "Qui, et pourquoi" },
          ]),
          lib("travail:livrables"),
          sub("facturation", "Facturation", "coins", "Ce qui reste à facturer et à encaisser.", [
            { type: "list", title: "Factures à envoyer", placeholder: "Client — montant — échéance" },
            { type: "recurring", title: "Régulièrement", items: [{ label: "Relancer les factures impayées", every: 7 }, { label: "Mettre à jour le suivi des revenus", every: 30 }] },
          ]),
        ],
      });
      task("Lister mes clients actifs", `${key}:clients`);
      task("Définir mes tarifs", `${key}:facturation`);
      task("Préparer un modèle de devis", `${key}:facturation`);
      break;
    }

    case "entrainement": {
      plan.why.push("Le sport, la nutrition et le sommeil vont ensemble ; je reprends les sections existantes de Santé.", "Un suivi des séances par semaine, sans objectif imposé : fixe le tien.");
      const key = area({
        key: "sante",
        label: "Santé & forme",
        front: "Santé",
        blurb: "Corps, sport, nutrition, sommeil",
        subs: [
          lib("sante:sport"),
          lib("sante:nutrition"),
          lib("sante:sommeil"),
          sub("programme", "Programme", "trophy", "Ton programme et le nombre de séances faites chaque semaine. Demande à l'assistant de générer un programme dans la section Sport.", [
            { type: "log", title: "Séances de la semaine", unit: "séance", goal: null, period: "week" },
            { type: "notes", title: "Mon objectif" },
          ]),
        ],
      });
      task("Choisir mes jours et heures d'entraînement", `${key}:sport`);
      task("Noter mon point de départ (mesures, niveau)", `${key}:${facts.layout.areas.find((a) => a.key === key)?.subs.some((s) => s.key === "corps") ? "corps" : "sport"}`);
      break;
    }
  }
  return plan;
}

/** Total number of things a plan creates, for the summary. */
export const planSize = (p: WorkspacePlan) => p.areas.reduce((n, a) => n + (a.isNew ? 1 : 0) + a.area.subs.length, 0) + (p.project ? 1 + p.project.milestones.length : 0) + p.tasks.length;
