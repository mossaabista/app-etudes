import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({ calls: [] as { beta: boolean; params: Record<string, unknown> }[], replies: [] as unknown[] }));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class RateLimitError extends APIError {}
  const reply = (beta: boolean) => async (params: Record<string, unknown>) => {
    sdk.calls.push({ beta, params });
    const next = sdk.replies.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    messages = { create: reply(false) };
    beta = { messages: { create: reply(true) } };
  }
  return { default: Anthropic };
});

import { callStructured, modelFor } from "@/server/claude";

const msg = (content: unknown[], stop = "end_turn") => ({ model: "m", stop_reason: stop, content, usage: { input_tokens: 10, output_tokens: 5 } });
const tool = { name: "agir", description: "Agir", input_schema: { type: "object" as const, properties: { reply: { type: "string" } } } };
const ask = (tier: "fast" | "smart" = "fast") => callStructured<{ reply: string }>({ tier, feature: "test", system: { stable: "Tu es Jarvis.", dynamic: "Nous sommes lundi." }, messages: [{ role: "user", content: "salut" }], tool });

beforeEach(() => {
  sdk.calls = [];
  sdk.replies = [];
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.JARVIS_MODEL;
  delete process.env.JARVIS_PLANNER_MODEL;
  delete process.env.ASSISTANT_MODEL;
});

describe("Claude client", () => {
  it("uses current models, configurable from the environment", () => {
    expect(modelFor("fast")).toBe("claude-haiku-5-5");
    expect(modelFor("smart")).toBe("claude-sonnet-5-5");
    process.env.JARVIS_PLANNER_MODEL = "claude-opus-5-5";
    expect(modelFor("smart")).toBe("claude-opus-5-5");
  });

  it("never forces the tool (the cause of the 400) and never sends temperature or prefill", async () => {
    sdk.replies.push(msg([{ type: "thinking", thinking: "", signature: "s" }, { type: "tool_use", id: "1", name: "agir", input: { reply: "Fait." } }], "tool_use"));
    expect(await ask()).toEqual({ reply: "Fait." });
    const p = sdk.calls[0].params;
    expect(p.tool_choice).toEqual({ type: "auto" });
    expect(p).not.toHaveProperty("temperature");
    expect((p.messages as { role: string }[]).at(-1)!.role).toBe("user");
    expect(p.model).toBe("claude-haiku-5-5");
    // The stable instructions are cached; the date is not.
    const system = p.system as { text: string; cache_control?: unknown }[];
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(system[0].text).toMatch(/appelant l'outil « agir »/);
    expect(system[1]).toEqual({ type: "text", text: "Nous sommes lundi." });
  });

  it("asks once more when the model answers in text, keeping the history append-only", async () => {
    sdk.replies.push(msg([{ type: "text", text: "Bonjour !" }]));
    sdk.replies.push(msg([{ type: "tool_use", id: "2", name: "agir", input: { reply: "Bonjour" } }], "tool_use"));
    expect(await ask()).toEqual({ reply: "Bonjour" });
    const second = sdk.calls[1].params.messages as { role: string; content: unknown }[];
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[1].content).toEqual([{ type: "text", text: "Bonjour !" }]);
  });

  it("gives up after one retry, and on a refusal or an API error", async () => {
    sdk.replies.push(msg([{ type: "text", text: "a" }]), msg([{ type: "text", text: "b" }]));
    expect(await ask()).toBeNull();
    sdk.replies.push(msg([], "refusal"));
    expect(await ask()).toBeNull();
    sdk.replies.push(new Error("boom"));
    expect(await ask()).toBeNull();
  });

  it("routes Sonnet 5.5 through the server-side fallback", async () => {
    sdk.replies.push(msg([{ type: "tool_use", id: "3", name: "agir", input: { reply: "ok" } }], "tool_use"));
    await ask("smart");
    expect(sdk.calls[0].beta).toBe(true);
    expect(sdk.calls[0].params).toMatchObject({ model: "claude-sonnet-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
  });

  it("does nothing without a key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await ask()).toBeNull();
    expect(sdk.calls).toHaveLength(0);
  });
});
