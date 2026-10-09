import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { RadarAlert } from "@/server/radar";
import { getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";

/** What is at risk in the next two weeks, each with its reason and one thing to do. */
export async function RadarPanel({ alerts }: { alerts: RadarAlert[] }) {
  if (!alerts.length) return null;
  const t = (await getMessages()).radar;
  const shown = alerts.slice(0, 5);
  return (
    <section className="glass-card p-5" aria-labelledby="radar-title">
      <header className="flex items-center gap-2">
        <AlertTriangle size={15} className="text-[#ffd9a8]" aria-hidden />
        <h2 id="radar-title" className="text-sm font-semibold text-[var(--ink)]">
          {t.title}
        </h2>
        <span className="text-xs text-[var(--ink-dim)]">{fmt(t.count, { n: alerts.length })}</span>
      </header>
      <ul className="mt-3 space-y-2">
        {shown.map((a, i) => (
          <li key={i} className="tile flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${a.level === "high" ? "bg-[rgba(255,140,120,0.16)] text-[#ffb3a3]" : "bg-[rgba(240,205,121,0.14)] text-[#f0cd79]"}`}>
              {t.kinds[a.kind]}
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
      {alerts.length > shown.length && <p className="mt-2 text-xs text-[var(--ink-faint)]">{fmt(t.more, { n: alerts.length - shown.length })}</p>}
    </section>
  );
}
