"use server";

import { callStructured, claudeEnabled, type ToolSpec } from "@/server/claude";
import { getMessages } from "@/i18n/server";
import { requireUser } from "@/server/auth/current-user";

/**
 * Small expert helpers used inside the sections: split a task into steps, draft a meeting
 * agenda, pull the actions out of meeting notes, estimate a meal, build a training
 * programme, file an expense. Each is one short Claude call with a strict JSON shape.
 * Without an API key they say so, and the section keeps working by hand.
 */

type Helper =
  | { kind: "breakdown"; title: string; context?: string }
  | { kind: "agenda"; subject: string; minutes: number; type?: string }
  | { kind: "actions"; notes: string; today: string }
  | { kind: "meal"; text: string }
  | { kind: "program"; goal: string; days: number; level: string; equipment: string; minutes: number }
  | { kind: "categorize"; label: string; categories: string[] };

const SCHEMAS: Record<Helper["kind"], { description: string; schema: object; system: string }> = {
  breakdown: {
    description: "Étapes concrètes",
    system: "Tu découpes une tâche en 3 à 7 étapes concrètes, actionnables, dans l'ordre, chacune faisable en une séance. Estime les minutes de chacune. Français.",
    schema: { type: "object", properties: { steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, minutes: { type: "integer" } }, required: ["title", "minutes"] } } }, required: ["steps"] },
  },
  agenda: {
    description: "Ordre du jour",
    system: "Tu prépares l'ordre du jour d'une réunion : objectif en une phrase, 3 à 6 points avec leur durée qui tient dans le temps imparti, et les décisions attendues. Texte brut en français, une ligne par point, sans markdown.",
    schema: { type: "object", properties: { agenda: { type: "string" } }, required: ["agenda"] },
  },
  actions: {
    description: "Actions extraites",
    system: "Tu extrais des notes de réunion chaque action décidée : quoi (verbe à l'infinitif), qui (si nommé), pour quand (AAAA-MM-JJ, déduit de la date du jour si relatif, sinon null). N'invente rien. Français.",
    schema: {
      type: "object",
      properties: { actions: { type: "array", items: { type: "object", properties: { text: { type: "string" }, owner: { type: ["string", "null"] }, due: { type: ["string", "null"] } }, required: ["text"] } } },
      required: ["actions"],
    },
  },
  meal: {
    description: "Estimation nutritionnelle",
    system: "Tu es nutritionniste. Estime l'énergie et les macronutriments d'un repas décrit en français (portions courantes si non précisées), en t'appuyant sur les tables CIQUAL/USDA. Donne une estimation réaliste, pas un intervalle.",
    schema: {
      type: "object",
      properties: { kcal: { type: "integer" }, protein: { type: "integer" }, carbs: { type: "integer" }, fat: { type: "integer" }, fiber: { type: "integer" }, note: { type: "string", description: "une phrase de conseil ou de précision" } },
      required: ["kcal", "protein", "carbs", "fat"],
    },
  },
  program: {
    description: "Programme d'entraînement",
    system:
      "Tu es préparateur physique certifié. Construis un programme hebdomadaire sûr et progressif adapté à l'objectif, au niveau, au matériel et au temps par séance : une séance par jour d'entraînement, 4 à 7 exercices chacune avec séries, répétitions (ou durée) et repos. Respecte les recommandations ACSM. Français.",
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        sessions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              focus: { type: "string" },
              exercises: { type: "array", items: { type: "object", properties: { name: { type: "string" }, sets: { type: "integer" }, reps: { type: "string" }, rest: { type: "string" } }, required: ["name", "sets", "reps"] } },
            },
            required: ["title", "exercises"],
          },
        },
        advice: { type: "string" },
      },
      required: ["name", "sessions"],
    },
  },
  categorize: {
    description: "Catégorie",
    system: "Tu classes une opération bancaire dans UNE des catégories données (réponds exactement avec l'une d'elles).",
    schema: { type: "object", properties: { category: { type: "string" } }, required: ["category"] },
  },
};

export async function aiHelperAction(input: Helper): Promise<{ error: string } | { result: Record<string, unknown> }> {
  await requireUser();
  const t = await getMessages();
  if (!claudeEnabled()) return { error: t.ai.off };
  const spec = SCHEMAS[input.kind];
  if (!spec) return { error: t.ai.unknown };
  const { kind, ...data } = input;
  const out = await callStructured<Record<string, unknown>>({
    tier: "fast",
    feature: `helper:${kind}`,
    system: { stable: spec.system },
    messages: [{ role: "user", content: JSON.stringify(data).slice(0, 6000) }],
    tool: { name: "out", description: spec.description, input_schema: spec.schema as ToolSpec["input_schema"] },
    maxTokens: (kind === "program" ? 2500 : 800) + 2000,
    timeoutMs: 45000,
  });
  return out ? { result: out } : { error: t.ai.noAnswer };
}
