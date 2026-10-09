/**
 * Finding the passages of the user's documents that answer a question. Plain lexical
 * scoring (TF-IDF over ~800-character passages), computed on the fly over one user's
 * documents: no vector database, no embedding provider, no data leaving the server to be
 * indexed. Good enough for a person's syllabi, notes and reports; every passage keeps
 * the document and page it came from so answers can cite them.
 */

export interface Passage {
  /** "D1", "D2"… stable within one search, used for citations. */
  ref: string;
  docId: string;
  docName: string;
  /** 1-based page, or null for formats without pages. */
  page: number | null;
  text: string;
  score: number;
}

export interface SearchableDoc {
  id: string;
  name: string;
  /** Text per page (one entry when the format has no pages). */
  pages: string[];
  paged: boolean;
}

const STOP = new Set(
  "les des une un le la de du et en au aux pour par sur dans que qui quoi est sont avec sans mon ma mes ton ta tes son sa ses nos vos leur leurs ce cette ces il elle ils elles on nous vous je tu pas plus moins tout tous toute toutes the and for with that this from what which are was were have has had will would can could should about into your their there then than when where how why who".split(" ")
);

export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function terms(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    // Crude stemming: plural "s" and "x" off, so "examens" finds "examen".
    .map((w) => (w.length > 4 ? w.replace(/[sx]$/, "") : w));
}

const PASSAGE = 800;

/** Cut a page into passages on paragraph boundaries, about PASSAGE characters each. */
export function passagesOf(text: string): string[] {
  const paras = text.split(/\n\s*\n|\n(?=\S)/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > PASSAGE) {
      out.push(cur);
      cur = "";
    }
    if (p.length > PASSAGE * 1.5) {
      for (let i = 0; i < p.length; i += PASSAGE) out.push(p.slice(i, i + PASSAGE));
      continue;
    }
    cur = cur ? `${cur} ${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

/** The best passages for a query, best first. Empty when nothing matches at all. */
export function search(docs: SearchableDoc[], query: string, limit = 6): Passage[] {
  const q = [...new Set(terms(query))];
  if (!q.length) return [];
  const chunks = docs.flatMap((d) => d.pages.flatMap((page, i) => passagesOf(page).map((text) => ({ d, page: d.paged ? i + 1 : null, text, words: terms(text) }))));
  if (!chunks.length) return [];
  const df = new Map<string, number>();
  for (const c of chunks) for (const w of new Set(c.words)) df.set(w, (df.get(w) ?? 0) + 1);
  const scored = chunks
    .map((c) => {
      const tf = new Map<string, number>();
      for (const w of c.words) tf.set(w, (tf.get(w) ?? 0) + 1);
      let score = 0;
      let matched = 0;
      for (const w of q) {
        const f = tf.get(w);
        if (!f) continue;
        matched++;
        score += (1 + Math.log(f)) * Math.log(1 + chunks.length / (df.get(w) ?? 1));
      }
      // Passages that contain more of the question's words rank higher.
      return { c, score: score * (matched / q.length) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x, i) => ({ ref: `D${i + 1}`, docId: x.c.d.id, docName: x.c.d.name, page: x.c.page, text: x.c.text, score: Math.round(x.score * 100) / 100 }));
}

/** Where a passage comes from, as shown to the user. */
export const sourceLabel = (p: Pick<Passage, "docName" | "page">) => `${p.docName}${p.page ? `, p. ${p.page}` : ""}`;

/** Lines that read like something to do, for documents without the assistant. */
export function actionLines(text: string, limit = 12): string[] {
  const re = /\b(a faire|todo|to-do|action|doit|devra|devront|il faut|must|should|deadline|echeance|date limite|remettre|rendre|envoyer|preparer|verifier|relancer|planifier|organiser|before|avant le)\b/;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\n|(?<=[.!?])\s+/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 12 || line.length > 220) continue;
    const f = fold(line);
    if (!re.test(f) || seen.has(f)) continue;
    seen.add(f);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

/** The first sentences of a text: an honest summary when no model is available. */
export function leadSummary(text: string, max = 600): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const sentences = flat.match(/[^.!?]+[.!?]+/g) ?? [flat];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > max) break;
    out += s;
  }
  return (out || flat.slice(0, max)).trim();
}
