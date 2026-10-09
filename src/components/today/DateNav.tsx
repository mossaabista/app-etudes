import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { addDays, addMonths, toISODate } from "@/lib/dates";

export type Range = "day" | "week" | "month";

const RANGE_LABEL: Record<Range, string> = { day: "Jour", week: "Semaine", month: "Mois" };

function href(date: Date, range: Range) {
  return `/today?d=${toISODate(date)}&r=${range}`;
}

/** One step back or forward, in whatever unit the current range uses. */
function shift(anchor: Date, range: Range, direction: -1 | 1) {
  if (range === "month") return addMonths(anchor, direction);
  return addDays(anchor, direction * (range === "week" ? 7 : 1));
}

export function DateNav({ anchor, range, label }: { anchor: Date; range: Range; label: string }) {
  const isToday = toISODate(anchor) === toISODate(new Date()) && range === "day";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Link
          href={href(shift(anchor, range, -1), range)}
          aria-label="Précédent"
          className="lm focus-ring h-11 w-11 shrink-0"
        >
          <LiquidLayers>
            <ChevronLeft size={18} />
          </LiquidLayers>
        </Link>

        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-on-gold">{label}</h1>
          {!isToday && (
            <Link href={href(new Date(), "day")} className="text-xs text-on-gold underline-offset-2 hover:underline">
              Revenir à aujourd&apos;hui
            </Link>
          )}
        </div>

        <Link
          href={href(shift(anchor, range, 1), range)}
          aria-label="Suivant"
          className="lm focus-ring h-11 w-11 shrink-0"
        >
          <LiquidLayers>
            <ChevronRight size={18} />
          </LiquidLayers>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {(["day", "week", "month"] as const).map((r) =>
          r === range ? (
            <span key={r} className="lm focus-ring h-10 px-5 text-xs font-medium">
              <LiquidLayers>{RANGE_LABEL[r]}</LiquidLayers>
            </span>
          ) : (
            <Link
              key={r}
              href={href(anchor, r)}
              className="glass-pill glass-prism focus-ring relative px-5 py-2.5 text-xs font-medium"
            >
              {RANGE_LABEL[r]}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
