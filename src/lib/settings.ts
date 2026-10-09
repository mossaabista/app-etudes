/**
 * A user's own settings: language, time zone, city, whether onboarding is done, how
 * Jarvis talks, which notifications they want, and their plan. Pure: validated here,
 * stored by src/server/settings.ts. Anything unknown falls back to a safe default.
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

export const DEFAULT_TIME_ZONE = "America/Toronto";

export type ReplyStyle = "short" | "detailed";
export type Plan = "free" | "pro";

export interface UserSettings {
  locale: Locale;
  timeZone: string;
  /** For prayer times and weather; never used to locate the user otherwise. */
  city: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  /** When onboarding was finished or skipped; null shows it on the next visit. */
  onboardedAt: string | null;
  jarvis: { voice: boolean; rate: number; style: ReplyStyle };
  notifications: { morning: string | null; evening: string | null; deadlines: boolean; muted: string[] };
  plan: Plan;
  /** A small square photo (data URL, resized in the browser), or null for the initial. */
  avatar: string | null;
  /** What the user told us at onboarding: lets Jarvis and its agents start from the right place. */
  about: About;
}

export interface About {
  university: string | null;
  program: string | null;
  sports: string[];
  level: "beginner" | "intermediate" | "advanced" | null;
  goal: string | null;
  workStart: string | null;
  workEnd: string | null;
  team: boolean | null;
}

export const NO_ABOUT: About = { university: null, program: null, sports: [], level: null, goal: null, workStart: null, workEnd: null, team: null };

export const DEFAULT_SETTINGS: UserSettings = {
  locale: DEFAULT_LOCALE,
  timeZone: DEFAULT_TIME_ZONE,
  city: null,
  country: null,
  lat: null,
  lon: null,
  onboardedAt: null,
  jarvis: { voice: true, rate: 1, style: "short" },
  notifications: { morning: "07:30", evening: null, deadlines: true, muted: [] },
  plan: "free",
  avatar: null,
  about: NO_ABOUT,
};

/** A real IANA zone name the runtime knows ("America/Toronto", "Europe/Paris"). */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);

export function sanitizeSettings(raw: unknown): UserSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const j = (r.jarvis && typeof r.jarvis === "object" ? r.jarvis : {}) as Record<string, unknown>;
  const n = (r.notifications && typeof r.notifications === "object" ? r.notifications : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    locale: isLocale(r.locale) ? r.locale : d.locale,
    timeZone: isTimeZone(r.timeZone) ? r.timeZone : d.timeZone,
    city: str(r.city, 80),
    country: str(r.country, 80),
    lat: num(r.lat, -90, 90),
    lon: num(r.lon, -180, 180),
    onboardedAt: typeof r.onboardedAt === "string" && !Number.isNaN(Date.parse(r.onboardedAt)) ? r.onboardedAt : null,
    jarvis: {
      voice: typeof j.voice === "boolean" ? j.voice : d.jarvis.voice,
      rate: num(j.rate, 0.7, 1.4) ?? d.jarvis.rate,
      style: j.style === "detailed" ? "detailed" : "short",
    },
    notifications: {
      morning: n.morning === null ? null : typeof n.morning === "string" && HHMM.test(n.morning) ? n.morning : d.notifications.morning,
      evening: typeof n.evening === "string" && HHMM.test(n.evening) ? n.evening : null,
      deadlines: typeof n.deadlines === "boolean" ? n.deadlines : d.notifications.deadlines,
      muted: Array.isArray(n.muted) ? [...new Set(n.muted.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)))].slice(0, 40) : [],
    },
    plan: r.plan === "pro" ? "pro" : "free",
    avatar: typeof r.avatar === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.avatar) && r.avatar.length <= 80_000 ? r.avatar : null,
    about: sanitizeAbout(r.about),
  };
}

export function sanitizeAbout(raw: unknown): About {
  const a = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    university: str(a.university, 120),
    program: str(a.program, 120),
    sports: Array.isArray(a.sports) ? [...new Set(a.sports.map((x) => str(x, 40)).filter((x): x is string => !!x))].slice(0, 6) : [],
    level: a.level === "beginner" || a.level === "intermediate" || a.level === "advanced" ? a.level : null,
    goal: str(a.goal, 160),
    workStart: typeof a.workStart === "string" && HHMM.test(a.workStart) ? a.workStart : null,
    workEnd: typeof a.workEnd === "string" && HHMM.test(a.workEnd) ? a.workEnd : null,
    team: typeof a.team === "boolean" ? a.team : null,
  };
}

/** Deep-merge a partial change into settings, then validate the result. */
export function mergeSettings(
  current: UserSettings,
  patch: Partial<Omit<UserSettings, "jarvis" | "notifications" | "about">> & { jarvis?: Partial<UserSettings["jarvis"]>; notifications?: Partial<UserSettings["notifications"]>; about?: Partial<About> }
): UserSettings {
  return sanitizeSettings({
    ...current,
    ...patch,
    jarvis: { ...current.jarvis, ...(patch.jarvis ?? {}) },
    notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
    about: { ...current.about, ...(patch.about ?? {}) },
  });
}
