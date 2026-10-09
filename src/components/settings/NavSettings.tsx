"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNavModuleAction } from "@/server/actions/profile.actions";
import { useI18n } from "@/i18n/client";
import { settingsUi } from "@/i18n/ns/settingsUi";

type WhyKey = keyof typeof settingsUi.fr.nav.why;
/** `why` arrives in French from the navigation rules; find which reason it is. */
const whyKey = (why: string) => (Object.keys(settingsUi.fr.nav.why) as WhyKey[]).find((k) => settingsUi.fr.nav.why[k] === why);

export interface NavModuleRow {
  key: string;
  label: string;
  desc: string;
  on: boolean;
  why: string;
  /** The user chose this state explicitly. */
  forced: boolean;
  /** It cannot be shown (its sector is missing). */
  blocked: boolean;
}

/** Which optional modules the menu shows, why, and the switch to change it. */
export function NavSettings({ modules }: { modules: NavModuleRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t: all } = useI18n();
  const t = all.settingsUi.nav;
  const label = (m: NavModuleRow) => (all.nav as Record<string, string>)[m.key] ?? m.label;
  const desc = (m: NavModuleRow) => (t.desc as Record<string, string>)[m.key] ?? m.desc;
  const why = (m: NavModuleRow) => {
    const k = whyKey(m.why);
    return k ? t.why[k] : m.why;
  };
  const set = (key: string, choice: "show" | "hide" | "default") =>
    start(async () => {
      const r = await setNavModuleAction(key, choice);
      if ("error" in r) setError(r.error ?? all.settingsUi.error);
      else {
        setError(null);
        router.refresh();
      }
    });

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--ink-dim)]">{t.intro}</p>
      <ul className="space-y-2">
        {modules.map((m) => (
          <li key={m.key} className="tile flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 basis-[13rem]">
              <p className="text-sm font-semibold text-[var(--ink)]">{label(m)}</p>
              <p className="text-xs text-[var(--ink-dim)]">
                {desc(m)} · <span className={m.on ? "text-[#f0cd79]" : ""}>{m.on ? t.shown : t.hidden}</span> — {why(m)}
              </p>
            </div>
            {!m.blocked && (
              <button type="button" disabled={pending} onClick={() => set(m.key, m.on ? "hide" : "show")} aria-pressed={m.on} className="mod-chip focus-ring">
                {m.on ? t.hide : t.show}
              </button>
            )}
            {m.forced && (
              <button type="button" disabled={pending} onClick={() => set(m.key, "default")} className="text-xs text-[var(--ink-faint)] underline-offset-2 hover:text-[var(--ink)] hover:underline">
                {t.reset}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">
          {error}
        </p>
      )}
    </div>
  );
}
