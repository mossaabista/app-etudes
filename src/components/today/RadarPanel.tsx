import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { RadarAlert } from "@/server/radar";

const KIND: Record<RadarAlert["kind"], string> = { overdue: "En retard", "no-time": "Rien de prévu", conflict: "Conflit", overload: "Surcharge", undated: "Sans date" };

/** What is at risk in the next two weeks, each with its reason and one thing to do. */
export function RadarPanel({ alerts }: { alerts: RadarAlert[] }) {
  if (!alerts.length) return null;
  const shown = alerts.slice(0, 5);
  return (
    <section className="glass-card p-5" aria-labelledby="radar-title">
      <header className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-[#ffd9a8]" aria-hidden />
        <h2 id="radar-title" className="text-sm font-semibold text-[var(--ink)]">
          À surveiller
        </h2>
        <span className="text-xs text-[var(--ink-dim)]">· {alerts.length} point{alerts.length > 1 ? "s" : ""} sur 14 jours</span>
      </header>
      <ul className="mt-3 space-y-2">
        {shown.map((a, i) => (
          <li key={i} className="tile flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${a.level === "high" ? "bg-[rgba(255,140,120,0.16)] text-[#ffb3a3]" : "bg-[rgba(240,205,121,0.14)] text-[#f0cd79]"}`}>
              {KIND[a.kind]}
            </span>
            <div className="min-w-0 flex-1 basis-[13rem]">
              <p className="text-sm text-[var(--ink)]">{a.title}</p>
              <p className="text-xs text-[var(--ink-dim)]">{a.detail}</p>
            </div>
            <Link href={a.href} className="mod-chip focus-ring shrink-0">
              {a.action} <ArrowRight size={12} />
            </Link>
          </li>
        ))}
      </ul>
      {alerts.length > shown.length && <p className="mt-2 text-xs text-[var(--ink-faint)]">Et {alerts.length - shown.length} autre{alerts.length - shown.length > 1 ? "s" : ""} — demande « qu&apos;est-ce qui est à risque ? » à l&apos;assistant.</p>}
    </section>
  );
}
