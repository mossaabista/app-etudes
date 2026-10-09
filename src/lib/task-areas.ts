/**
 * How a sub-section is shown: a black-and-gold render, cut out of its backdrop, made by
 * scripts/widgets (FLUX.1-schnell, then an ISNet matte).
 */
export type Visual = { src: string };

export interface SubArea {
  key: string;
  label: string;
  visual: Visual;
}

export interface Area {
  key: string;
  label: string;
  /** The word struck into the folder front: short enough to read at a glance. */
  front: string;
  /** Colour of the sheet tucked inside the folder. */
  color: string;
  blurb: string;
  subs: SubArea[];
}

const render = (name: string): Visual => ({ src: `/widgets/${name}.webp` });

/**
 * Eight life areas broad enough for a student, an engineer, a founder running a team or
 * an athlete to file everything without the app changing shape for each. A task records
 * where it lives as "area:sub" in Task.category.
 */
export const AREAS: Area[] = [
  {
    key: "travail", label: "Travail", front: "Travail", color: "#3b82f6",
    blurb: "La mission principale",
    subs: [
      { key: "taches", label: "Tâches", visual: render("hourglass") },
      { key: "reunions", label: "Réunions", visual: render("clock") },
      { key: "livrables", label: "Livrables", visual: render("plane") },
      { key: "suivis", label: "Suivis", visual: render("envelope") },
    ],
  },
  {
    key: "equipe", label: "Équipe", front: "Équipe", color: "#14b8a6",
    blurb: "Ce qui dépend des autres",
    subs: [
      { key: "membres", label: "Membres", visual: render("network") },
      { key: "delegue", label: "Délégué", visual: render("arrow") },
      { key: "reunions", label: "Réunions", visual: render("bubbles") },
      { key: "suivi", label: "Suivi", visual: render("chart") },
    ],
  },
  {
    // The keys here are the user's own projects, filled in per request.
    key: "projets", label: "Projets", front: "Projets", color: "#f97316",
    blurb: "Les chantiers de longue haleine",
    subs: [{ key: "general", label: "Général", visual: render("gears") }],
  },
  {
    key: "apprentissage", label: "Apprentissage", front: "Savoir", color: "#8b5cf6",
    blurb: "Progresser au-delà du nécessaire",
    subs: [
      { key: "lectures", label: "Lectures", visual: render("book") },
      { key: "formations", label: "Formations", visual: render("cap") },
      { key: "competences", label: "Compétences", visual: render("trophy") },
    ],
  },
  {
    key: "sante", label: "Santé & forme", front: "Santé", color: "#ef4444",
    blurb: "Corps, sport, nutrition, sommeil",
    subs: [
      { key: "corps", label: "Corps", visual: render("heart") },
      { key: "sport", label: "Sport", visual: render("dumbbells") },
      { key: "nutrition", label: "Nutrition", visual: render("apple") },
      { key: "sommeil", label: "Sommeil", visual: render("moon") },
      { key: "hygiene", label: "Hygiène", visual: render("soap") },
    ],
  },
  {
    key: "esprit", label: "Spiritualité & bien-être", front: "Esprit", color: "#10b981",
    blurb: "Prière, méditation, temps pour soi",
    subs: [
      { key: "priere", label: "Prière", visual: render("beads") },
      { key: "lecture", label: "Lecture", visual: render("openbook") },
      { key: "meditation", label: "Méditation", visual: render("stones") },
      { key: "gratitude", label: "Gratitude", visual: render("sun") },
    ],
  },
  {
    key: "social", label: "Personnel & social", front: "Social", color: "#ec4899",
    blurb: "Famille, amis, événements",
    subs: [
      { key: "famille", label: "Famille", visual: render("family") },
      { key: "amis", label: "Amis", visual: render("rings") },
      { key: "evenements", label: "Événements", visual: render("gift") },
    ],
  },
  {
    key: "quotidien", label: "Quotidien & admin", front: "Quotidien", color: "#eab308",
    blurb: "Courses, maison, finances",
    subs: [
      { key: "courses", label: "Courses", visual: render("cart") },
      { key: "maison", label: "Maison", visual: render("house") },
      { key: "finances", label: "Finances", visual: render("coins") },
      { key: "rendezvous", label: "Rendez-vous", visual: render("calendar") },
    ],
  },
];

export const areaByKey = (key: string) => AREAS.find((a) => a.key === key);

export const PROJECT_VISUAL = render("gears");

export function splitCategory(category: string | null): { area: string; sub: string } | null {
  if (!category) return null;
  const [area, sub] = category.split(":");
  return area && sub && areaByKey(area) ? { area, sub } : null;
}

/** The area an "Area:area:sub" calendar type or an "area:sub" category belongs to. */
export function areaOfTag(tag: string | null | undefined) {
  if (!tag) return null;
  const parts = tag.replace(/^Area:/, "").split(":");
  const area = areaByKey(parts[0]);
  if (!area) return null;
  return { area, sub: area.subs.find((s) => s.key === parts[1]) ?? null };
}
