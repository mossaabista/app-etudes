"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/client";
import { LOCALES } from "@/i18n/config";
import { setLocaleAction } from "@/server/actions/locale.actions";

const LABEL = { fr: "FR", en: "EN" } as const;
const NAME = { fr: "Français", en: "English" } as const;

/** FR | EN, everywhere a language can be picked. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label="Langue / Language" className={`inline-flex rounded-full border border-[rgba(255,220,148,0.2)] p-0.5 ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-label={NAME[l]}
          aria-pressed={locale === l}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setLocaleAction(l);
              router.refresh();
            })
          }
          className={`focus-ring min-h-8 min-w-10 rounded-full px-3 text-xs font-semibold transition-colors ${locale === l ? "bg-[#e8bf63] text-[#2a1a05]" : "text-[var(--ink-dim)] hover:text-[var(--ink)]"}`}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
