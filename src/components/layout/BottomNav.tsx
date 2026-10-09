"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavFor, isActive } from "@/lib/nav";

export function BottomNav({ student = true }: { student?: boolean }) {
  const pathname = usePathname();
  const mobileItems = mobileNavFor(student);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(255,220,148,0.14)] bg-[linear-gradient(180deg,rgba(40,27,10,0.92),rgba(22,15,6,0.97))] pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl">
      <div className="flex items-center justify-around py-2 px-1">
        {mobileItems.map((item) => {
          const active = isActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium transition-colors ${
                active ? "text-[#f0cd79]" : "text-[var(--ink-faint)]"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
