import type { FoundAssessment, FoundSlot, ParsedSyllabus } from "@/lib/syllabus-parse";

const TYPES = ["Exam", "Quiz", "Lab", "Project", "Assignment", "Presentation"] as const;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Read a syllabus with Claude: far better than rules on real course outlines (tables,
 * two columns, English and French mixed). Returns null without a key or on failure, so the
 * rule-based reader takes over.
 */
export async function parseSyllabusWithClaude(text: string, today: string): Promise<ParsedSyllabus | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const tool = {
    name: "syllabus",
    description: "Le contenu structuré du plan de cours.",
    input_schema: {
      type: "object",
      properties: {
        code: { type: ["string", "null"], description: "ex. MCG2530" },
        name: { type: ["string", "null"] },
        professor: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        term: { type: ["string", "null"], description: "ex. Automne 2026" },
        topics: { type: "array", items: { type: "string" }, description: "Chapitres / thèmes du cours dans l'ordre (12 max), courts" },
        assessments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              type: { type: "string", enum: [...TYPES] },
              date: { type: ["string", "null"], description: "AAAA-MM-JJ si connue" },
              time: { type: ["string", "null"], description: "HH:MM 24 h si connue" },
              weight: { type: ["number", "null"], description: "pondération en %" },
            },
            required: ["title", "type"],
          },
        },
        schedule: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "string", enum: DAYS },
              start: { type: "string" },
              end: { type: "string" },
              type: { type: "string", enum: ["Lecture", "Lab", "Tutorial"] },
              room: { type: ["string", "null"] },
            },
            required: ["day", "start", "end", "type"],
          },
        },
      },
      required: ["assessments", "schedule", "topics"],
    },
  };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 2500,
        system: `Tu extrais un plan de cours universitaire. Aujourd'hui : ${today} (sert à deviner l'année). Une évaluation par ligne réelle (pas de doublons, pas de prose). Un examen final sans date reste avec date null. N'invente rien qui n'est pas dans le texte.`,
        tools: [tool],
        tool_choice: { type: "tool", name: "syllabus" },
        messages: [{ role: "user", content: text.slice(0, 30000) }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content: { type: string; input?: Record<string, unknown> }[] };
    const o = data.content.find((c) => c.type === "tool_use")?.input as
      | { code?: string | null; name?: string | null; professor?: string | null; email?: string | null; term?: string | null; topics?: string[]; assessments?: Partial<FoundAssessment>[]; schedule?: Partial<FoundSlot>[] }
      | undefined;
    if (!o) return null;
    const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null);
    return {
      code: o.code?.replace(/\s/g, "").toUpperCase().slice(0, 12) || null,
      name: o.name?.slice(0, 120) || null,
      professor: o.professor?.slice(0, 80) || null,
      email: o.email?.slice(0, 120) || null,
      term: o.term?.slice(0, 40) || null,
      topics: (o.topics ?? []).filter((t) => typeof t === "string").map((t) => t.slice(0, 120)).slice(0, 12),
      assessments: (o.assessments ?? [])
        .filter((a) => typeof a.title === "string" && TYPES.includes(a.type as (typeof TYPES)[number]))
        .slice(0, 60)
        .map((a) => ({ title: a.title!.slice(0, 120), type: a.type as FoundAssessment["type"], date: date(a.date), time: time(a.time), weight: typeof a.weight === "number" ? a.weight : null, line: "" })),
      schedule: (o.schedule ?? [])
        .filter((s) => DAYS.includes(s.day ?? "") && time(s.start) && time(s.end))
        .slice(0, 12)
        .map((s) => ({ day: s.day!, start: s.start!, end: s.end!, type: s.type === "Lab" || s.type === "Tutorial" ? s.type : "Lecture", room: s.room?.slice(0, 30) || null })),
    };
  } catch {
    return null;
  }
}
