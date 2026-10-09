"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNavModuleAction } from "@/server/actions/profile.actions";

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
  const set = (key: string, choice: "show" | "hide" | "default") =>
    start(async () => {
      const r = await setNavModuleAction(key, choice);
      if ("error" in r) setError(r.error ?? "Erreur.");
      else {
        setError(null);
        router.refresh();
      }
    });

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--ink-dim)]">Aujourd&apos;hui, Calendrier, Secteurs et Réglages restent toujours dans le menu. Les modules ci-dessous s&apos;ajoutent selon ton profil et tes données.</p>
      <ul className="space-y-2">
        {modules.map((m) => (
          <li key={m.key} className="tile flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--ink)]">{m.label}</p>
              <p className="text-xs text-[var(--ink-dim)]">
                {m.desc} · <span className={m.on ? "text-[#f0cd79]" : ""}>{m.on ? "Affiché" : "Masqué"}</span> — {m.why}
              </p>
            </div>
            {!m.blocked && (
              <button type="button" disabled={pending} onClick={() => set(m.key, m.on ? "hide" : "show")} aria-pressed={m.on} className="mod-chip focus-ring">
                {m.on ? "Masquer" : "Afficher"}
              </button>
            )}
            {m.forced && (
              <button type="button" disabled={pending} onClick={() => set(m.key, "default")} className="text-xs text-[var(--ink-faint)] underline-offset-2 hover:text-[var(--ink)] hover:underline">
                Revenir au réglage du profil
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-xs text-[#ffb3a3]">
          {error}
        </p>
      )}
    </div>
  );
}
