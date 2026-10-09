"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth.actions";
import { useI18n } from "@/i18n/client";

export function LogoutButton() {
  const t = useI18n().t.settingsUi.logout;
  return (
    <form action={logoutAction} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--ink-dim)]">{t.text}</p>
      <button type="submit" className="mod-chip focus-ring">
        <LogOut size={13} /> {t.button}
      </button>
    </form>
  );
}
