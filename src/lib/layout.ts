/**
 * A user's sectors: which folders they have, what is inside, in what order. Every account
 * starts from its profile's ready-made set and can then change anything — add a sector,
 * remove one, rename it, pick sections from the library, or have the assistant build a
 * section that exists nowhere else ("ma guitare", "mes plantes") out of generic blocks.
 */
import { AREAS } from "@/lib/task-areas";
import type { ProfileType } from "@/lib/profile";

/** The building blocks a made-to-measure section is assembled from. */
export type BlockSpec =
  | { type: "checklist"; title: string; items: string[] }
  | { type: "log"; title: string; unit: string; goal?: number | null; period?: "day" | "week" }
  | { type: "list"; title: string; placeholder?: string }
  | { type: "recurring"; title: string; items: { label: string; every: number }[] }
  | { type: "tips"; title: string; items: string[] }
  | { type: "notes"; title: string };

export interface SubSpec {
  key: string;
  label: string;
  /** A render from /widgets, by name ("heart", "dumbbells"). */
  image: string;
  /** A library section ("sante:nutrition"): its page, tools and data, wherever it is filed. */
  lib?: string;
  /** Present on a made-to-measure section; library sections have their own page. */
  custom?: { intro: string; blocks: BlockSpec[] };
}

export interface AreaSpec {
  key: string;
  label: string;
  /** Short word struck into the folder front. */
  front: string;
  color: string;
  blurb: string;
  subs: SubSpec[];
}

export interface Layout {
  areas: AreaSpec[];
}

/** Every render available for a section or a folder. */
export const IMAGES = [
  "apple", "arrow", "beads", "book", "bubbles", "calendar", "cap", "cart", "chart", "clock", "coins", "dumbbells", "envelope", "family",
  "gears", "gift", "heart", "hourglass", "house", "moon", "network", "openbook", "plane", "rings", "soap", "stones", "sun", "trophy",
] as const;

export const PALETTE = ["#3b82f6", "#14b8a6", "#f97316", "#8b5cf6", "#ef4444", "#10b981", "#ec4899", "#eab308", "#06b6d4", "#a855f7", "#84cc16", "#f43f5e"];

const imageOf = (src: string) => src.replace(/^\/widgets\//, "").replace(/\.webp$/, "");

/** The built-in sectors, as layout entries. */
export const LIBRARY: AreaSpec[] = AREAS.map((a) => ({
  key: a.key,
  label: a.label,
  front: a.front,
  color: a.color,
  blurb: a.blurb,
  subs: a.subs.map((s) => ({ key: s.key, label: s.label, image: imageOf(s.visual.src), lib: `${a.key}:${s.key}` })),
}));

const pick = (area: string, subs?: string[]): AreaSpec => {
  const a = LIBRARY.find((x) => x.key === area)!;
  return { ...a, subs: subs ? a.subs.filter((s) => subs.includes(s.key)) : a.subs };
};

/** Ready-made sets: a starting point, never a cage. */
export const DEFAULT_LAYOUT: Record<ProfileType, Layout> = {
  etudiant: { areas: LIBRARY },
  pro: {
    areas: [pick("travail"), pick("equipe"), pick("projets"), pick("apprentissage"), pick("sante"), pick("social"), pick("quotidien")],
  },
  entrepreneur: {
    areas: [pick("travail"), pick("equipe"), pick("projets"), pick("quotidien", ["finances", "rendezvous"]), pick("apprentissage"), pick("sante", ["sport", "sommeil", "nutrition"])],
  },
  sportif: {
    areas: [pick("sante"), pick("quotidien", ["courses", "finances"]), pick("social"), pick("esprit", ["meditation"]), pick("apprentissage", ["lectures"])],
  },
};

/** Library sections by "area:sub", for "ajoute la nutrition" and the picker. */
export const LIBRARY_SUBS = LIBRARY.flatMap((a) => a.subs.map((s) => ({ ...s, area: a.key, areaLabel: a.label, id: `${a.key}:${s.key}` })));
const LIB_IDS = new Set(LIBRARY_SUBS.map((s) => s.id));

export const slug = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "section";

export const imageSrc = (name: string) => `/widgets/${(IMAGES as readonly string[]).includes(name) ? name : "gears"}.webp`;

/** Check a layout read from the database or produced by the assistant. */
export function sanitizeLayout(input: unknown): Layout | null {
  const raw = input as { areas?: unknown };
  if (!raw || !Array.isArray(raw.areas)) return null;
  const areas: AreaSpec[] = [];
  const seen = new Set<string>();
  for (const a of raw.areas.slice(0, 16) as Partial<AreaSpec>[]) {
    if (!a || typeof a.label !== "string" || !a.label.trim()) continue;
    const key = typeof a.key === "string" && a.key ? slug(a.key) : slug(a.label);
    if (seen.has(key)) continue;
    seen.add(key);
    const subs: SubSpec[] = [];
    const subSeen = new Set<string>();
    for (const s of (Array.isArray(a.subs) ? a.subs : []).slice(0, 12) as Partial<SubSpec>[]) {
      if (!s || typeof s.label !== "string" || !s.label.trim()) continue;
      const sk = typeof s.key === "string" && s.key ? slug(s.key) : slug(s.label);
      if (subSeen.has(sk)) continue;
      subSeen.add(sk);
      subs.push({
        key: sk,
        label: s.label.trim().slice(0, 40),
        image: typeof s.image === "string" && (IMAGES as readonly string[]).includes(s.image) ? s.image : "gears",
        ...(typeof s.lib === "string" && LIB_IDS.has(s.lib) ? { lib: s.lib } : s.custom ? { custom: sanitizeCustom(s.custom) } : {}),
      });
    }
    areas.push({
      key,
      label: a.label.trim().slice(0, 40),
      front: (typeof a.front === "string" && a.front.trim() ? a.front : a.label).trim().slice(0, 12),
      color: typeof a.color === "string" && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : PALETTE[areas.length % PALETTE.length],
      blurb: typeof a.blurb === "string" ? a.blurb.slice(0, 80) : "",
      subs,
    });
  }
  return { areas };
}

function sanitizeCustom(c: unknown): { intro: string; blocks: BlockSpec[] } {
  const raw = c as { intro?: unknown; blocks?: unknown };
  const blocks: BlockSpec[] = [];
  for (const b of (Array.isArray(raw?.blocks) ? raw.blocks : []).slice(0, 8) as Record<string, unknown>[]) {
    const title = typeof b?.title === "string" ? b.title.slice(0, 60) : "";
    const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 120)).slice(0, 20) : []);
    switch (b?.type) {
      case "checklist":
        blocks.push({ type: "checklist", title: title || "Chaque jour", items: strings(b.items) });
        break;
      case "log":
        blocks.push({ type: "log", title: title || "Journal", unit: typeof b.unit === "string" ? b.unit.slice(0, 16) : "", goal: typeof b.goal === "number" ? b.goal : null, period: b.period === "week" ? "week" : "day" });
        break;
      case "list":
        blocks.push({ type: "list", title: title || "Liste", placeholder: typeof b.placeholder === "string" ? b.placeholder.slice(0, 60) : undefined });
        break;
      case "recurring":
        blocks.push({
          type: "recurring",
          title: title || "Régulièrement",
          items: (Array.isArray(b.items) ? b.items : [])
            .map((i: { label?: unknown; every?: unknown }) => ({ label: typeof i?.label === "string" ? i.label.slice(0, 60) : "", every: typeof i?.every === "number" ? Math.max(1, Math.min(365, Math.round(i.every))) : 7 }))
            .filter((i: { label: string }) => i.label)
            .slice(0, 12),
        });
        break;
      case "tips":
        blocks.push({ type: "tips", title: title || "Conseils", items: strings(b.items) });
        break;
      case "notes":
        blocks.push({ type: "notes", title: title || "Notes" });
        break;
    }
  }
  return { intro: typeof raw?.intro === "string" ? raw.intro.slice(0, 240) : "", blocks };
}
