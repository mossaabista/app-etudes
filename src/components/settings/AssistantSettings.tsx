"use client";

import { Mic } from "lucide-react";
import { VoiceSettings } from "@/components/settings/VoiceSettings";
import { useI18n } from "@/i18n/client";

/** Jarvis: whether it is on, how it speaks, and what it can do. */
export function AssistantSettings({ enabled }: { enabled: boolean }) {
  const { t: all, locale } = useI18n();
  const t = all.settingsUi.assistant;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-[#7fe0b0] shadow-[0_0_8px_#7fe0b0]" : "bg-[#9d8455]"}`} aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-[var(--ink)]">
          {enabled ? t.on : t.off}
        </p>
      </div>
      <VoiceSettings />
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-dim)]">
          <Mic size={13} className="text-[#f0cd79]" /> {t.tryTitle}
        </p>
        <ul className="space-y-1">
          {Object.values(t.examples).map((e) => (
            <li key={e} className="text-xs text-[var(--ink-dim)]">
              {locale === "fr" ? `« ${e} »` : `“${e}”`}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
