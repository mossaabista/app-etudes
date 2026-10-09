/**
 * One structured call to the language model, for features that need a model to read or
 * write (document summaries and answers, meal plans). The provider and model live here
 * only, so they can be changed in one place. Returns null when no key is configured or
 * the call fails: every caller has an honest fallback without a model.
 */

const MODEL = process.env.ASSISTANT_MODEL || "claude-haiku-4-5-20251001";

export const llmEnabled = () => !!process.env.ANTHROPIC_API_KEY;

export async function callTool<T extends Record<string, unknown>>(opts: {
  /** For the logs only: which feature made the call. */
  feature: string;
  system: string;
  content: string | object[];
  schema: object;
  description: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<T | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const started = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 1500,
        system: opts.system,
        tools: [{ name: "out", description: opts.description, input_schema: opts.schema }],
        tool_choice: { type: "tool", name: "out" },
        messages: [{ role: "user", content: opts.content }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
    });
    if (!res.ok) {
      console.warn(`[orom:${opts.feature}] modèle indisponible (${res.status})`);
      return null;
    }
    const data = (await res.json()) as { content: { type: string; input?: T }[]; usage?: { input_tokens: number; output_tokens: number } };
    if (data.usage) console.info(`[orom:${opts.feature}] tokens=${data.usage.input_tokens}/${data.usage.output_tokens} ms=${Date.now() - started}`);
    return data.content.find((c) => c.type === "tool_use")?.input ?? null;
  } catch {
    console.warn(`[orom:${opts.feature}] délai dépassé ou erreur réseau`);
    return null;
  }
}
