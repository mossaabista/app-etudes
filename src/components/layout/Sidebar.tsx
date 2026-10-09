"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navFor, isActive } from "@/lib/nav";
import { BrandMark } from "@/components/layout/BrandMark";
import { BRAND } from "@/lib/brand";

export function Sidebar({ userName, student = true }: { userName?: string; student?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-dvh w-56 shrink-0 flex-col border-r border-[rgba(255,220,148,0.14)] bg-[linear-gradient(180deg,rgba(40,27,10,0.96),rgba(22,15,6,0.97))] backdrop-blur-xl">
      <div className="border-b border-[rgba(255,220,148,0.12)] px-5 py-5">
        <Link href="/today" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[0.95rem] font-semibold tracking-[0.08em] text-[var(--ink)]">{BRAND.name.toUpperCase()}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navFor(student).map((item) => {
          const active = isActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[rgba(255,220,148,0.13)] text-[var(--ink)]"
                  : "text-[var(--ink-faint)] hover:bg-[rgba(255,220,148,0.07)] hover:text-[var(--ink)]"
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
