/**
 * One structured call to the language model, for features that need a model to read or
 * write (document summaries and answers, meal plans). The provider and model live here
 * only, so they can be changed in one place. Returns null when no key is configured or
 * the call fails: every caller has an honest fallback without a model.
 */

import { callStructured, claudeEnabled, type UsageSink } from "@/server/claude";
import type Anthropic from "@anthropic-ai/sdk";

export const llmEnabled = claudeEnabled;

export async function callTool<T extends Record<string, unknown>>(opts: {
  /** For the logs only: which feature made the call. */
  feature: string;
  system: string;
  content: string | Anthropic.ContentBlockParam[];
  schema: object;
  description: string;
  maxTokens?: number;
  timeoutMs?: number;
  onUsage?: UsageSink;
}): Promise<T | null> {
  return callStructured<T>({
    tier: "fast",
    feature: opts.feature,
    system: { stable: opts.system },
    messages: [{ role: "user", content: opts.content }],
    tool: { name: "out", description: opts.description, input_schema: opts.schema as Anthropic.Tool.InputSchema },
    // Room for adaptive thinking on top of the answer itself.
    maxTokens: (opts.maxTokens ?? 1500) + 2000,
    timeoutMs: opts.timeoutMs,
    onUsage: opts.onUsage,
  });
}
