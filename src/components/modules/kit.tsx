"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarPlus, Check, Minus, Plus, Trash2, X } from "lucide-react";
import { addEntryAction, deleteEntryAction, scheduleAction, updateEntryAction } from "@/server/actions/tracker.actions";
import { useI18n } from "@/i18n/client";
import { INTL, fmt, type Locale } from "@/i18n/config";

/** A recorded row as the section pages see it. */
export interface Entry {
  id: string;
  kind: string;
  day: string;
  text: string | null;
  value: number | null;
  done: boolean;
  data: Record<string, unknown>;
}

export interface ModuleProps {
  module: string;
  today: string;
  entries: Entry[];
  /** Rows of other sections this one reads (Sport reads the weight logged under Corps). */
  related: Record<string, Entry[]>;
  /** The section's own tasks, for sections that are task lists (Tâches). */
  tasks?: SectionTask[];
  /** The "area:sub" tasks are filed under. */
  category?: string;
}

export interface SectionTask {
  id: string;
  title: string;
  done: boolean;
  due: string | null;
  priority: string;
  minutes: number | null;
  subtasks: { id: string; title: string; done: boolean }[];
}

// --------------------------------------------------------------------------- dates

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000);
/** A calendar day ("2026-10-09") in words. The day is already a date, so it is read as-is (UTC noon). */
export const dayLabel = (
  iso: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" },
  locale: Locale = "fr"
) => new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", ...opts }).format(new Date(`${iso}T12:00:00Z`));
export const lastDays = (today: string, n: number) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));

/** Consecutive days ending today (or yesterday, if today is not done yet) that pass `ok`. */
export function streak(today: string, ok: (day: string) => boolean) {
  let day = ok(today) ? today : addDays(today, -1);
  let n = 0;
  while (ok(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/**
 * What section pages need to speak the reader's language: the strings, days in words,
 * amounts of money, and the display name of a choice stored in French in the row.
 */
export function useModuleText() {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const values = t.modulesB.values as Record<string, string>;
    return {
      t,
      locale,
      day: (iso: string, opts?: Intl.DateTimeFormatOptions) => dayLabel(iso, opts, locale),
      value: (v: unknown) => {
        const s = v == null ? "" : String(v);
        return values[s] ?? s;
      },
      money: (n: number) => n.toLocaleString(INTL[locale], { style: "currency", currency: "CAD" }),
      /** "42 %" in French, "42%" in English. */
      pct: (n: number | string) => (locale === "fr" ? `${n} %` : `${n}%`),
    };
  }, [t, locale]);
}

// --------------------------------------------------------------------------- mutations

/**
 * The section's write helpers, each run in a transition so the page refreshes after.
 * Stable across renders, so timers and effects can depend on them.
 */
export function useEntries(module: string) {
  const [pending, start] = useTransition();
  const api = useMemo(
    () => ({
      add: (kind: string, fields: Omit<Parameters<typeof addEntryAction>[0], "module" | "kind">, mod = module) =>
        start(async () => {
          await addEntryAction({ module: mod, kind, ...fields });
        }),
      update: (id: string, patch: Parameters<typeof updateEntryAction>[1]) =>
        start(async () => {
          await updateEntryAction(id, patch);
        }),
      remove: (id: string) =>
        start(async () => {
          await deleteEntryAction(id);
        }),
      schedule: (input: Parameters<typeof scheduleAction>[0]) =>
        start(async () => {
          await scheduleAction({ module, ...input });
        }),
    }),
    [module, start]
  );
  return { pending, ...api };
}

// --------------------------------------------------------------------------- layout

export function Block({
  title,
  hint,
  action,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`glass-card p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.95rem] font-semibold text-[var(--ink)]">{title}</h2>
          {hint && <p className="mt-0.5 text-xs leading-5 text-[var(--ink-faint)]">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Stats({ items }: { items: { label: string; value: string; sub?: string; tone?: "gold" | "plain" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="mod-stat">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--ink-faint)]">{s.label}</span>
          <span className={`mt-1 text-xl font-semibold tabular-nums ${s.tone === "gold" ? "text-[#f0cd79]" : "text-[var(--ink)]"}`}>
            {s.value}
          </span>
          {s.sub && <span className="text-[0.7rem] text-[var(--ink-dim)]">{s.sub}</span>}
        </div>
      ))}
    </div>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label?: string }) {
  const { pct: percent } = useModuleText();
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex justify-between text-xs text-[var(--ink-dim)]">
          <span>{label}</span>
          <span className="tabular-nums">{percent(Math.round(pct))}</span>
        </div>
      )}
      <div className="mod-meter" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** A tiny line of the last values, for logs (weight, sleep...). */
export function Sparkline({ points, height = 44 }: { points: number[]; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const w = 100;
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${height - 4 - ((p - min) / span) * (height - 8)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-11 w-full" aria-hidden>
      <polyline points={d} fill="none" stroke="#f0cd79" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Seven (or n) day bars: how much of a daily target each day reached. */
export function DayBars({ days, value, target, unit }: { days: string[]; value: (day: string) => number; target: number; unit: string }) {
  const { t, day: dayLabel } = useModuleText();
  return (
    <div className="flex items-end gap-1.5" aria-label={t.modulesB.kit.history}>
      {days.map((d) => {
        const v = value(d);
        const pct = Math.min(1, target ? v / target : 0);
        return (
          <div key={d} className="flex flex-1 flex-col items-center gap-1" title={fmt(t.modulesB.kit.dayValue, { day: dayLabel(d), v, unit })}>
            <div className="mod-bar">
              <span style={{ height: `${Math.max(pct * 100, v ? 6 : 0)}%` }} data-full={pct >= 1 || undefined} />
            </div>
            <span className="text-[0.62rem] uppercase text-[var(--ink-faint)]">{dayLabel(d, { weekday: "narrow" })}</span>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------- inputs

export const field = "glass-pill focus-ring min-w-0 px-3.5 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] [color-scheme:dark]";

export function IconButton({
  label,
  onClick,
  children,
  disabled,
  tone = "plain",
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  tone?: "plain" | "gold";
}) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`mod-icon focus-ring ${tone === "gold" ? "mod-icon-gold" : ""}`}>
      {children}
    </button>
  );
}

export function CheckBox({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange} disabled={disabled} className="check focus-ring" data-checked={checked || undefined}>
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

export function Counter({ value, onChange, min = 0, max = 99, unit }: { value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string }) {
  const { t } = useI18n();
  return (
    <div className="inline-flex items-center gap-2">
      <IconButton label={t.modulesB.kit.less} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <Minus size={14} />
      </IconButton>
      <span className="min-w-[3ch] text-center text-lg font-semibold tabular-nums text-[var(--ink)]">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-[var(--ink-dim)]">{unit}</span>}
      </span>
      <IconButton label={t.modulesB.kit.more} tone="gold" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <Plus size={14} />
      </IconButton>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-5 text-center text-xs text-[var(--ink-faint)]">{children}</p>;
}

/** "Planifier": pick a day and time and drop it on the personal calendar. */
export function ScheduleButton({
  title,
  notes,
  minutes = 60,
  today,
  onSchedule,
  label,
  defaultTime = "",
}: {
  title: string;
  notes?: string;
  minutes?: number;
  today: string;
  onSchedule: (input: { title: string; day: string; start: string | null; end: string | null; notes?: string | null }) => void;
  label?: string;
  /** Pre-filled time where one is obvious (a meal's usual hour). */
  defaultTime?: string;
}) {
  const { t } = useI18n();
  const k = t.modulesB.kit;
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today);
  // No time chosen in advance: the user picks it, so nothing lands on the calendar by accident.
  const [start, setStart] = useState(defaultTime);
  const [done, setDone] = useState(false);
  const end = useMemo(() => {
    if (!start) return "";
    const [h, m] = start.split(":").map(Number);
    const t = h * 60 + m + minutes;
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }, [start, minutes]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mod-chip focus-ring">
        {done ? <Check size={13} /> : <CalendarPlus size={13} />}
        {done ? k.scheduled : label ?? k.schedule}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${field} w-36`} aria-label={k.day} />
      <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${field} w-24`} aria-label={k.time} autoFocus />
      <IconButton
        label={k.addToCalendar}
        tone="gold"
        disabled={!start}
        onClick={() => {
          onSchedule({ title, day, start, end, notes });
          setOpen(false);
          setDone(true);
        }}
      >
        <Check size={14} />
      </IconButton>
      <IconButton label={t.common.cancel} onClick={() => setOpen(false)}>
        <X size={14} />
      </IconButton>
    </div>
  );
}

// --------------------------------------------------------------------------- lists

export interface FieldSpec {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "time" | "select";
  options?: string[];
  /** Where the value is stored: the row's own columns, or inside `data`. */
  to?: "text" | "value" | "day" | "data";
  width?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}

/**
 * The workhorse: a list of rows of one kind with an add form built from field specs, each
 * row checkable and removable. Most sections are some flavour of this.
 */
export function EntryList({
  module,
  kind,
  entries,
  fields,
  today,
  render,
  checkable = true,
  addLabel,
  empty,
  sort,
  extra,
}: {
  module: string;
  kind: string;
  entries: Entry[];
  fields: FieldSpec[];
  today: string;
  render: (e: Entry) => { title: React.ReactNode; sub?: React.ReactNode; aside?: React.ReactNode };
  checkable?: boolean;
  addLabel?: string;
  empty?: string;
  sort?: (a: Entry, b: Entry) => number;
  extra?: (e: Entry) => React.ReactNode;
}) {
  const { add, update, remove, pending } = useEntries(module);
  const { t, value: valueLabel } = useModuleText();
  const initial = () => Object.fromEntries(fields.map((f) => [f.key, f.defaultValue ?? (f.type === "date" ? today : f.type === "select" ? f.options?.[0] ?? "" : "")]));
  const [form, setForm] = useState<Record<string, string>>(initial);
  const rows = useMemo(() => {
    const list = entries.filter((e) => e.kind === kind);
    return sort ? [...list].sort(sort) : list;
  }, [entries, kind, sort]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (fields.some((f) => f.required && !form[f.key]?.trim())) return;
    const payload: { text?: string; value?: number | null; day?: string; data: Record<string, unknown> } = { data: {} };
    for (const f of fields) {
      const raw = form[f.key] ?? "";
      const v = f.type === "number" ? (raw === "" ? null : Number(raw)) : raw;
      const to = f.to ?? "data";
      if (to === "text") payload.text = String(v ?? "");
      else if (to === "value") payload.value = v === "" ? null : (v as number | null);
      else if (to === "day") payload.day = String(v || today);
      else payload.data[f.key] = v;
    }
    add(kind, payload);
    setForm(initial());
  }

  return (
    <div>
      <form onSubmit={submit} className="mb-3 flex flex-wrap items-center gap-2">
        {fields.map((f) =>
          f.type === "select" ? (
            <select
              key={f.key}
              aria-label={f.label}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className={`${field} ${f.width ?? "w-36"} cursor-pointer appearance-none`}
            >
              {f.options?.map((o) => (
                <option key={o} value={o}>
                  {valueLabel(o)}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={f.key}
              type={f.type}
              aria-label={f.label}
              placeholder={f.placeholder ?? f.label}
              value={form[f.key]}
              required={f.required}
              step={f.type === "number" ? "any" : undefined}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              className={`${field} ${f.width ?? (f.type === "text" ? "flex-1 basis-40" : "w-32")}`}
            />
          )
        )}
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          <Plus size={13} /> {addLabel ?? t.modulesB.kit.add}
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty>{empty ?? t.modulesB.kit.empty}</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => {
            const r = render(e);
            return (
              <li key={e.id} className={`tile flex items-center gap-3 px-3.5 py-2.5 ${checkable && e.done ? "opacity-55" : ""}`}>
                {checkable && <CheckBox checked={e.done} label={t.modulesB.kit.done} disabled={pending} onChange={() => update(e.id, { done: !e.done })} />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm text-[var(--ink)] ${checkable && e.done ? "line-through" : ""}`}>{r.title}</p>
                  {r.sub && <p className="mt-0.5 text-xs text-[var(--ink-dim)]">{r.sub}</p>}
                </div>
                {r.aside && <div className="shrink-0 text-xs text-[var(--ink-dim)]">{r.aside}</div>}
                {extra?.(e)}
                <IconButton label={t.common.delete} onClick={() => remove(e.id)} disabled={pending}>
                  <Trash2 size={13} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * A routine ticked off day by day (the five prayers, brushing...). Each tick is a row of
 * kind "check" with data.item, so history and streaks come for free.
 */
export function DailyChecklist({
  module,
  entries,
  today,
  items,
}: {
  module: string;
  entries: Entry[];
  today: string;
  items: { key: string; label: string; sub?: string }[];
}) {
  const { add, remove, pending } = useEntries(module);
  const { t } = useI18n();
  const ticks = entries.filter((e) => e.kind === "check");
  const tickOf = (day: string, key: string) => ticks.find((t) => t.day === day && t.data.item === key);
  const doneOn = (day: string) => items.filter((i) => tickOf(day, i.key)).length;
  const run = streak(today, (d) => doneOn(d) === items.length);

  return (
    <div>
      <ul className="space-y-2">
        {items.map((i) => {
          const t = tickOf(today, i.key);
          return (
            <li key={i.key} className={`tile flex items-center gap-3 px-3.5 py-2.5 ${t ? "opacity-70" : ""}`}>
              <CheckBox
                checked={!!t}
                label={i.label}
                disabled={pending}
                onChange={() => (t ? remove(t.id) : add("check", { day: today, data: { item: i.key } }))}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--ink)]">{i.label}</p>
                {i.sub && <p className="mt-0.5 text-xs text-[var(--ink-dim)]">{i.sub}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4">
        <DayBars days={lastDays(today, 7)} value={doneOn} target={items.length} unit={`/ ${items.length}`} />
        <p className="mt-2 text-xs text-[var(--ink-dim)]">
          {run > 1 ? fmt(t.modulesB.kit.streakMany, { n: run }) : run === 1 ? t.modulesB.kit.streakOne : t.modulesB.kit.streakStart}
        </p>
      </div>
    </div>
  );
}

export function Sources({ items, health }: { items: readonly string[]; health?: boolean }) {
  const { t } = useI18n();
  return (
    <footer className="mt-6 text-[0.7rem] leading-5 text-[var(--ink-faint)]">
      <p className="font-semibold uppercase tracking-wide">{t.modulesB.kit.sources}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {health && <p className="mt-2">{t.modulesB.kit.health}</p>}
    </footer>
  );
}

/**
 * Things that come round again (a dentist visit, changing the sheets): each row has a
 * period in days (value) and the day it was last done (data.last); what is due floats up.
 */
export function RecurringList({
  module,
  entries,
  today,
  suggestions = [],
  periods: periodsProp,
}: {
  module: string;
  entries: Entry[];
  today: string;
  suggestions?: { text: string; period: number }[];
  periods?: [string, number][];
}) {
  const { add, update, remove, pending } = useEntries(module);
  const { t, day: dayLabel } = useModuleText();
  const k = t.modulesB.kit;
  const periods: [string, number][] = periodsProp ?? [
    [k.daily, 1],
    [k.weekly, 7],
    [k.biweekly, 14],
    [k.monthly, 30],
    [k.quarterly, 91],
    [k.halfYearly, 182],
    [k.yearly, 365],
  ];
  const [text, setText] = useState("");
  const [period, setPeriod] = useState(String(periods[1][1]));
  const rows = entries
    .filter((e) => e.kind === "recurring")
    .map((e) => {
      const last = (e.data.last as string | undefined) ?? null;
      const due = last ? addDays(last, e.value ?? 7) : today;
      return { e, last, late: daysBetween(today, due) };
    })
    .sort((a, b) => a.late - b.late);
  const missing = suggestions.filter((s) => !rows.some((r) => r.e.text === s.text));
  const periodName = (n: number) => periods.find(([, d]) => d === n)?.[0] ?? fmt(k.everyNDays, { n });

  return (
    <div>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!text.trim()) return;
          add("recurring", { text, value: Number(period), data: { last: null } });
          setText("");
        }}
        className="mb-3 flex flex-wrap items-center gap-2"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={k.newRecurring} aria-label={k.task} className={`${field} flex-1 basis-40`} />
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={k.frequency} className={`${field} w-44 cursor-pointer appearance-none`}>
          {periods.map(([l, d]) => (
            <option key={d} value={d}>
              {l}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          <Plus size={13} /> {k.add}
        </button>
      </form>

      {missing.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {missing.map((s) => (
            <button key={s.text} type="button" disabled={pending} onClick={() => add("recurring", { text: s.text, value: s.period, data: { last: null } })} className="mod-chip focus-ring">
              <Plus size={12} /> {s.text}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <Empty>{k.recurringEmpty}</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ e, last, late }) => (
            <li key={e.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--ink)]">{e.text}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
                  {periodName(e.value ?? 7)} · {last ? fmt(k.doneOn, { day: dayLabel(last) }) : k.neverDone}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-semibold ${late <= 0 ? "text-[#f0cd79]" : "text-[var(--ink-faint)]"}`}>
                {late < 0 ? fmt(k.lateBy, { n: -late }) : late === 0 ? k.today : fmt(k.inDays, { n: late })}
              </span>
              <button type="button" disabled={pending} onClick={() => update(e.id, { data: { last: today } })} className="mod-chip focus-ring">
                <Check size={13} /> {k.done}
              </button>
              <IconButton label={t.common.delete} onClick={() => remove(e.id)} disabled={pending}>
                <Trash2 size={13} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
