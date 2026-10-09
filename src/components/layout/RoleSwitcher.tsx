"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchRoleAction } from "@/server/actions/profile.actions";
import { profileOf, type ProfileType } from "@/lib/profile";

/** Switch the active role (student, athlete…). Only what is shown changes; no data moves. */
export function RoleSwitcher({ role, roles }: { role: ProfileType; roles: ProfileType[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="block">
      <span className="sr-only">Contexte actif</span>
      <select
        value={role}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as ProfileType;
          start(async () => {
            await switchRoleAction(next);
            router.refresh();
          });
        }}
        className="focus-ring w-full cursor-pointer rounded-md border border-[rgba(255,220,148,0.18)] bg-[rgba(255,220,148,0.06)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)]"
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {profileOf(r).label}
          </option>
        ))}
      </select>
    </label>
  );
}
