"use client";

import { useCallback, useMemo, useState } from "react";
import { DayDeck } from "@/components/calendar/DayDeck";
import type { CalCategory, LegendEntry } from "@/lib/calendar-categories";

export interface CalDay {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

export interface CalItem {
  id: string;
  date: string;
  time: string | null;
  end?: string;
  title: string;
  code?: string;
  /** "GNG", "4144": a short course tag for the cramped grid. */
  short?: string;
  category: CalCategory;
  /** Overrides the category colour (rarely needed). */
  color?: string;
  detail?: string;
  done?: boolean;
  /** Weekly classes: summarised as one line in the grid, listed in full in the day. */
  recurring?: boolean;
}

const WEEKDAY_LABELS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** How many things a cell shows before "+N". Fewer, larger lines read at a glance. */
const MAX_LINES = 3;

// What a month view is for: what is due first, then appointments, then the rest.
const RANK: Partial<Record<CalCategory, number>> = { examen: 0, quiz: 1, devoir: 2, projet: 2, lab: 2, livrable: 2, reunion: 3, equipe: 3 };
function order(a: CalItem, b: CalItem) {
  const ra = RANK[a.category] ?? 4;
  const rb = RANK[b.category] ?? 4;
  if (ra !== rb) return ra - rb;
  return (a.time ?? "99").localeCompare(b.time ?? "99");
}

export function CalendarView({ days, items, legend }: { days: CalDay[]; items: CalItem[]; legend: LegendEntry[] }) {
  const [hidden, setHidden] = useState<Set<CalCategory>>(new Set());
  const [selected, setSelected] = useState<string>(() => (days.find((d) => d.isToday) ?? days.find((d) => d.inMonth) ?? days[0]).iso);
  // Index into `days` of the day zoomed into the deck, or null while the grid is showing.
  const [open, setOpen] = useState<number | null>(null);

  const colorOf = useMemo(() => {
    const map = new Map(legend.map((l) => [l.key, l.color]));
    return (i: CalItem) => i.color ?? map.get(i.category) ?? "#b8ad9c";
  }, [legend]);
  const labelOf = useMemo(() => {
    const map = new Map(legend.map((l) => [l.key, l.label]));
    return (c: CalCategory) => map.get(c) ?? "";
  }, [legend]);

  const pick = (index: number) => {
    setSelected(days[index].iso);
    setOpen(index);
  };
  const change = useCallback(
    (index: number) => {
      setOpen(index);
      setSelected(days[index].iso);
    },
    [days]
  );
  const close = useCallback(() => setOpen(null), []);

  const byDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const i of items) {
      if (hidden.has(i.category)) continue;
      (map.get(i.date) ?? map.set(i.date, []).get(i.date)!).push(i);
    }
    for (const list of map.values()) list.sort(order);
    return map;
  }, [items, hidden]);

  const counts = useMemo(() => {
    const monthDays = new Set(days.filter((d) => d.inMonth).map((d) => d.iso));
    const c = {} as Record<string, number>;
    for (const i of items) if (monthDays.has(i.date)) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [items, days]);

  // The legend lists the profile's categories that have something this month.
  const shownLegend = legend.filter((l) => counts[l.key]);

  const toggle = (key: CalCategory) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-4">
      {/* Legend doubles as the filter. */}
      {shownLegend.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shownLegend.map((c) => {
            const off = hidden.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                aria-pressed={!off}
                className={`glass-pill focus-ring flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium transition-opacity ${off ? "opacity-40" : ""}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                <span className="text-[var(--ink)]">{c.label}</span>
                <span className="text-[var(--ink-faint)]">{counts[c.key]}</span>
              </button>
            );
          })}
        </div>
      )}

      <section className="glass-card p-2.5 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-dim)]">
              {w}
            </div>
          ))}

          {days.map((d, index) => {
            const list = byDay.get(d.iso) ?? [];
            const classes = list.filter((i) => i.recurring);
            const rest = list.filter((i) => !i.recurring);
            const isSelected = d.iso === selected;
            const shown = rest.slice(0, MAX_LINES);
            const more = rest.length - shown.length;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => pick(index)}
                aria-label={`${d.day}${list.length ? `, ${list.length} élément${list.length > 1 ? "s" : ""}` : ""}`}
                aria-pressed={isSelected}
                data-today={d.isToday || undefined}
                data-selected={isSelected || undefined}
                className={`cal-cell focus-ring flex min-h-[4.5rem] flex-col items-stretch gap-1 p-1 text-left sm:min-h-[8.25rem] sm:gap-1.5 sm:p-2 ${d.inMonth ? "" : "opacity-35"}`}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      d.isToday ? "bg-[#e8bf63] text-[#2a1a05] shadow-[0_0_10px_rgba(255,200,90,0.6)]" : "text-[var(--ink)]"
                    }`}
                  >
                    {d.day}
                  </span>
                </span>

                {/* Phones: one short bar per thing that is not a class. */}
                {rest.length > 0 && (
                  <span className="flex flex-wrap gap-[3px] sm:hidden" aria-hidden>
                    {rest.slice(0, 4).map((i) => (
                      <span key={i.id} className="h-1 w-3 rounded-full" style={{ background: colorOf(i) }} />
                    ))}
                    {rest.length > 4 && <span className="text-[9px] leading-[4px] text-[var(--ink-dim)]">+{rest.length - 4}</span>}
                  </span>
                )}

                <span className="hidden min-w-0 flex-col gap-1 sm:flex">
                  {shown.map((i) => (
                    <span
                      key={i.id}
                      title={`${i.time ? `${i.time} · ` : ""}${i.code ? `${i.code} · ` : ""}${i.title}`}
                      data-land={`cal-${i.id}`}
                      className={`cal-line ${i.done ? "line-through opacity-50" : ""}`}
                      style={{ "--c": colorOf(i) } as React.CSSProperties}
                    >
                      {/* A 23:59 hand-in is "by the end of the day": the time adds nothing. */}
                      {i.time && i.time !== "23:59" && <span className="cal-line-time">{i.time.replace(":00", "h").replace(":", "h")}</span>}
                      <span className="line-clamp-2 min-w-0 break-words">{i.title}</span>
                    </span>
                  ))}
                  {more > 0 && <span className="px-1 text-[11px] font-medium text-[var(--ink-dim)]">+{more} autre{more > 1 ? "s" : ""}</span>}
                  {classes.length > 0 && (
                    <span className="cal-classes" style={{ "--c": colorOf(classes[0]) } as React.CSSProperties}>
                      {classes.length} cours
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {open !== null && (
        <DayDeck
          active={open}
          onChange={change}
          onClose={close}
          label={dayLabel}
          days={days.map((d) => ({ iso: d.iso, node: <DayCard day={d} items={byDay.get(d.iso) ?? []} colorOf={colorOf} labelOf={labelOf} /> }))}
        />
      )}
    </div>
  );
}

// In the deck the day is read top to bottom, in clock order; things with no time last.
const byClock = (a: CalItem, b: CalItem) => (a.time ?? "99").localeCompare(b.time ?? "99");

function DayCard({
  day,
  items,
  colorOf,
  labelOf,
}: {
  day: CalDay;
  items: CalItem[];
  colorOf: (i: CalItem) => string;
  labelOf: (c: CalCategory) => string;
}) {
  const list = [...items].sort(byClock);
  return (
    <section className="glass-card flex h-full flex-col p-5">
      <header className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold capitalize text-[var(--ink)]">{dayLabel(day.iso)}</h3>
        {list.length > 0 && <span className="text-xs text-[var(--ink-dim)]">{list.length}</span>}
        {day.isToday && <span className="ml-auto rounded-full bg-[#e8bf63] px-2 py-0.5 text-[10px] font-semibold text-[#2a1a05]">Aujourd&apos;hui</span>}
      </header>
      {list.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--ink-faint)]">Rien ce jour-là.</p>
      ) : (
        // Every card in the deck is the same height, so a busy day scrolls inside its card.
        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {list.map((i) => (
            <li key={i.id} data-land={`deck-${i.id}`} className={`tile flex items-start gap-2.5 px-3.5 py-3 ${i.done ? "opacity-55" : ""}`}>
              <span className="pill shrink-0" style={{ "--c": colorOf(i) } as React.CSSProperties}>
                <span className="pill-time">{i.time ?? "—"}</span>
                <span className="pill-cap" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`line-clamp-2 text-sm font-medium leading-5 text-[var(--ink)] ${i.done ? "line-through" : ""}`}>
                  {i.code && <span className="text-[var(--ink-dim)]">{i.code} · </span>}
                  {i.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--ink-dim)]">
                  {[labelOf(i.category), i.end ? `jusqu'à ${i.end}` : null, i.detail].filter(Boolean).join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function dayLabel(iso: string) {
  // Noon UTC keeps the date stable whatever zone the browser is in.
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
}
