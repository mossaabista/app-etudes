import Anthropic from "@anthropic-ai/sdk";

/**
 * Every call Aurum makes to Claude goes through here: one client, the model chosen in one
 * place, and the same safety rules everywhere.
 *
 * - Models: a fast one (Haiku) for routing, specialists and everyday requests, a stronger
 *   one (Sonnet) for complex planning and multi-agent requests. Both come from the
 *   environment (JARVIS_MODEL, JARVIS_PLANNER_MODEL).
 * - No forced tool choice: current Sonnet and Opus models reject `tool_choice: tool/any`
 *   with a 400. The model is told in the prompt to answer with the tool, and is asked once
 *   more if it does not.
 * - No temperature, no prefill (rejected by the 5.5 models); thinking is left adaptive and
 *   its depth set with `effort`; content blocks are read by type, never by position.
 * - The stable part of the instructions is cached, so repeated requests cost less.
 * - The API key never leaves the server and never appears in logs.
 */

export type Tier = "fast" | "smart";

export function modelFor(tier: Tier): string {
  if (tier === "smart") return process.env.JARVIS_PLANNER_MODEL || "claude-sonnet-5-5";
  return process.env.JARVIS_MODEL || process.env.ASSISTANT_MODEL || "claude-haiku-5-5";
}

export const claudeEnabled = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ maxRetries: 1 }));

export interface Usage {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  ms: number;
}

/** Where usage goes (the per-user meter). Never receives content, only counts. */
export type UsageSink = (u: Usage) => void | Promise<void>;

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Anthropic.Tool.InputSchema;
}

export type Effort = "low" | "medium" | "high";

/** Instructions as a stable part (cached) and a per-request part (not cached). */
export interface SystemParts {
  stable: string;
  dynamic?: string;
}

function systemBlocks(system: string | SystemParts): Anthropic.TextBlockParam[] {
  if (typeof system === "string") return [{ type: "text", text: system }];
  const blocks: Anthropic.TextBlockParam[] = [{ type: "text", text: system.stable, cache_control: { type: "ephemeral" } }];
  if (system.dynamic) blocks.push({ type: "text", text: system.dynamic });
  return blocks;
}

/** Sonnet/Opus 5.5 can decline for safety reasons; a server-side fallback answers instead. */
const wantsFallback = (model: string) => /^claude-(sonnet|opus)-5-5$/.test(model);

export interface CreateOpts {
  tier: Tier;
  feature: string;
  system: string | SystemParts;
  messages: Anthropic.MessageParam[];
  tools?: ToolSpec[];
  maxTokens?: number;
  effort?: Effort;
  timeoutMs?: number;
  onUsage?: UsageSink;
}

/** One request to the Messages API. Returns null on any failure (logged without content). */
export async function createMessage(opts: CreateOpts): Promise<Anthropic.Message | null> {
  if (!claudeEnabled()) return null;
  const model = modelFor(opts.tier);
  const started = Date.now();
  const params = {
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system: systemBlocks(opts.system),
    messages: opts.messages,
    ...(opts.tools?.length ? { tools: opts.tools as Anthropic.Tool[], tool_choice: { type: "auto" as const } } : {}),
    output_config: { effort: opts.effort ?? "low" },
  };
  try {
    const response = wantsFallback(model)
      ? ((await getClient().beta.messages.create(
          { ...(params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming), betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" },
          { timeout: opts.timeoutMs ?? 45000 }
        )) as unknown as Anthropic.Message)
      : await getClient().messages.create(params as Anthropic.MessageCreateParamsNonStreaming, { timeout: opts.timeoutMs ?? 45000 });
    const u = response.usage;
    const usage: Usage = {
      model: response.model ?? model,
      input: u.input_tokens,
      output: u.output_tokens,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      ms: Date.now() - started,
    };
    console.info(`[claude:${opts.feature}] ${usage.model} in=${usage.input} cache=${usage.cacheRead}/${usage.cacheWrite} out=${usage.output} ms=${usage.ms} stop=${response.stop_reason}`);
    await opts.onUsage?.(usage);
    if (response.stop_reason === "refusal") return null;
    return response;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.warn(`[claude:${opts.feature}] limite de débit atteinte`);
    else if (error instanceof Anthropic.APIError) console.warn(`[claude:${opts.feature}] erreur ${error.status ?? "réseau"}`);
    else console.warn(`[claude:${opts.feature}] délai dépassé ou erreur réseau`);
    return null;
  }
}

export const textOf = (m: Anthropic.Message) =>
  m.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

export const toolCallsOf = (m: Anthropic.Message) => m.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

/**
 * A structured answer: the model replies by calling `tool`. With automatic tool choice the
 * call is asked for in the instructions, and once more if the first reply skips it.
 */
export async function callStructured<T>(opts: Omit<CreateOpts, "tools"> & { tool: ToolSpec }): Promise<T | null> {
  const ask = `Réponds uniquement en appelant l'outil « ${opts.tool.name} ». / Answer only by calling the "${opts.tool.name}" tool.`;
  const system: SystemParts =
    typeof opts.system === "string" ? { stable: `${opts.system}\n\n${ask}` } : { stable: `${opts.system.stable}\n\n${ask}`, dynamic: opts.system.dynamic };
  const first = await createMessage({ ...opts, system, tools: [opts.tool] });
  if (!first) return null;
  const call = toolCallsOf(first).find((c) => c.name === opts.tool.name);
  if (call) return call.input as T;
  if (first.stop_reason === "max_tokens") return null;
  // Append-only retry: the reply stays in the history, followed by a short reminder.
  const again = await createMessage({
    ...opts,
    system,
    tools: [opts.tool],
    messages: [...opts.messages, { role: "assistant", content: first.content }, { role: "user", content: ask }],
  });
  const retry = again && toolCallsOf(again).find((c) => c.name === opts.tool.name);
  return retry ? (retry.input as T) : null;
}
