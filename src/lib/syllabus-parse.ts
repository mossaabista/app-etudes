/**
 * Read a syllabus's text and pull out what a student would otherwise type in by hand: the
 * course code and title, each assessment with its type, date and weight, and the weekly
 * timetable. Heuristic, French and English, and always shown for review before anything is
 * saved.
 */

export interface FoundAssessment {
  title: string;
  type: "Exam" | "Quiz" | "Lab" | "Project" | "Assignment" | "Presentation";
  date: string | null;
  time: string | null;
  weight: number | null;
  line: string;
}

export interface FoundSlot {
  day: string;
  start: string;
  end: string;
  type: string;
  room: string | null;
}

export interface ParsedSyllabus {
  code: string | null;
  name: string | null;
  professor: string | null;
  email?: string | null;
  term?: string | null;
  /** Chapters or weekly topics, in order — what a revision plan works through. */
  topics?: string[];
  assessments: FoundAssessment[];
  schedule: FoundSlot[];
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const pad = (n: number) => String(n).padStart(2, "0");

const MONTHS: [RegExp, number][] = [
  [/^(janv|jan)/, 1], [/^(fevr|fev|feb)/, 2], [/^(mars|mar)/, 3], [/^(avr|apr)/, 4], [/^(mai|may)/, 5], [/^(juin|june|jun)/, 6],
  [/^(juil|july|jul)/, 7], [/^(aout|aug)/, 8], [/^(sept|sep)/, 9], [/^(oct)/, 10], [/^(nov)/, 11], [/^(dec)/, 12],
];
const monthOf = (w: string) => MONTHS.find(([re]) => re.test(w))?.[1] ?? null;

// Order matters: a "final project report" is a project, a lone "final" an exam.
const TYPES: [RegExp, FoundAssessment["type"]][] = [
  [/\b(examens?|exams?|mi-?sessions?|midterms?|intras?|tests?)\b/, "Exam"],
  [/\b(quiz|quizz|quizzes|questionnaires?|wooclap)\b/, "Quiz"],
  [/\b(labos?|laboratoires?|labs?|tps?|travaux pratiques|pre-?labs?)\b/, "Lab"],
  [/\b(presentations?|exposes?|oral|pitch|posters?)\b/, "Presentation"],
  [/\b(projets?|projects?|rapports?|reports?|livrables?|deliverables?|design day|journee de conception|capstone)\b/, "Project"],
  [/\b(devoirs?|assignments?|travaux|travail|homeworks?|exercices?|problem sets?)\b/, "Assignment"],
  [/\bfinal\b/, "Exam"],
];

const DAYS: [RegExp, string][] = [
  [/^(lun|mon)/, "Monday"], [/^(mar|tue)/, "Tuesday"], [/^(mer|wed)/, "Wednesday"], [/^(jeu|thu)/, "Thursday"],
  [/^(ven|fri)/, "Friday"], [/^(sam|sat)/, "Saturday"], [/^(dim|sun)/, "Sunday"],
];

/** Year for a month/day: the one that puts it closest to the term (today's date as anchor). */
function yearFor(month: number, day: number, today: string) {
  const y = Number(today.slice(0, 4));
  const candidates = [y - 1, y, y + 1].map((yy) => `${yy}-${pad(month)}-${pad(day)}`);
  const t = new Date(`${today}T12:00:00Z`).getTime();
  // Prefer dates from ~2 months back to ~10 months ahead: one academic year.
  return candidates.sort((a, b) => {
    const da = (new Date(`${a}T12:00:00Z`).getTime() - t) / 86400000;
    const db = (new Date(`${b}T12:00:00Z`).getTime() - t) / 86400000;
    const score = (d: number) => (d < -60 ? 1000 - d : d > 300 ? d : Math.abs(d) / 10);
    return score(da) - score(db);
  })[0];
}

function findDate(f: string, today: string): string | null {
  let m = f.match(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = f.match(/\b(\d{1,2})\s*(?:er)?\s+(janv\w*|fevr?\w*|mars|avr\w*|mai|juin|juil\w*|aout|sept\w*|oct\w*|nov\w*|dec\w*|jan\w*|feb\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*)\.?(?:\s+(20\d\d))?/);
  if (m) {
    const mo = monthOf(m[2]);
    if (mo) return m[3] ? `${m[3]}-${pad(mo)}-${pad(Number(m[1]))}` : yearFor(mo, Number(m[1]), today);
  }
  m = f.match(/\b(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d\d))?\b/);
  if (m) {
    const mo = monthOf(m[1]);
    if (mo) return m[3] ? `${m[3]}-${pad(mo)}-${pad(Number(m[2]))}` : yearFor(mo, Number(m[2]), today);
  }
  m = f.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d\d))?\b/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    if (d <= 31 && mo >= 1 && mo <= 12) return m[3] ? `${m[3]}-${pad(mo)}-${pad(d)}` : yearFor(mo, d, today);
  }
  return null;
}

function findTime(f: string): string | null {
  // "13h", "13 h 30", "13:30", "11:59 pm"; a bare "1 :" (as in "mi-session 1 :") is not a time.
  const m = f.match(/\b(\d{1,2})\s*h\s*(\d{2})?\b(?!\s*%)/) ?? f.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  return h < 24 ? `${pad(h)}:${pad(Number(m[2] ?? 0))}` : null;
}

export function parseSyllabus(text: string, today: string): ParsedSyllabus {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Course code: three or four capitals then four digits ("MCG 2530", "GNG1503B", "CS 101" less likely).
  let code: string | null = null;
  let name: string | null = null;
  for (const l of lines.slice(0, 40)) {
    const m = l.match(/\b([A-Z]{3,4})\s?(\d{3,4})([A-Z])?\b/);
    if (m) {
      code = `${m[1]}${m[2]}`;
      const after = l.slice((m.index ?? 0) + m[0].length).replace(/^[\s:–—-]+/, "").trim();
      if (after.length > 3 && after.length < 90) name = after.replace(/\s*[|·].*$/, "");
      break;
    }
  }
  let professor: string | null = null;
  for (const l of lines.slice(0, 60)) {
    const m = l.match(/(?:[Pp]rofesseure?|[Pp]rof\.|[Ii]nstructor|[Ee]nseignante?|[Cc]hargée? de cours)\s*[:–-]?\s*((?:Dr\.?\s+)?\p{Lu}[\p{L}'-]+(?:\s+\p{Lu}[\p{L}'-]+){1,2})/u);
    if (m) {
      professor = m[1];
      break;
    }
  }

  const assessments: FoundAssessment[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const f = fold(line);
    const type = TYPES.find(([re]) => re.test(f))?.[1];
    if (!type) continue;
    const date = findDate(f, today);
    const w = f.match(/(\d{1,2}(?:[.,]\d)?)\s*%/);
    const weight = w ? Number(w[1].replace(",", ".")) : null;
    // A line with neither a date nor a weight is prose, not an assessment.
    if (!date && weight == null) continue;
    if (line.length > 160) continue;
    const title = line
      // Weekday names: in full, or abbreviated with a dot ("mer."), so "marche" survives.
      .replace(/\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b\s*/gi, "")
      .replace(/\b(?:lun|mar|mer|jeu|ven|sam|dim|mon|tue|wed|thu|fri|sat|sun)\.\s*/gi, "")
      .replace(/\b\d{1,2}\s*(?:er)?\s+(?:janv|févr|fevr|mars|avr|mai|juin|juil|août|aout|sept|oct|nov|déc|dec|jan|feb|apr|may|jun|jul|aug|sep)\w*\.?(?:\s+20\d\d)?/gi, "")
      .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+20\d\d)?/gi, "")
      .replace(/\b20\d\d-\d\d-\d\d\b|\b\d{1,2}\/\d{1,2}(?:\/20\d\d)?\b/g, "")
      .replace(/\(?\d{1,2}(?:[.,]\d)?\s*%\)?/g, "")
      .replace(/\b(?:avant|before|à|at)?\s*\d{1,2}\s*h\s*\d{0,2}\b/gi, "")
      .replace(/\b(?:avant|before|à|at)?\s*\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi, "")
      .replace(/\b(?:due|on|le|pour|remise|à remettre)\b(?=\s*$)/gi, "")
      .replace(/\b(?:due)\b/gi, "")
      .replace(/\(\s*\)/g, "")
      .replace(/(?:\s*,\s*){2,}/g, ", ")
      .replace(/[\s,;:·|–—-]+$/g, "")
      .replace(/^[\s,;:·|–—-]+/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (title.length < 3) continue;
    const key = `${fold(title)}|${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    assessments.push({ title: title.slice(0, 120), type, date, time: date ? findTime(f) : null, weight, line });
  }

  // Timetable: a weekday and a time range on one line ("Lundi 10h00–11h20, MRN 150").
  const schedule: FoundSlot[] = [];
  for (const line of lines) {
    const f = fold(line);
    const r = f.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\s*(?:-|–|—|a|à|to)\s*(\d{1,2})\s*[h:]\s*(\d{2})?\b/);
    if (!r) continue;
    const word = f.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (!word) continue;
    const day = DAYS.find(([re]) => re.test(word[1]))?.[1];
    if (!day) continue;
    const kind = /\b(lab|labo|laboratoire)\b/.test(f) ? "Lab" : /\b(tutoriel|tutorial|dgd|td)\b/.test(f) ? "Tutorial" : "Lecture";
    const room = line.match(/\b([A-Z]{2,4}\s?[A-Z]?\d{2,4})\b/)?.[1] ?? null;
    const slot = { day, start: `${pad(Number(r[1]))}:${pad(Number(r[2] ?? 0))}`, end: `${pad(Number(r[3]))}:${pad(Number(r[4] ?? 0))}`, type: kind, room: room && room !== code ? room : null };
    if (!schedule.some((s) => s.day === slot.day && s.start === slot.start)) schedule.push(slot);
  }

  return { code, name, professor, assessments: assessments.slice(0, 80), schedule: schedule.slice(0, 12) };
}
