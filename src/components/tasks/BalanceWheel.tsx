import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface BalanceArea {
  key: string;
  label: string;
  front: string;
  color: string;
  /** 0–1: how much of this area got attention this week. */
  score: number;
  count: number;
  hint: string;
}

/**
 * The week across the eight areas as a radar: one spoke per area, the gold shape is how far
 * each was looked after. The thinnest spokes come with a nudge.
 */
export function BalanceWheel({ areas }: { areas: BalanceArea[] }) {
  const size = 260;
  const c = size / 2;
  const r = c - 34;
  const point = (i: number, k: number) => {
    const a = (Math.PI * 2 * i) / areas.length - Math.PI / 2;
    return [c + Math.cos(a) * r * k, c + Math.sin(a) * r * k] as const;
  };
  const shape = areas.map((a, i) => point(i, 0.12 + a.score * 0.88).join(",")).join(" ");
  const overall = Math.round((areas.reduce((s, a) => s + a.score, 0) / areas.length) * 100);
  const weakest = [...areas].sort((a, b) => a.score - b.score).slice(0, 3);

  return (
    <section className="glass-card mb-8 grid gap-6 p-5 md:grid-cols-[auto_1fr] md:items-center">
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label={`Équilibre de la semaine : ${overall} sur 100`}>
          <defs>
            <radialGradient id="balance-fill">
              <stop offset="0" stopColor="#ffe9a0" stopOpacity="0.55" />
              <stop offset="1" stopColor="#c9952f" stopOpacity="0.25" />
            </radialGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((k) => (
            <polygon key={k} points={areas.map((_, i) => point(i, k).join(",")).join(" ")} fill="none" stroke="rgba(255,220,148,0.12)" />
          ))}
          {areas.map((a, i) => {
            const [x, y] = point(i, 1);
            const [lx, ly] = point(i, 1.17);
            return (
              <g key={a.key}>
                <line x1={c} y1={c} x2={x} y2={y} stroke="rgba(255,220,148,0.12)" />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="fill-[var(--ink-dim)] text-[10px] font-semibold">
                  {a.front}
                </text>
              </g>
            );
          })}
          <polygon points={shape} fill="url(#balance-fill)" stroke="#f0cd79" strokeWidth="1.6" strokeLinejoin="round" className="balance-shape" />
          {areas.map((a, i) => {
            const [x, y] = point(i, 0.12 + a.score * 0.88);
            return <circle key={a.key} cx={x} cy={y} r="3.6" fill={a.color} stroke="#1a1106" strokeWidth="1.2" />;
          })}
        </svg>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--ink)]">Ta semaine en équilibre</h2>
          <span className="shrink-0 text-2xl font-semibold tabular-nums text-[#f0cd79]">
            {overall}
            <span className="text-xs font-normal text-[var(--ink-faint)]"> / 100</span>
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">
          Chaque tâche faite, séance notée, prière cochée ou appel passé compte dans son domaine. Voici ce qui mérite un peu d&apos;attention :
        </p>
        <ul className="mt-3 space-y-2">
          {weakest.map((a) => (
            <li key={a.key}>
              <Link href={`/tasks/${a.key}`} className="tile focus-ring flex items-center gap-3 px-3.5 py-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-[var(--ink)]">{a.label}</span>
                  <span className="block text-xs text-[var(--ink-dim)]">{a.hint}</span>
                </span>
                <ArrowRight size={14} className="shrink-0 text-[var(--ink-faint)]" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
