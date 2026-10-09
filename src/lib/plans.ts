/**
 * Plans. Free: Jarvis in text, with a modest monthly allowance. Paid: voice, every agent,
 * and a larger allowance. No payment is wired yet: the plan is a setting, and the limits
 * are configurable from the environment so they can be tuned without a release.
 */

import type { Plan } from "@/lib/settings";

export interface PlanLimits {
  /** What Claude may cost for this user in a month, in US dollars. */
  claudeUsd: number;
  /** Characters of premium (ElevenLabs) speech per month; 0 = the device's own voice only. */
  ttsChars: number;
  /** Specialist agents Jarvis may bring in on one request. */
  agentsPerRequest: number;
}

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);

export function planLimits(plan: Plan): PlanLimits {
  return plan === "pro"
    ? { claudeUsd: num(process.env.PLAN_PRO_CLAUDE_USD, 3), ttsChars: num(process.env.PLAN_PRO_TTS_CHARS, 30000), agentsPerRequest: 4 }
    : { claudeUsd: num(process.env.PLAN_FREE_CLAUDE_USD, 0.2), ttsChars: num(process.env.PLAN_FREE_TTS_CHARS, 2000), agentsPerRequest: 2 };
}

/** Price per million tokens (input, output) by model family; cache reads at 0.1×, writes at 1.25×. */
const PRICES: [RegExp, number, number][] = [
  [/haiku-5/, 0.1, 0.5],
  [/haiku-4/, 1, 5],
  [/sonnet-5/, 2, 10],
  [/sonnet-4/, 3, 15],
  [/opus-5-5/, 4, 20],
  [/opus/, 5, 25],
  [/fable/, 10, 50],
];

export function claudeCostUsd(u: { model: string; input: number; output: number; cacheRead: number; cacheWrite: number }): number {
  const [, inP, outP] = PRICES.find(([re]) => re.test(u.model)) ?? [null, 2, 10];
  return (u.input * inP + u.cacheRead * inP * 0.1 + u.cacheWrite * inP * 1.25 + u.output * outP) / 1_000_000;
}

/** Roughly how many characters a minute of speech is, to talk about voice in minutes. */
export const CHARS_PER_MINUTE = 900;
