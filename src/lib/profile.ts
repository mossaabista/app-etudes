/**
 * Who the app is set up for. One account can hold several roles (student and athlete,
 * freelancer and parent…) with one of them active: the active role picks the Today cards,
 * the roles together pick the default sectors and navigation modules. Changing role only
 * changes what is shown; nothing is ever deleted.
 */

export type ProfileType = "etudiant" | "pro" | "entrepreneur" | "sportif" | "freelance" | "personnel";

/** Cards the Today deck can show. */
export type TodayCard = "journee" | "deadlines" | "afaire" | "perso" | "courses" | "reunions" | "team" | "training" | "nutrition" | "routines";

/** Keys from before the cards were reworked, read as their successors. */
export const LEGACY_CARDS: Record<string, TodayCard> = { agenda: "journee", tasks: "afaire" };

/** The user's own navigation choices, applied over what their roles show by default. */
export interface NavPrefs {
  shown: string[];
  hidden: string[];
}

export interface Profile {
  /** The active role. */
  type: ProfileType;
  /** Every role the user holds; always includes the active one. */
  roles: ProfileType[];
  /** The active role's Today cards. */
  cards: TodayCard[];
  /** Cards chosen for each role, so switching back finds them as they were left. */
  cardsByRole: Partial<Record<ProfileType, TodayCard[]>>;
  nav: NavPrefs;
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
  {
    type: "freelance",
    label: "Freelance",
    pitch: "Tes clients, tes livrables et ta facturation, avec du temps protégé pour créer.",
    cards: ["journee", "deadlines", "reunions", "afaire"],
    image: "/widgets/coins.webp",
  },
  {
    type: "personnel",
    label: "Personnel",
    pitch: "Ta maison, ta famille, ta santé et tes rendez-vous, au même endroit.",
    cards: ["journee", "afaire", "perso", "routines"],
    image: "/widgets/house.webp",
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
export const isProfileType = (t: unknown): t is ProfileType => PROFILES.some((p) => p.type === t);

const cleanCards = (cards: unknown): TodayCard[] =>
  [...new Set((Array.isArray(cards) ? cards : []).map((c) => LEGACY_CARDS[c as string] ?? c))].filter((c): c is TodayCard => CARDS.some((x) => x.key === c)).slice(0, 5);
const cleanKeys = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && /^[a-z]{2,20}$/.test(x)))].slice(0, 20);

/**
 * Read a stored profile defensively. Rows from before roles existed ({ type, cards }) read
 * as a single role with those cards.
 */
export function sanitizeProfile(raw: unknown): Profile {
  const r = (raw ?? {}) as { type?: unknown; roles?: unknown; cards?: unknown; cardsByRole?: unknown; nav?: { shown?: unknown; hidden?: unknown } };
  const type: ProfileType = isProfileType(r.type) ? r.type : "etudiant";
  const roles = [...new Set([type, ...(Array.isArray(r.roles) ? r.roles.filter(isProfileType) : [])])];
  const cardsByRole: Partial<Record<ProfileType, TodayCard[]>> = {};
  if (r.cardsByRole && typeof r.cardsByRole === "object")
    for (const [k, v] of Object.entries(r.cardsByRole as Record<string, unknown>)) if (isProfileType(k) && cleanCards(v).length) cardsByRole[k] = cleanCards(v);
  if (!cardsByRole[type] && cleanCards(r.cards).length) cardsByRole[type] = cleanCards(r.cards);
  return {
    type,
    roles,
    cards: cardsByRole[type] ?? profileOf(type).cards,
    cardsByRole,
    nav: { shown: cleanKeys(r.nav?.shown), hidden: cleanKeys(r.nav?.hidden) },
  };
}


