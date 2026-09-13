import {
  Sun,
  CalendarDays,
  BookOpen,
  ListChecks,
  FolderKanban,
  ClipboardCheck,
  FlaskConical,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  mobileNav?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/today", icon: Sun, mobileNav: true },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, mobileNav: true },
  { label: "Courses", href: "/courses", icon: BookOpen, mobileNav: true },
  { label: "Tasks", href: "/tasks", icon: ListChecks, mobileNav: true },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Assessments", href: "/assessments", icon: ClipboardCheck },
  { label: "Laboratoire", href: "/labs", icon: FlaskConical },
  { label: "Syllabus", href: "/syllabus", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];
