"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { saveJarvisPrefsAction } from "@/server/actions/settings.actions";
import type { ReplyStyle } from "@/lib/settings";

/** How Jarvis talks: out loud or not, how fast, how much. Saved on the account. */
export function JarvisPrefs({ initial }: { initial: { voice: boolean; rate: number; style: ReplyStyle } }) {
  const { t } = useI18n();
  const s = t.settings;
  const [p, setP] = useState(initial);
  const [, start] = useTransition();
  const save = (next: typeof p) => {
    setP(next);
    start(async () => {
      await saveJarvisPrefsAction(next);
    });
  };
  return (
    <div className="space-y-5">
      <label className="flex items-start justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-[var(--ink)]">{s.jarvisVoice}</span>
          <span className="block text-xs text-[var(--ink-dim)]">{s.jarvisVoiceWhy}</span>
        </span>
        <input type="checkbox" role="switch" checked={p.voice} onChange={(e) => save({ ...p, voice: e.target.checked })} className="mt-1 h-5 w-5 accent-[#e8bf63]" />
      </label>
      <label className="block">
        <span className="flex justify-between text-sm font-medium text-[var(--ink)]">
          {s.rate} <span className="tabular-nums text-[var(--ink-dim)]">{p.rate.toFixed(2)}×</span>
        </span>
        <input type="range" min={0.7} max={1.4} step={0.05} value={p.rate} onChange={(e) => setP({ ...p, rate: Number(e.target.value) })} onPointerUp={() => save(p)} onKeyUp={() => save(p)} className="mt-2 w-full accent-[#e8bf63]" />
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-[var(--ink)]">{s.style}</legend>
        <div className="mt-2 flex gap-1.5">
          {(["short", "detailed"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={p.style === v} data-on={p.style === v || undefined} onClick={() => save({ ...p, style: v })} className="mod-tab focus-ring">
              {v === "short" ? s.styleShort : s.styleDetailed}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-[var(--ink-dim)]">{s.styleWhy}</p>
      </fieldset>
    </div>
  );
}
