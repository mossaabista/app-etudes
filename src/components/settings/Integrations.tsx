"use client";

import type { Integration } from "@/server/integrations";
import { useI18n } from "@/i18n/client";

const TONE: Record<Integration["state"], string> = {
  connected: "text-[#86d6a4] border-[rgba(134,214,164,0.35)]",
  available: "text-[#f0cd79] border-[rgba(240,205,121,0.35)]",
  device: "text-[var(--ink-dim)] border-[rgba(255,220,148,0.2)]",
  failed: "text-[#ffb3a3] border-[rgba(255,179,163,0.4)]",
  not_configured: "text-[var(--ink-faint)] border-[rgba(255,220,148,0.14)]",
};

export function Integrations({ items }: { items: Integration[] }) {
  const state = useI18n().t.settingsUi.integrations.state;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-sm font-medium text-[var(--ink)]">{i.name}</p>
            <p className="text-xs leading-5 text-[var(--ink-dim)]">{i.detail}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${TONE[i.state]}`}>{state[i.state]}</span>
        </li>
      ))}
    </ul>
  );
}
