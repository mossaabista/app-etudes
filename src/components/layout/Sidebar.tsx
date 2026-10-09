"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeKey, navByKeys } from "@/lib/nav";
import { BrandMark } from "@/components/layout/BrandMark";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import { BRAND } from "@/lib/brand";
import type { ProfileType } from "@/lib/profile";

export function Sidebar({ userName, nav, role, roles }: { userName?: string; nav: string[]; role: ProfileType; roles: ProfileType[] }) {
  const pathname = usePathname();
  const active = activeKey(nav, pathname);

  return (
    <aside className="hidden md:flex h-dvh w-56 shrink-0 flex-col border-r border-[rgba(255,220,148,0.14)] bg-[linear-gradient(180deg,rgba(40,27,10,0.96),rgba(22,15,6,0.97))] backdrop-blur-xl">
      <div className="border-b border-[rgba(255,220,148,0.12)] px-5 py-5">
        <Link href="/today" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[0.95rem] font-semibold tracking-[0.08em] text-[var(--ink)]">{BRAND.name.toUpperCase()}</span>
        </Link>
      </div>
      {roles.length > 1 && (
        <div className="px-3 pt-3">
          <RoleSwitcher role={role} roles={roles} />
        </div>
      )}
      <nav aria-label="Navigation principale" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navByKeys(nav).map((item) => {
          const on = item.key === active;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`focus-ring flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                on ? "bg-[rgba(255,220,148,0.13)] text-[var(--ink)]" : "text-[var(--ink-faint)] hover:bg-[rgba(255,220,148,0.07)] hover:text-[var(--ink)]"
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {userName && (
        <div className="border-t border-[rgba(255,220,148,0.12)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(145deg,#e8bf63,#9a6b1c)] text-xs font-bold text-[#2a1b06]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-[var(--ink-dim)] truncate">{userName}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
