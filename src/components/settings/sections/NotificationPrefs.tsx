"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import { saveNotificationPrefsAction } from "@/server/actions/settings.actions";

type Prefs = { morning: string | null; evening: string | null; deadlines: boolean; muted: string[] };

/** When Jarvis may notify: the two briefings, deadline reminders, and areas muted one by one. */
export function NotificationPrefs({ initial, areas }: { initial: Prefs; areas: { key: string; label: string }[] }) {
  const { t } = useI18n();
  const s = t.settings;
  const [p, setP] = useState(initial);
  const [, start] = useTransition();
  const save = (next: Prefs) => {
    setP(next);
    start(async () => {
      await saveNotificationPrefsAction(next);
    });
  };
  const time = (key: "morning" | "evening", title: string, fallback: string) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-medium text-[var(--ink)]">{title}</span>
      <span className="flex items-center gap-2">
        <input type="checkbox" role="switch" aria-label={title} checked={p[key] !== null} onChange={(e) => save({ ...p, [key]: e.target.checked ? fallback : null })} className="h-5 w-5 accent-[#e8bf63]" />
        {p[key] !== null ? (
          <input type="time" value={p[key] ?? fallback} aria-label={title} onChange={(e) => e.target.value && save({ ...p, [key]: e.target.value })} className="glass-pill focus-ring px-3 py-1.5 text-sm text-[var(--ink)]" />
        ) : (
          <span className="text-xs text-[var(--ink-faint)]">{s.off}</span>
        )}
      </span>
    </div>
  );
  return (
    <div className="space-y-4">
      {time("morning", s.morning, "07:30")}
      {time("evening", s.evening, "21:00")}
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--ink)]">{s.deadlines}</span>
        <input type="checkbox" role="switch" checked={p.deadlines} onChange={(e) => save({ ...p, deadlines: e.target.checked })} className="h-5 w-5 accent-[#e8bf63]" />
      </label>
      {areas.length > 0 && (
        <fieldset className="border-t border-[rgba(255,220,148,0.1)] pt-4">
          <legend className="text-sm font-medium text-[var(--ink)]">{s.perSector}</legend>
          <p className="mb-2 text-xs text-[var(--ink-dim)]">{s.perSectorWhy}</p>
          <div className="flex flex-wrap gap-1.5">
            {areas.map((a) => {
              const on = !p.muted.includes(a.key);
              return (
                <button key={a.key} type="button" aria-pressed={on} data-on={on || undefined} onClick={() => save({ ...p, muted: on ? [...p.muted, a.key] : p.muted.filter((k) => k !== a.key) })} className="mod-tab focus-ring">
                  {a.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}
