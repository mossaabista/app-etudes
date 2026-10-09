"use client";

import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/config";

/** Ask the global assistant from anywhere: open it with a sentence, and run it. */
export function ask(text: string, run = true) {
  window.dispatchEvent(new CustomEvent("aurum:ask", { detail: { text, run } }));
}

/**
 * The assistant, at the top of a section: ask in words, or tap a suggestion. It knows
 * which section it is in, so "ajoute une séance demain 18h" lands here.
 */
export function SectionAssistant({ section, label }: { section: string; label: string }) {
  const { t } = useI18n();
  const a = t.modulesB.ask;
  const [text, setText] = useState("");
  // What people ask for in each section — tapping one runs it.
  const chips = (a.suggestions as Record<string, readonly string[]>)[section] ?? [fmt(a.genericAdd, { label }), fmt(a.genericWhat, { label })];
  return (
    <section className="section-ask glass-card mb-4 p-3.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          ask(text.trim());
          setText("");
        }}
        className="flex items-center gap-2.5"
      >
        <Sparkles size={16} className="ml-1 shrink-0 text-[#f0cd79]" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={fmt(a.placeholder, { label })}
          aria-label={fmt(a.aria, { label })}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("aurum:listen"))} aria-label={a.dictate} className="qc-mic-inline focus-ring h-8 w-8">
          <Mic size={15} />
        </button>
      </form>
      <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => ask(c)} className="mod-chip focus-ring shrink-0 text-xs">
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
