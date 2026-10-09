import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE, recognitionError, sanitizeVoicePrefs, spokenSummary } from "@/lib/voice";

describe("voice", () => {
  it("keeps settings within range and falls back on unknown values", () => {
    expect(sanitizeVoicePrefs({})).toEqual(DEFAULT_VOICE);
    expect(sanitizeVoicePrefs({ locale: "xx-XX", rate: 9, voice: "", conversation: true })).toEqual({ ...DEFAULT_VOICE, rate: 1.4, conversation: true });
  });

  it("says why dictation stopped, and nothing when the user aborted", () => {
    expect(recognitionError("not-allowed")).toMatch(/Autorise le micro/);
    expect(recognitionError("no-speech")).toBe("Je n'ai rien entendu.");
    expect(recognitionError("aborted")).toBeNull();
    expect(recognitionError("weird")).toMatch(/interrompue/);
  });

  it("speaks a long answer short and leaves the rest on screen", () => {
    expect(spokenSummary("Court.")).toBe("Court.");
    const long = "Première phrase assez longue pour compter. ".repeat(10);
    const s = spokenSummary(long, 100);
    expect(s.length).toBeLessThan(160);
    expect(s).toMatch(/Le détail est à l'écran\.$/);
  });
});
