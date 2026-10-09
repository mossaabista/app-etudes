/**
 * Quick capture: one French sentence ("muscu demain 18h pendant 45 min") becomes a task in
 * the right section, on the right day, and — when it has a time — a slot in the calendar.
 * Pure functions, shared by the input (live preview) and the server action.
 */

export interface Parsed {
  title: string;
  area: string;
  sub: string;
  day: string;
  time: string | null;
  minutes: number;
  priority: "Low" | "Medium" | "High" | "Critical";
  /** Which parts the sentence actually gave, so the preview can show what was understood. */
  found: { day: boolean; time: boolean; minutes: boolean; section: boolean };
}

/** Section keywords, most specific first. Matched on whole words, accents ignored. */
const KEYWORDS: [string, string, string[]][] = [
  ["esprit", "priere", ["priere", "prier", "mosquee", "salat", "jumua", "jumu'a", "tarawih"]],
  ["esprit", "lecture", ["coran", "sourate", "tafsir", "hadith"]],
  ["esprit", "meditation", ["mediter", "meditation", "respiration", "respirer", "coherence cardiaque"]],
  ["esprit", "gratitude", ["gratitude", "reconnaissant"]],
  ["sante", "sport", ["sport", "muscu", "musculation", "salle", "gym", "course a pied", "courir", "jogging", "footing", "foot", "football", "basket", "tennis", "natation", "nager", "piscine", "velo", "yoga", "entrainement", "seance", "cardio", "boxe", "hiit", "crossfit", "pilates", "randonnee", "padel", "badminton"]],
  ["sante", "nutrition", ["manger", "repas", "petit-dej", "petit dejeuner", "cuisiner", "cuisine", "recette", "meal prep", "nutrition", "regime", "proteines", "collation"]],
  ["sante", "sommeil", ["dormir", "sieste", "se coucher", "sommeil", "nuit"]],
  ["sante", "corps", ["medecin", "docteur", "pesee", "peser", "prise de sang", "bilan", "kine", "physio", "osteo", "pharmacie"]],
  ["sante", "hygiene", ["dentiste", "coiffeur", "barbier", "douche", "ongles", "skincare", "brosse a dents"]],
  ["social", "evenements", ["anniversaire", "fete", "mariage", "concert", "evenement", "voyage", "spectacle", "match"]],
  ["social", "famille", ["maman", "papa", "mere", "pere", "parents", "frere", "soeur", "famille", "grand-mere", "grand-pere", "cousin", "cousine", "oncle", "tante", "femme", "mari", "enfants"]],
  ["social", "amis", ["ami", "amie", "amis", "pote", "potes", "copain", "copine", "boire un verre", "cafe avec"]],
  ["quotidien", "courses", ["courses", "epicerie", "supermarche", "marche", "acheter"]],
  ["quotidien", "maison", ["menage", "lessive", "aspirateur", "vaisselle", "ranger", "nettoyer", "poubelle", "poubelles", "reparer", "plombier", "demenagement"]],
  ["quotidien", "finances", ["payer", "facture", "loyer", "banque", "budget", "impots", "virement", "epargne", "abonnement"]],
  ["quotidien", "rendezvous", ["rendez-vous", "rdv", "administration", "prefecture", "passeport", "permis", "notaire", "assurance"]],
  ["equipe", "delegue", ["deleguer", "confier", "demander a"]],
  ["equipe", "reunions", ["point d'equipe", "reunion d'equipe", "1:1", "one-on-one", "retro", "retrospective"]],
  ["travail", "reunions", ["reunion", "meeting", "call", "visio", "zoom", "teams", "entretien"]],
  ["travail", "livrables", ["rendre", "livrer", "livrable", "rapport", "presentation", "deadline", "remettre", "soumettre", "envoyer le"]],
  ["travail", "suivis", ["relancer", "relance", "repondre", "rappeler", "mail", "courriel", "email"]],
  ["apprentissage", "lectures", ["lire", "livre", "chapitre", "roman"]],
  ["apprentissage", "formations", ["formation", "mooc", "certification", "coursera", "udemy", "webinaire"]],
  ["apprentissage", "competences", ["pratiquer", "apprendre", "piano", "guitare", "langue", "anglais", "espagnol", "coder"]],
];

/** Default length of a slot when the sentence does not give one. */
const DEFAULT_MINUTES: Record<string, number> = { "sante:sport": 60, "travail:reunions": 30, "equipe:reunions": 30, "sante:nutrition": 45, "social:amis": 90, "social:evenements": 120 };

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janv", "fevr", "mars", "avr", "mai", "juin", "juil", "aout", "sept", "oct", "nov", "dec"];

export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const pad = (n: number) => String(n).padStart(2, "0");

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  treize: 13, quatorze: 14, quinze: 15, seize: 16, "dix-sept": 17, "dix-huit": 18, "dix-neuf": 19, vingt: 20,
  "vingt-et-une": 21, "vingt-deux": 22, "vingt-trois": 23, trente: 30, quarante: 40, "quarante-cinq": 45, cinquante: 50,
};

/**
 * Dictation writes numbers out ("à dix heures", "pendant une heure et demie"), so number
 * words in front of a unit become digits before parsing. Only there: "appeler une amie"
 * keeps its "une".
 */
function digits(text: string) {
  return text
    .replace(/\b(?:une\s+)?demi-?\s?heure\b/gi, "30 min")
    .replace(/\b(une|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix-sept|dix-huit|dix-neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingt-et-une|vingt-deux|vingt-trois|vingt|trente|quarante-cinq|quarante|cinquante)\s+(heures?|minutes?|min)\b/gi, (_, w: string, unit: string) => `${NUMBER_WORDS[w.toLowerCase()]} ${unit}`)
    .replace(/\b(\d{1,2})\s*(?:h|heures?)\s*et\s+demie?\b/gi, "$1h30")
    .replace(/\b(\d{1,2})\s*(?:h|heures?)\s*et\s+quart\b/gi, "$1h15")
    .replace(/\b(\d{1,2})\s+heures?\s+(\d{2})\b/gi, "$1h$2");
}

export function parseCapture(input: string, today: string): Parsed {
  let rest = ` ${digits(input.trim())} `;
  const f = () => fold(rest);
  const cut = (re: RegExp) => {
    const m = f().match(re);
    if (!m || m.index === undefined) return null;
    rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
    return m;
  };

  // Duration first, so "1h30" after "pendant" is not read as a time of day.
  let minutes: number | null = null;
  let m = cut(/\s(?:pendant|durant|sur)\s+(\d{1,2})\s*h(?:eures?)?\s*(\d{2})?(?=\s)/);
  if (m) minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  if (minutes == null && (m = cut(/\s(?:pendant\s+|durant\s+)?(\d{1,3})\s*(?:min|mins|minutes)(?=\s)/))) minutes = Number(m[1]);
  // A bare "2 heures" is a length, but "à 9 heures" is a time.
  if (minutes == null && (m = cut(/(?<!\b(?:a|vers|des|de|jusqu'a|pour))\s(\d)\s*heures?(?=\s)/))) minutes = Number(m[1]) * 60;

  // Priority, said in words; "pas urgent" before "urgent".
  let priority: Parsed["priority"] = "Medium";
  if (cut(/\s(?:(?:de|en|a)\s+)?(?:(?:basse|faible|petite)\s+priorite|priorite\s+(?:basse|faible))(?=\s)|\spas\s+(?:tres\s+)?(?:urgente?|important(?:e)?|presse)(?=\s)/)) priority = "Low";
  else if (cut(/\s(?:(?:de|en|a)\s+)?(?:priorite\s+(?:critique|maximale|absolue)|tres\s+urgente?|critique)(?=\s)/)) priority = "Critical";
  else if (cut(/\s(?:(?:de|en|a)\s+)?(?:(?:haute|forte|grande)\s+priorite|priorite\s+(?:haute|elevee|forte))(?=\s)|\s(?:urgente?|prioritaire|importante?)(?=\s)/)) priority = "High";

  // Time of day.
  let time: string | null = null;
  if ((m = cut(/\s(?:a|vers|des)?\s*(\d{1,2})\s*(?:h|heures?|:)\s*(\d{2})?(?=\s)/))) {
    const h = Number(m[1]);
    if (h < 24) time = `${pad(h)}:${pad(Number(m[2] ?? 0))}`;
  } else if (cut(/\s(?:a\s+)?midi(?=\s)/)) time = "12:00";
  else if (cut(/\s(?:a\s+)?minuit(?=\s)/)) time = "00:00";
  else if (cut(/\sce\s+soir(?=\s)/)) time = "19:00";
  else if (cut(/\sce\s+matin(?=\s)/)) time = "09:00";
  else if (cut(/\scet\s+(?:apres-midi|aprem)(?=\s)/)) time = "14:00";
  // "à 19h ce soir": the hour is already read, the part of day is just a leftover.
  cut(/\s(?:ce|cet)\s+(?:soir|matin|apres-midi|aprem)(?=\s)/);

  // Day.
  let day: string | null = null;
  if (cut(/\s(?:apres-demain|apres demain)(?=\s)/)) day = addDays(today, 2);
  else if (cut(/\sdemain(?=\s)/)) day = addDays(today, 1);
  else if (cut(/\s(?:aujourd'hui|aujourdhui|auj)(?=\s)/)) day = today;
  else if ((m = cut(/\sdans\s+(\d{1,3})\s*(jours?|semaines?)(?=\s)/))) day = addDays(today, Number(m[1]) * (m[2].startsWith("semaine") ? 7 : 1));
  else if ((m = cut(/\s(?:le\s+)?(\d{1,2})\s*(?:\/|-|\s)\s*(\d{1,2}|janv\w*|fevr?\w*|mars|avr\w*|mai|juin|juil\w*|aout|sept\w*|oct\w*|nov\w*|dec\w*)\.?(?=\s)/))) {
    const dd = Number(m[1]);
    const mm = /^\d/.test(m[2]) ? Number(m[2]) : MONTHS.findIndex((x) => m![2].startsWith(x)) + 1;
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
      let year = Number(today.slice(0, 4));
      if (`${year}-${pad(mm)}-${pad(dd)}` < today) year++;
      day = `${year}-${pad(mm)}-${pad(dd)}`;
    }
  } else {
    for (let i = 0; i < 7 && !day; i++) {
      if (cut(new RegExp(`\\s(?:ce\\s+)?${WEEKDAYS[i]}(?:\\s+prochain)?(?=\\s)`))) {
        const now = new Date(`${today}T12:00:00Z`).getUTCDay();
        day = addDays(today, ((i - now + 7) % 7) || 7);
      }
    }
  }

  // Section from keywords.
  const text = ` ${fold(input)} `;
  let area = "travail";
  let sub = "taches";
  let section = false;
  outer: for (const [a, s, words] of KEYWORDS) {
    for (const w of words) {
      if (new RegExp(`[\\s'(]${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?[\\s,.!?)]`).test(text)) {
        area = a;
        sub = s;
        section = true;
        break outer;
      }
    }
  }

  // Drop the little words the removed date or time leaves dangling ("prière du", "à").
  const title = rest
    .replace(/\s+/g, " ")
    .trim()
    // Spoken lead-ins: "mets-moi", "ajoute", "rappelle-moi de", "je dois", "il faut que je".
    .replace(/^(?:(?:mets|mettez|met|ajoute|ajouter|ajoutez|rajoute|rajouter|rajoutez|note|noter|programme|planifie|prevois|prévois|cree|crée|creer|créer)(?:[-\s]moi)?\s+(?:une|un|le|la|du|des)?\s*|(?:rappelle|rappelez)[-\s]moi\s+(?:de\s+|d'|que\s+(?:je\s+dois\s+|j'ai\s+|il\s+faut\s+que\s+je\s+)?)?|je\s+dois\s+|il\s+faut\s+que\s+je\s+|j'ai\s+)/i, "")
    .replace(/^(?:de|du|le|la|une|un|à|a|et)\s+/i, "")
    // "une tâche (pour) : réserver la salle" — the filler says nothing the task does not.
    .replace(/^(?:(?:une|la)\s+)?(?:t[âa]che|rappel)\s*(?:pour|de)?\s*[:,-]?\s+(?=\S)/i, "")
    .replace(/^(?:pour|de)\s*[:,-]\s*/i, "")
    .replace(/\s+(?:de|du|des|le|la|à|a|au|pour|et|ce|cette)$/i, "")
    .trim();
  const key = `${area}:${sub}`;
  return {
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : input.trim(),
    area,
    sub,
    day: day ?? today,
    time,
    minutes: minutes ?? DEFAULT_MINUTES[key] ?? 30,
    priority,
    found: { day: !!day, time: !!time, minutes: minutes != null, section },
  };
}
