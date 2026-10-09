/**
 * What a quick-capture sentence asks for. Most sentences add something; a few act on what
 * is already there: "décale la séance de samedi 10h à 11h", "repousse la réunion d'une
 * heure", "supprime le rendez-vous de samedi", "renomme muscu en course à pied".
 * Pure functions: the input previews the intent as you type, the server resolves and runs it.
 */
import { fold, parseCapture, type Parsed } from "@/lib/capture";

export type Intent =
  | { kind: "create" }
  | { kind: "delete"; source: string }
  | { kind: "move"; source: string; target: string | null; shift: number | null }
  | { kind: "rename"; source: string; title: string }
  /** "bilan de la journée", "qu'est-ce que j'ai demain": an answer, not a change. */
  | { kind: "summary"; when: string };

/**
 * Talking to an assistant comes with manners and fillers: "salut, est-ce que tu peux
 * s'il te plaît m'organiser…". They carry no meaning for the agenda, so they go first.
 */
export function politeless(input: string) {
  return input
    .replace(/^\s*(?:(?:salut|bonjour|bonsoir|coucou|hey|hello|ok|okay|dis|jarvis|aurum|orom|alors|bon|euh)\b[\s,!.]*)+/i, "")
    .replace(/^\s*(?:est-ce\s+que\s+|est\s+ce\s+que\s+)?(?:tu\s+peux|peux-tu|peux\s+tu|pourrais-tu|tu\s+pourrais|tu\s+veux\s+bien|j'aimerais\s+que\s+tu|je\s+veux\s+que\s+tu|il\s+faudrait)\s+/i, "")
    .replace(/^\s*(?:s'il\s+te\s+pla[iî]t|stp|svp)[\s,]*/i, "")
    .replace(/[\s,]*(?:s'il\s+te\s+pla[iî]t|stp|svp|merci(?:\s+beaucoup)?)[\s.!?]*$/i, "")
    .replace(/^\s*(?:m'|me\s+)(?=organiser|organise|ajouter|mettre|planifier|programmer|noter|rappeler|donner|faire)/i, "")
    .replace(/^\s*(?:organise[rz]?|organiser)(?:-moi)?\s+/i, "")
    .trim();
}

const SUMMARY = /\b(?:bilan|resume|recap|recapitulatif|qu'est[- ]ce\s+que\s+j'ai|qu'est[- ]ce\s+qu'il\s+y\s+a|qu'ai[- ]je|quoi\s+de\s+prevu|mon\s+programme|mon\s+planning|ce\s+que\s+j'ai\s+(?:fait|a\s+faire)|ce\s+qu'on\s+a\s+fait|ma\s+journee\s+de)\b/;

const DELETE = /^\s*(?:supprimer?|supprimez|efface[rz]?|annule[rz]?|enleve[rz]?|retire[rz]?)\b\s*/;
const MOVE = /^\s*(?:decale[rz]?|deplace[rz]?|repousse[rz]?|reporte[rz]?|avance[rz]?|bouge[rz]?|change[rz]?|modifie[rz]?|recule[rz]?)\b\s*/;
const RENAME = /^\s*(?:renomme[rz]?|appelle|change[rz]?|modifie[rz]?)\s+(.+?)\s+en\s+(.+)$/;
const EARLIER = /^\s*(?:avance[rz]?|recule[rz]?)\b/;

/**
 * Saying it is off is a delete too: "je ne vais plus appeler mon père", "je fais plus de
 * sport", "pas de muscu demain", "laisse tomber le dentiste". Spoken French drops the "ne".
 */
const NEGATIVE = [
  /^\s*(?:je\s+|on\s+)?(?:ne\s+|n')?(?:vais|vai|veux|fais|fait|ferai|peux|irai|vas|va|compte|dois)\s+(?:plus|pas|jamais)\s+(?:faire\s+|aller\s+(?:a|au|aux|chez)\s+)?(?:de\s+|du\s+|d'|des\s+|la\s+|le\s+|a\s+|au\s+)?(.+)$/,
  /^\s*(?:je\s+)?n'?(?:ai|aurai)\s+plus\s+(?:de\s+|d')?(.+)$/,
  /^\s*(?:plus|pas)\s+(?:de\s+|d')(.+)$/,
  /^\s*(?:laisse[rz]?\s+tomber|oublie[rz]?|zappe[rz]?|retire[rz]?\s+moi)\s+(.+)$/,
];

/** Words that open a new thing to add, so a clause after a delete is not read as one more delete. */
const CREATE_VERB = /^\s*(?:ajoute[rz]?|mets|mettre|met|note[rz]?|programme[rz]?|planifie[rz]?|prevois|cree[rz]?|rajoute[rz]?|rappelle-moi)\b/;

/**
 * One sentence, several orders: "je ne vais plus appeler mon père et je ne fais plus de
 * sport", "supprime muscu, décale la réunion à 11h et ajoute dentiste mardi 9h". Split on
 * "et", "puis", "ni", commas — but only when at least one part is an order on the agenda,
 * so "courses et ménage samedi" stays a single to-do.
 */
export function splitCommands(input: string): string[] {
  input = politeless(input);
  const parts = input
    .split(/\s*[,;]\s*(?:et\s+puis|et|puis|ensuite)?\s*|\s+(?:et\s+puis|et|puis|ni|ensuite|aussi)\s+/i)
    .map((p) => politeless(p))
    .filter(Boolean);
  if (parts.length < 2) return [input.trim()];
  const kinds = parts.map((p) => parseIntent(p).kind);
  return kinds.some((k) => k !== "create") ? parts : [input.trim()];
}

/** A part with no verb of its own after a delete ("supprime muscu et le dentiste") is a delete too. */
export function intentsOf(parts: string[]): Intent[] {
  const out: Intent[] = [];
  for (const p of parts) {
    let i = parseIntent(p);
    const prev = out[out.length - 1];
    if (i.kind === "create" && prev?.kind === "delete" && !CREATE_VERB.test(fold(p))) i = { kind: "delete", source: fold(p) };
    out.push(i);
  }
  return out;
}

const UNIT_MIN: Record<string, number> = { h: 60, heure: 60, heures: 60, min: 1, mins: 1, minute: 1, minutes: 1 };

export function parseIntent(input: string): Intent {
  // Folding keeps the length of precomposed text, so a match on `f` slices `raw` too.
  const raw = politeless(input.normalize("NFC").replace(/\s+/g, " ").trim());
  const f = fold(raw);

  if (SUMMARY.test(f)) return { kind: "summary", when: f };
  if (DELETE.test(f)) return { kind: "delete", source: f.replace(DELETE, "") };
  for (const re of NEGATIVE) {
    const m = f.match(re);
    if (m) return { kind: "delete", source: m[1] };
  }

  const rename = f.match(RENAME);
  // "change muscu en course à pied" renames; "change muscu à 11h" moves.
  if (rename && !parseCapture(rename[2], "2000-01-01").found.time && !/^\d/.test(rename[2])) {
    const at = f.length - rename[2].length;
    const title = raw.length === f.length ? raw.slice(at) : rename[2];
    return { kind: "rename", source: rename[1], title: title.charAt(0).toUpperCase() + title.slice(1) };
  }

  if (MOVE.test(f)) {
    let body = f.replace(MOVE, "");
    // A shift: "d'une heure", "de 30 min", "de 1h30".
    let shift: number | null = null;
    const sh = body.match(/\s(?:de|d')\s*(\d{1,3}|une?)\s*(h|heures?|min|mins|minutes?)(?:\s*(\d{2}))?(?=\s|$)/);
    if (sh && sh.index !== undefined) {
      const n = /^\d/.test(sh[1]) ? Number(sh[1]) : 1;
      shift = n * UNIT_MIN[sh[2]] + Number(sh[3] ?? 0);
      if (EARLIER.test(f)) shift = -shift;
      body = body.slice(0, sh.index) + body.slice(sh.index + sh[0].length);
    }
    // The target is what follows the last "à / au / vers / pour" that reads as a day or time.
    let target: string | null = null;
    let source = body;
    const joins = [...body.matchAll(/\s(?:a|au|vers|pour|a partir de)\s/g)];
    for (let i = joins.length - 1; i >= 0; i--) {
      const j = joins[i];
      const rest = body.slice(j.index! + j[0].length);
      const p = parseCapture(rest, "2000-01-01");
      if (p.found.day || p.found.time) {
        target = rest;
        source = body.slice(0, j.index);
        break;
      }
    }
    if (target || shift != null) return { kind: "move", source: source.trim(), target, shift };
  }

  return { kind: "create" };
}

/** Filler that names no particular thing: dropped before matching titles. */
const STOP = new Set([
  "le", "la", "les", "l", "de", "du", "des", "d", "un", "une", "mon", "ma", "mes", "ton", "ta", "son", "sa", "ce", "cette", "cet",
  "session", "seance", "rendez-vous", "rendez", "vous", "rdv", "evenement", "truc", "chose", "tache", "activite", "creneau", "bloc",
  "prevu", "prevue", "prevues", "prevus", "qui", "que", "est", "et", "en", "au", "aux", "pour", "avec", "programme", "planifie",
  "j'ai", "jai", "ai", "ont", "sont", "tous", "toutes", "tout", "toute", "deux", "trois", "quatre", "cinq", "six",
  "faire", "aller", "sessions", "seances", "rendez-vous", "evenements", "trucs", "choses", "taches", "activites", "creneaux", "blocs", "moi", "mes",
]);

const COUNT: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };

/** What the source half of a command points at: a day, a time, a section, title words. */
export interface Target {
  /** "les trois séances", "toutes mes réunions": act on every match, or on this many. */
  all: boolean;
  count: number | null;
  day: string | null;
  time: string | null;
  section: { area: string; sub: string } | null;
  words: string[];
}

export function describeSource(source: string, today: string): Target {
  const p: Parsed = parseCapture(source, today);
  const words = fold(p.title)
    .split(/[^a-z0-9'-]+/)
    .map((w) => w.replace(/^[ld]'/, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w));
  const f = ` ${fold(source)} `;
  const n = f.match(/\s(\d{1,2}|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s/);
  return {
    all: /\s(?:les|tous|toutes|mes|ces)\s/.test(f) || !!n,
    count: n ? (/^\d/.test(n[1]) ? Number(n[1]) : COUNT[n[1]]) : null,
    day: p.found.day ? p.day : null,
    time: p.time,
    section: p.found.section ? { area: p.area, sub: p.sub } : null,
    words,
  };
}

/** Score a candidate event or task against what the command named. -1 rules it out. */
export function score(t: Target, c: { title: string; day: string; time: string | null; tag: string | null }): number {
  let s = 0;
  if (t.day) {
    if (c.day !== t.day) return -1;
    s += 3;
  }
  if (t.time) {
    if (c.time !== t.time) return -1;
    s += 4;
  }
  const title = ` ${fold(c.title)} `;
  let hits = 0;
  for (const w of t.words) if (title.includes(w)) hits++;
  s += hits * 3;
  if (t.section && c.tag) {
    const [a, sub] = c.tag.replace(/^Area:/, "").split(":");
    if (a === t.section.area) s += sub === t.section.sub ? 3 : 1;
  }
  // Something has to match: a day, a time, a word or a section.
  return s > 0 ? s : -1;
}

/** "11:00" ± minutes, clamped to the day. */
export function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, Math.max(0, h * 60 + m + minutes));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export const minutesBetween = (a: string, b: string) => {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
};

/**
 * Words that make a sentence a deadline rather than an appointment: "rendre le rapport
 * vendredi 17h" is due at 17:00, it does not occupy 17:00–17:30.
 */
export const isDeadline = (input: string) =>
  /\b(?:rendre|remettre|remise|soumettre|deposer|livrer|deadline|date limite|echeance|a rendre|due)\b/.test(fold(input));
