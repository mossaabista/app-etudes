"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Undo2 } from "lucide-react";
import { deleteEventAction, updateEventAction } from "@/server/actions/event.actions";
import { undoCommandAction, type Undo } from "@/server/actions/capture.actions";
import { DayDeck } from "@/components/calendar/DayDeck";
import type { CalCategory, LegendEntry } from "@/lib/calendar-categories";
import { useI18n } from "@/i18n/client";
import { fmt, INTL, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/ns/workspace";

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
  /** The user's own events: can be changed or deleted from the day view. */
  edit?: { id: string; notes: string | null };
}

/** Short weekday names, Sunday first: 2023-01-01 was a Sunday. */
const weekdayLabels = (locale: Locale) =>
  Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(2023, 0, 1 + i, 12))));

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

export function CalendarView({ days, items, legend: rawLegend }: { days: CalDay[]; items: CalItem[]; legend: LegendEntry[] }) {
  const { t, locale } = useI18n();
  const w = t.workspace.cal;
  // Category names in the reader's language; colours and order stay the profile's.
  const legend = useMemo(() => rawLegend.map((l) => ({ ...l, label: (w.cat as Record<string, string>)[l.key] ?? l.label })), [rawLegend, w]);
  const dayLabel = useCallback((iso: string) => formatDay(iso, locale), [locale]);
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
          {weekdayLabels(locale).map((wd) => (
            <div key={wd} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-dim)]">
              {wd}
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
                aria-label={`${d.day}${list.length ? `, ${plural(locale, list.length, w.itemOne, w.itemMany)}` : ""}`}
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
                  {more > 0 && <span className="px-1 text-[11px] font-medium text-[var(--ink-dim)]">{plural(locale, more, w.moreOne, w.moreMany)}</span>}
                  {classes.length > 0 && (
                    <span className="cal-classes" style={{ "--c": colorOf(classes[0]) } as React.CSSProperties}>
                      {plural(locale, classes.length, w.classOne, w.classMany)}
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
          days={days.map((d) => ({ iso: d.iso, node: <DayCard day={d} items={byDay.get(d.iso) ?? []} colorOf={colorOf} labelOf={labelOf} dayLabel={dayLabel} /> }))}
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
  dayLabel,
}: {
  day: CalDay;
  items: CalItem[];
  colorOf: (i: CalItem) => string;
  labelOf: (c: CalCategory) => string;
  dayLabel: (iso: string) => string;
}) {
  const { t } = useI18n();
  const w = t.workspace.cal;
  const list = [...items].sort(byClock);
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; undo?: Undo } | null>(null);
  return (
    <section className="glass-card flex h-full flex-col p-5">
      <header className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold capitalize text-[var(--ink)]">{dayLabel(day.iso)}</h3>
        {list.length > 0 && <span className="text-xs text-[var(--ink-dim)]">{list.length}</span>}
        {day.isToday && <span className="ml-auto rounded-full bg-[#e8bf63] px-2 py-0.5 text-[10px] font-semibold text-[#2a1a05]">{t.nav.today}</span>}
      </header>
      {list.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs leading-5 text-[var(--ink-faint)]">{w.emptyDay}</p>
      ) : (
        // Every card in the deck is the same height, so a busy day scrolls inside its card.
        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {list.map((i) =>
            editing === i.id && i.edit ? (
              <li key={i.id} className="tile px-3.5 py-3">
                <EventEditor
                  item={i}
                  onCancel={() => setEditing(null)}
                  onSaved={(undo) => {
                    setEditing(null);
                    setNote({ text: w.eventChanged, undo });
                    router.refresh();
                  }}
                />
              </li>
            ) : (
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
                  {[labelOf(i.category), i.end ? fmt(t.today.until, { time: i.end }) : null, i.detail].filter(Boolean).join(" · ")}
                </p>
              </div>
              {i.edit && (
                <span className="flex shrink-0 gap-0.5">
                  <button type="button" onClick={() => setEditing(i.id)} aria-label={fmt(w.editNamed, { title: i.title })} className="focus-ring rounded p-1.5 text-[var(--ink-faint)] hover:text-[var(--ink)]">
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await deleteEventAction(i.edit!.id);
                      setNote("error" in r ? { text: r.error } : { text: fmt(w.deletedNamed, { title: i.title }), undo: r.undo });
                      router.refresh();
                    }}
                    aria-label={fmt(w.deleteNamed, { title: i.title })}
                    className="focus-ring rounded p-1.5 text-[var(--ink-faint)] hover:text-[#ffb3a3]"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              )}
            </li>
            )
          )}
        </ol>
      )}
      {note && (
        <p role="status" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-dim)]">
          {note.text}
          {note.undo && (
            <button
              type="button"
              onClick={async () => {
                const { missed } = await undoCommandAction(note.undo!);
                setNote({ text: missed ? w.undonePartial : w.undone });
                router.refresh();
              }}
              className="mod-chip focus-ring text-xs"
            >
              <Undo2 size={12} /> {t.common.undo}
            </button>
          )}
        </p>
      )}
    </section>
  );
}

function formatDay(iso: string, locale: Locale) {
  // Noon UTC keeps the date stable whatever zone the browser is in.
  return new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${iso}T12:00:00Z`));
}

const input = "w-full rounded-lg border border-[rgba(255,220,148,0.16)] bg-[rgba(20,14,6,0.55)] px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[rgba(255,220,148,0.45)]";

/** Change an event's title, day, times and notes. */
function EventEditor({ item, onCancel, onSaved }: { item: CalItem; onCancel: () => void; onSaved: (undo: Undo) => void }) {
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.date);
  const [start, setStart] = useState(item.time ?? "");
  const [end, setEnd] = useState(item.end ?? "");
  const [notes, setNotes] = useState(item.edit?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();
  const w = t.workspace.cal;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const r = await updateEventAction(item.edit!.id, { title, date, start: start || null, end: end || null, notes: notes || null });
        setSaving(false);
        if ("error" in r) return setError(r.error);
        onSaved(r.undo);
      }}
      className="space-y-2"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={w.title} maxLength={200} className={input} />
      <div className="grid grid-cols-3 gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={w.date} className={input} />
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label={w.start} className={input} />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label={w.end} className={input} />
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} aria-label={w.notes} placeholder={w.notes} maxLength={2000} className={input} />
      {error && (
        <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="mod-chip mod-chip-gold focus-ring text-xs">
          {t.common.save}
        </button>
        <button type="button" onClick={onCancel} className="mod-chip focus-ring text-xs">
          {t.common.close}
        </button>
      </div>
    </form>
  );
}
