"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth.actions";

export function LogoutButton() {
  return (
    <form action={logoutAction} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--ink-dim)]">Te déconnecter de cet appareil.</p>
      <button type="submit" className="mod-chip focus-ring">
        <LogOut size={13} /> Se déconnecter
      </button>
    </form>
  );
}
