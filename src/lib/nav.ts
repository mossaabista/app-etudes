import { Sun, CalendarDays, BookOpen, LayoutGrid, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only meaningful for students (courses). */
  student?: boolean;
}

/**
 * Five places, no more. Assessments, labs, the syllabus import and the Brightspace sync
 * live inside Cours; projects are a sector. Their old pages still answer, they are simply
 * reached from where they belong.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Aujourd'hui", href: "/today", icon: Sun },
  { label: "Calendrier", href: "/calendar", icon: CalendarDays },
  { label: "Cours", href: "/courses", icon: BookOpen, student: true },
  { label: "Secteurs", href: "/tasks", icon: LayoutGrid },
  { label: "Réglages", href: "/settings", icon: Settings },
];

/** The navigation for a profile: Cours only for students. */
export function navFor(student: boolean) {
  return NAV_ITEMS.filter((i) => student || !i.student);
}

/** Phone tab bar: four entries. */
export function mobileNavFor(student: boolean) {
  return navFor(student).slice(0, 4);
}

/** Pages that belong to Cours, so the Cours entry stays lit on them. */
export const UNDER_COURSES = ["/courses", "/assessments", "/labs", "/syllabus", "/sync"];
/** Pages that belong to Secteurs. */
export const UNDER_SECTORS = ["/tasks", "/projects"];

/** Whether a nav entry is the current one, counting the pages folded into it. */
export function isActive(href: string, pathname: string) {
  const under = href === "/courses" ? UNDER_COURSES : href === "/tasks" ? UNDER_SECTORS : [href];
  return under.some((h) => pathname === h || pathname.startsWith(h + "/"));
}
