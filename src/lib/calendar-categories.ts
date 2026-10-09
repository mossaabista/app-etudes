/**
 * What the calendar sorts things into, and which of those each profile sees. A student
 * thinks in classes, quizzes and exams; a founder in meetings, team, deliverables and
 * cash; an athlete in training, food and recovery. Anything outside a profile's list folds
 * into the nearest one it has, so nothing disappears and the legend stays short.
 */
import type { ProfileType } from "@/lib/profile";

export type CalCategory =
  | "cours" | "examen" | "quiz" | "devoir" | "projet" | "lab"
  | "pilote" | "tache" | "perso"
  | "reunion" | "livrable" | "formation" | "equipe" | "finances"
  | "sport" | "nutrition" | "sante";

export interface LegendEntry {
  key: CalCategory;
  label: string;
  color: string;
}

// Muted, distinct hues: in the grid they only colour a thin bar, never a whole chip.
const COLOR: Record<CalCategory, string> = {
  cours: "#7aa7e8",
  examen: "#f07a6a",
  quiz: "#b994e8",
  devoir: "#6cc98f",
  projet: "#f0a35e",
  lab: "#e889b5",
  pilote: "#f0cd79",
  tache: "#b8ad9c",
  perso: "#9fc2c9",
  reunion: "#7aa7e8",
  livrable: "#f0a35e",
  formation: "#b994e8",
  equipe: "#5fc7b8",
  finances: "#e6c55a",
  sport: "#f07a6a",
  nutrition: "#6cc98f",
  sante: "#9fa8f0",
};

const LABEL: Record<CalCategory, string> = {
  cours: "Cours",
  examen: "Examens",
  quiz: "Quiz",
  devoir: "Devoirs",
  projet: "Projets",
  lab: "Labos",
  pilote: "Révisions",
  tache: "Tâches",
  perso: "Perso",
  reunion: "Réunions",
  livrable: "Livrables",
  formation: "Formation",
  equipe: "Équipe",
  finances: "Finances",
  sport: "Entraînements",
  nutrition: "Nutrition",
  sante: "Santé & récup",
};

/** Each profile's categories, in the order its legend shows them. */
const BY_PROFILE: Record<ProfileType, CalCategory[]> = {
  etudiant: ["cours", "examen", "quiz", "devoir", "projet", "lab", "pilote", "tache", "perso"],
  pro: ["reunion", "livrable", "tache", "pilote", "formation", "sport", "perso"],
  entrepreneur: ["reunion", "equipe", "livrable", "finances", "tache", "pilote", "perso"],
  sportif: ["sport", "nutrition", "sante", "pilote", "tache", "perso"],
  freelance: ["reunion", "livrable", "finances", "tache", "pilote", "formation", "perso"],
  personnel: ["perso", "sante", "sport", "finances", "tache", "pilote"],
};

/** Where a category goes when the profile does not list it. */
const FOLD: Partial<Record<CalCategory, CalCategory[]>> = {
  cours: ["formation", "tache"],
  examen: ["formation", "tache"],
  quiz: ["formation", "tache"],
  devoir: ["livrable", "tache"],
  projet: ["livrable", "tache"],
  lab: ["formation", "tache"],
  reunion: ["tache"],
  livrable: ["devoir", "tache"],
  formation: ["tache"],
  equipe: ["reunion", "tache"],
  finances: ["perso"],
  sport: ["perso"],
  nutrition: ["perso"],
  sante: ["perso"],
};

export function categoriesFor(profile: ProfileType) {
  const keys = BY_PROFILE[profile] ?? BY_PROFILE.etudiant;
  const label = (k: CalCategory) => (k === "pilote" && profile !== "etudiant" ? "Focus" : LABEL[k]);
  const legend: LegendEntry[] = keys.map((k) => ({ key: k, label: label(k), color: COLOR[k] }));
  const fold = (c: CalCategory): CalCategory => {
    if (keys.includes(c)) return c;
    return FOLD[c]?.find((x) => keys.includes(x)) ?? "perso";
  };
  return { legend, fold };
}

/** The category of an "area:sub" section (from a task category or an "Area:" event type). */
export function categoryOfSection(area: string, sub: string | undefined): CalCategory {
  switch (area) {
    case "travail":
      return sub === "reunions" ? "reunion" : sub === "livrables" ? "livrable" : "tache";
    case "equipe":
      return sub === "reunions" ? "reunion" : "equipe";
    case "projets":
      return "livrable";
    case "apprentissage":
      return "formation";
    case "sante":
      return sub === "sport" ? "sport" : sub === "nutrition" ? "nutrition" : "sante";
    case "quotidien":
      return sub === "finances" ? "finances" : "perso";
    default:
      return "perso";
  }
}
