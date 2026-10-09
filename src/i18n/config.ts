/** Languages Aurum speaks. French first: it is the language the product was born in. */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
/** Mirrors the user's choice so pages render in it before anything is loaded. */
export const LOCALE_COOKIE = "aurum-lang";

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/** The first supported language in an Accept-Language header, or the default. */
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  for (const part of (header ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

/** "Il reste {n} tâches" + {n: 3} → "Il reste 3 tâches". Unknown names stay as they are. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Speech and date formatting tags for each language. */
export const INTL: Record<Locale, string> = { fr: "fr-CA", en: "en-CA" };
