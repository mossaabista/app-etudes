/**
 * Who the app is set up for. A profile picks the Today cards and which student-only
 * sections the navigation shows; everything stays changeable in Settings.
 */

export type ProfileType = "etudiant" | "pro" | "entrepreneur" | "sportif";

/** Cards the Today deck can show. */
export type TodayCard = "journee" | "deadlines" | "afaire" | "perso" | "courses" | "reunions" | "team" | "training" | "nutrition" | "routines";

/** Keys from before the cards were reworked, read as their successors. */
export const LEGACY_CARDS: Record<string, TodayCard> = { agenda: "journee", tasks: "afaire" };

export interface Profile {
  type: ProfileType;
  cards: TodayCard[];
}

export const PROFILES: { type: ProfileType; label: string; pitch: string; cards: TodayCard[]; image: string }[] = [
  {
    type: "etudiant",
    label: "Étudiant",
    pitch: "Tes cours, tes remises et tes examens, importés depuis tes syllabus et rangés tout seuls.",
    cards: ["courses", "journee", "deadlines", "afaire"],
    image: "/widgets/cap.webp",
  },
  {
    type: "pro",
    label: "Professionnel",
    pitch: "Ta journée de travail, tes réunions et tes livrables, avec du temps protégé pour le reste.",
    cards: ["reunions", "journee", "deadlines", "afaire"],
    image: "/widgets/clock.webp",
  },
  {
    type: "entrepreneur",
    label: "Entrepreneur",
    pitch: "Tes priorités, ce que ton équipe a en cours, et ton agenda — sur un seul écran.",
    cards: ["team", "journee", "reunions", "afaire"],
    image: "/widgets/chart.webp",
  },
  {
    type: "sportif",
    label: "Sportif",
    pitch: "Entraînements, nutrition et récupération planifiés autour de ta vie.",
    cards: ["training", "journee", "nutrition", "afaire"],
    image: "/widgets/dumbbells.webp",
  },
];

export const CARDS: { key: TodayCard; label: string; desc: string }[] = [
  { key: "journee", label: "Vue d'ensemble", desc: "Toute la journée en un coup d'œil, dans l'ordre" },
  { key: "courses", label: "Cours", desc: "Uniquement tes cours, labos et DGD du jour" },
  { key: "deadlines", label: "À rendre", desc: "Uniquement les devoirs, quiz, examens et labos à remettre" },
  { key: "afaire", label: "À faire", desc: "Tout ce que tu as à faire : tâches, sport, appels, rendez-vous et blocs du Pilote" },
  { key: "perso", label: "Perso (séparé)", desc: "Sort la vie perso d'« À faire » dans sa propre carte" },
  { key: "reunions", label: "Réunions", desc: "Tes réunions et appels du jour" },
  { key: "team", label: "Équipe", desc: "Ce que ton équipe a en cours" },
  { key: "training", label: "Entraînement", desc: "Séances prévues et faites aujourd'hui" },
  { key: "nutrition", label: "Nutrition", desc: "Eau, repas et objectif calorique du jour" },
  { key: "routines", label: "Routines", desc: "Prières et routine d'hygiène du jour" },
];

export const profileOf = (type: ProfileType) => PROFILES.find((p) => p.type === type) ?? PROFILES[0];

/** Sections only a student needs; hidden from the navigation for the other profiles. */
export const STUDENT_ONLY = ["/courses", "/assessments", "/labs", "/syllabus", "/sync"];
