import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
      <div className="flex items-center gap-2">
        <Link
          href={href(shift(anchor, range, -1), range)}
          aria-label="Précédent"
          className="glass-pill focus-ring flex h-10 w-10 items-center justify-center text-slate-600"
        >
          <ChevronLeft size={18} />
        </Link>

        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">{label}</h1>
          {!isToday && (
            <Link href={href(new Date(), "day")} className="text-xs text-slate-500 hover:text-slate-800">
              Revenir à aujourd&apos;hui
            </Link>
          )}
        </div>

        <Link
          href={href(shift(anchor, range, 1), range)}
          aria-label="Suivant"
          className="glass-pill focus-ring flex h-10 w-10 items-center justify-center text-slate-600"
        >
          <ChevronRight size={18} />
        </Link>
      </div>

      <div className="flex items-center gap-1.5">
        {(["day", "week", "month"] as const).map((r) => (
          <Link
            key={r}
            href={href(anchor, r)}
            data-active={r === range}
            className={`glass-pill glass-prism focus-ring relative px-4 py-2 text-xs font-medium ${
              r === range ? "glass-pill-active" : "text-slate-600"
            }`}
          >
            {RANGE_LABEL[r]}
          </Link>
        ))}
      </div>
    </div>
  );
}
