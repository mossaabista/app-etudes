/**
 * What the student checks before a syllabus is imported. Each extracted assessment gets
 * where it was found (page and line), how sure we are, and why not more: a date with no
 * year, no date at all, a date already past, no weight, a line that cannot be found in the
 * document, or an assessment the course already has. Duplicates and items that cannot be
 * traced to the document start unticked; nothing is saved until the student says so.
 *
 * A syllabus is data, never instructions: lines that read like orders to an assistant
 * ("ignore previous instructions…") are reported, and items drawn from them are dropped.
 */
import type { FoundAssessment } from "@/lib/syllabus-parse";

export type Confidence = "high" | "medium" | "low";

export interface ReviewedAssessment extends FoundAssessment {
  /** Where it came from: page (null when the format has no pages) and the line itself. */
  source: { page: number | null; excerpt: string } | null;
  flags: string[];
  confidence: Confidence;
  duplicate: "same" | "other-date" | null;
  /** Ticked for import by default. */
  on: boolean;
}

export interface ReviewInput {
  items: FoundAssessment[];
  /** The document's text, one entry per page (a single entry when it has no pages). */
  pages: string[];
  /** What the chosen course already has. */
  existing: { title: string; date: string | null }[];
  today: string;
}

export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Same assessment as far as a re-import is concerned: case, accents and spacing aside. */
export const titleKey = (title: string) => fold(title).replace(/[^a-z0-9]+/g, " ").trim();

const INJECTION =
  /\b(ignore[sz]?|oublie[sz]?|disregard|forget)\b.{0,40}\b(instructions?|consignes?|regles?|rules|prompt)\b|\b(system prompt|prompt systeme|you are (now )?(an?|the) (ai|assistant)|tu es (maintenant )?un assistant|assistant\s*:|as an ai)\b|\b(supprime|efface|delete|erase)\b.{0,30}\b(toutes?|tous|all|every)\b.{0,30}\b(taches|donnees|evenements|tasks|data|events|files|cours)\b/;

/** Lines of the document that read like instructions to an assistant. */
export function suspiciousLines(pages: string[]): string[] {
  const found: string[] = [];
  for (const page of pages)
    for (const line of page.split(/\n+/)) {
      const l = line.replace(/\s+/g, " ").trim();
      if (l && INJECTION.test(fold(l)) && !found.includes(l)) found.push(l.slice(0, 200));
    }
  return found.slice(0, 10);
}

/** The page holding a line, matched loosely (spacing, case, accents). */
function locate(excerpt: string, pages: string[]): number | null {
  const needle = fold(excerpt).slice(0, 80);
  if (needle.length < 4) return null;
  const i = pages.findIndex((p) => fold(p).includes(needle));
  return i < 0 ? null : i + 1;
}

const frDate = (iso: string) => new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00Z`));

export function reviewAssessments({ items, pages, existing, today }: ReviewInput): ReviewedAssessment[] {
  const byTitle = new Map<string, (string | null)[]>();
  for (const e of existing) byTitle.set(titleKey(e.title), [...(byTitle.get(titleKey(e.title)) ?? []), e.date]);

  return items.map((a) => {
    const flags: string[] = [];
    let low = false;
    let medium = false;

    const excerpt = a.line?.trim() ?? "";
    const page = excerpt ? locate(excerpt, pages) : null;
    const found = !!excerpt && (page != null || pages.some((p) => fold(p).includes(fold(excerpt).slice(0, 80))));
    if (!excerpt || !found) {
      flags.push("Je ne retrouve pas cette ligne dans le document : vérifie qu'elle y figure.");
      low = true;
    }
    if (excerpt && INJECTION.test(fold(excerpt))) {
      flags.push("Tirée d'un passage qui ressemble à une instruction : ignorée par prudence.");
      low = true;
    }

    if (!a.date) {
      flags.push("Pas de date dans le document.");
      medium = true;
    } else {
      if (excerpt && !/\b20\d\d\b/.test(excerpt)) {
        flags.push(`Année déduite (${a.date.slice(0, 4)}) : le document ne la donne pas.`);
        medium = true;
      }
      if (a.date < today) {
        flags.push("Date déjà passée.");
        medium = true;
      }
    }
    if (a.weight == null) flags.push("Pondération inconnue.");

    let duplicate: ReviewedAssessment["duplicate"] = null;
    const dates = byTitle.get(titleKey(a.title));
    if (dates) {
      if (dates.includes(a.date)) {
        duplicate = "same";
        flags.push("Déjà dans ce cours : ne sera pas importée deux fois.");
      } else {
        duplicate = "other-date";
        const other = dates.find(Boolean);
        flags.push(`Déjà dans ce cours${other ? ` au ${frDate(other)}` : " sans date"} : vérifie laquelle est la bonne.`);
        medium = true;
      }
    }

    const confidence: Confidence = low ? "low" : medium ? "medium" : "high";
    return { ...a, source: excerpt ? { page, excerpt: excerpt.slice(0, 200) } : null, flags, confidence, duplicate, on: !low && !duplicate };
  });
}

/** One line for the assessment's notes, so the origin of a date can always be checked. */
export function sourceNote(fileName: string, source: ReviewedAssessment["source"]): string | null {
  if (!source) return null;
  return `Source : ${fileName.slice(0, 80)}${source.page ? `, p. ${source.page}` : ""} — « ${source.excerpt.slice(0, 160)} »`;
}
