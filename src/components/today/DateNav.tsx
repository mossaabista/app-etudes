"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { useI18n } from "@/i18n/client";

/** One day at a time: previous, the day itself, next — and a way back to today. */
export function DateNav({ prev, next, isToday, label }: { prev: string; next: string; isToday: boolean; label: string }) {
  const { t } = useI18n();
  return (
    <div className="mb-6 flex items-center gap-2.5">
      <Link href={`/today?d=${prev}`} aria-label={t.today.prev} className="lm focus-ring h-11 w-11 shrink-0">
        <LiquidLayers>
          <ChevronLeft size={18} />
        </LiquidLayers>
      </Link>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight text-on-gold">{label}</h1>
        {!isToday && (
          <Link href="/today" className="text-xs text-on-gold underline-offset-2 hover:underline">
            {t.today.backToday}
          </Link>
        )}
      </div>
      <Link href={`/today?d=${next}`} aria-label={t.today.next} className="lm focus-ring h-11 w-11 shrink-0">
        <LiquidLayers>
          <ChevronRight size={18} />
        </LiquidLayers>
      </Link>
    </div>
  );
}
