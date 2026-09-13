"use client";

import { GraduationCap, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV_ITEMS } from "@/lib/nav";

export function Topbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="md:hidden flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/today" className="flex items-center gap-2">
          <GraduationCap size={20} className="text-slate-900" />
          <span className="text-sm font-bold tracking-tight text-slate-900">App Études</span>
        </Link>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 top-[53px] z-50 bg-white">
          <nav className="space-y-0.5 p-3">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
