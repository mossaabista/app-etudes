import { Sun, CalendarDays, BookOpen, LayoutGrid, Settings, FolderKanban, Dumbbell, AudioLines, type LucideIcon } from "lucide-react";
import type { NavPrefs, ProfileType } from "@/lib/profile";

/**
 * The navigation, declared once. Five places are always there — Aujourd'hui, Assistant,
 * Calendrier, Secteurs, Réglages. The others are modules: shown by default to the roles that need them
 * AND to anyone who already has data in them, so changing role never hides your courses
 * or projects. The user's own choices (show / hide) win over both.
 */

export interface NavModule {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Always shown, cannot be hidden. */
  core?: boolean;
  /** Roles that get this module by default. */
  roles?: ProfileType[];
  /** Shown by default to anyone with data of this kind. */
  data?: "courses" | "projects";
  /** Only meaningful when this sector exists in the user's layout. */
  needsArea?: string;
  /** Pages that belong to this entry, so it stays lit on them. */
  under: string[];
  desc: string;
}

export const NAV_MODULES: NavModule[] = [
  { key: "today", label: "Aujourd'hui", href: "/today", icon: Sun, core: true, under: ["/today"], desc: "Ta journée" },
  { key: "assistant", label: "Assistant", href: "/assistant", icon: AudioLines, core: true, under: ["/assistant"], desc: "Parler à OROM" },
  { key: "calendar", label: "Calendrier", href: "/calendar", icon: CalendarDays, core: true, under: ["/calendar"], desc: "Semaine et mois" },
  {
    key: "courses",
    label: "Cours",
    href: "/courses",
    icon: BookOpen,
    roles: ["etudiant"],
    data: "courses",
    under: ["/courses", "/assessments", "/labs", "/syllabus", "/sync"],
    desc: "Cours, évaluations, labos, syllabus",
  },
  { key: "projects", label: "Projets", href: "/projects", icon: FolderKanban, roles: ["pro", "entrepreneur", "freelance"], data: "projects", under: ["/projects"], desc: "Projets, jalons et équipe" },
  { key: "training", label: "Entraînement", href: "/tasks/sante/sport", icon: Dumbbell, roles: ["sportif"], needsArea: "sante", under: ["/tasks/sante/sport"], desc: "Séances et programme" },
  { key: "sectors", label: "Secteurs", href: "/tasks", icon: LayoutGrid, core: true, under: ["/tasks", "/projects"], desc: "Les domaines de ta vie" },
  { key: "settings", label: "Réglages", href: "/settings", icon: Settings, core: true, under: ["/settings"], desc: "Profil, assistant, données" },
];

export const OPTIONAL_MODULES = NAV_MODULES.filter((m) => !m.core);

export interface NavContext {
  roles: ProfileType[];
  prefs: NavPrefs;
  counts: { courses: number; projects: number };
  areas: string[];
}

/** Whether an optional module shows, and why — for the settings page. */
export function moduleState(m: NavModule, ctx: NavContext): { on: boolean; why: string } {
  if (m.core) return { on: true, why: "Toujours affiché" };
  if (m.needsArea && !ctx.areas.includes(m.needsArea)) return { on: false, why: "Le secteur correspondant n'est pas dans tes secteurs" };
  if (ctx.prefs.hidden.includes(m.key)) return { on: false, why: "Masqué par toi" };
  if (ctx.prefs.shown.includes(m.key)) return { on: true, why: "Affiché par toi" };
  if (m.roles?.some((r) => ctx.roles.includes(r))) return { on: true, why: "Pour ton profil" };
  if (m.data && ctx.counts[m.data] > 0) return { on: true, why: m.data === "courses" ? "Tu as des cours" : "Tu as des projets" };
  return { on: false, why: "Pas utile pour ton profil" };
}

/** The keys of the entries to show, in order. */
export function navKeys(ctx: NavContext): string[] {
  return NAV_MODULES.filter((m) => moduleState(m, ctx).on).map((m) => m.key);
}

export const navByKeys = (keys: string[]) => NAV_MODULES.filter((m) => keys.includes(m.key));

/**
 * Phone tab bar: four entries — today, calendar, the first module, sectors. The assistant
 * is the floating microphone there, and settings sit in the menu.
 */
export function mobileNav(keys: string[]) {
  const items = navByKeys(keys).filter((m) => m.key !== "settings" && m.key !== "assistant");
  if (items.length <= 4) return items;
  const optional = items.filter((m) => !m.core);
  return items.filter((m) => m.core || m === optional[0]);
}

/** The one entry to light for a page: the most specific match among those shown. */
export function activeKey(keys: string[], pathname: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const m of navByKeys(keys))
    for (const h of m.under)
      if ((pathname === h || pathname.startsWith(h + "/")) && (!best || h.length > best.len)) best = { key: m.key, len: h.length };
  return best?.key ?? null;
}
