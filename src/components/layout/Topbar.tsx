"use client";

import { useI18n } from "@/i18n/client";
import { Menu, X } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { BRAND } from "@/lib/brand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { navLabel, activeKey, navByKeys } from "@/lib/nav";
import { RoleSwitcher } from "@/components/layout/RoleSwitcher";
import type { ProfileType } from "@/lib/profile";

export function Topbar({ nav, role, roles }: { nav: string[]; role: ProfileType; roles: ProfileType[] }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const current = activeKey(nav, pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="md:hidden relative z-50 flex items-center justify-between border-b border-[rgba(255,220,148,0.14)] bg-[linear-gradient(180deg,rgba(40,27,10,0.97),rgba(28,19,7,0.97))] px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))]">
        <Link href="/today" className="flex items-center gap-2">
          <BrandMark size={24} />
          <span className="text-sm font-semibold tracking-[0.08em] text-[var(--ink)]">{BRAND.name.toUpperCase()}</span>
        </Link>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
          className="rounded-md p-1.5 text-[var(--ink-dim)] hover:bg-[rgba(255,220,148,0.08)]"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[45] overflow-y-auto bg-[linear-gradient(180deg,#2a1d0a,#140d04)] pt-[var(--mobile-header-h)] pb-[env(safe-area-inset-bottom,0px)]">
          {roles.length > 1 && (
            <div className="px-3 pt-3">
              <RoleSwitcher role={role} roles={roles} />
            </div>
          )}
          <nav aria-label="Menu" className="space-y-0.5 p-3">
            {navByKeys(nav).map((item) => {
              const active = item.key === current;
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[rgba(255,220,148,0.13)] text-[var(--ink)]"
                      : "text-[var(--ink-faint)] hover:bg-[rgba(255,220,148,0.07)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                  {navLabel(item, t.nav)}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
