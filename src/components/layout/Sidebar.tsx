"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { GraduationCap } from "lucide-react";

export function Sidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-dvh w-56 shrink-0 flex-col border-r border-[rgba(255,220,148,0.14)] bg-[linear-gradient(180deg,rgba(40,27,10,0.96),rgba(22,15,6,0.97))] backdrop-blur-xl">
      <div className="border-b border-[rgba(255,220,148,0.12)] px-5 py-5">
        <Link href="/today" className="flex items-center gap-2.5">
          <GraduationCap size={22} className="text-[var(--ink-dim)]" />
          <span className="text-sm font-bold tracking-tight text-[var(--ink)]">App Études</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
