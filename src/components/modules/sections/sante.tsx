"use client";

import { useMemo, useState } from "react";
import { Moon, Plus, Trash2 } from "lucide-react";
import {
  Block,
  DailyChecklist,
  DayBars,
  Empty,
  IconButton,
  Meter,
  RecurringList,
  ScheduleButton,
  Sparkline,
  Stats,
  addDays,
  daysBetween,
  field,
  lastDays,
  useEntries,
  type Entry,
  type ModuleProps,
} from "@/components/modules/kit";
import { ProgramBuilder, StrengthLog } from "@/components/modules/sections/sport-extra";
import { WorkoutPlanner } from "@/components/modules/sections/WorkoutPlanner";
import { useI18n } from "@/i18n/client";
import { INTL, fmt, type Locale } from "@/i18n/config";
import { modulesA } from "@/i18n/ns/modulesA";

/** French strings: what new rows store, whatever language the app speaks. */
const FR = modulesA.fr;

/** A calendar day ("2026-10-09") in the reader's language. The day has no time, hence UTC. */
const dayIn = (locale: Locale, iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", ...opts }).format(new Date(`${iso}T12:00:00Z`));
const dec = (x: number, digits: number, locale: Locale) => x.toLocaleString(INTL[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (x: number, digits: number, locale: Locale) => `${x >= 0 ? "+" : "−"}${dec(Math.abs(x), digits, locale)}`;

// =========================================================================== Sport

type SportId = keyof typeof FR.sports;
type ProgramId = keyof typeof FR.programs;
type MuscleKey = Exclude<keyof typeof FR.muscles, "all">;
type LevelKey = keyof typeof FR.levels;

/**
 * Energy cost of activities in METs, from the Compendium of Physical Activities
 * (Ainsworth et al., 2011). kcal ≈ MET × body mass (kg) × hours.
 */
const SPORTS: { id: SportId; met: number; minutes: number }[] = [
  { id: "run", met: 9.8, minutes: 40 },
  { id: "walk", met: 4.3, minutes: 45 },
  { id: "bike", met: 8.0, minutes: 60 },
  { id: "swim", met: 5.8, minutes: 45 },
  { id: "soccer", met: 7.0, minutes: 90 },
  { id: "tennis", met: 8.0, minutes: 60 },
  { id: "basketball", met: 6.5, minutes: 60 },
  { id: "badminton", met: 5.5, minutes: 60 },
  { id: "volleyball", met: 4.0, minutes: 60 },
  { id: "rope", met: 11.8, minutes: 15 },
  { id: "rower", met: 7.0, minutes: 30 },
  { id: "hike", met: 6.0, minutes: 120 },
  { id: "boxing", met: 5.5, minutes: 45 },
  { id: "dance", met: 7.3, minutes: 45 },
  { id: "yoga", met: 2.5, minutes: 45 },
];

const EXERCISES: { id: keyof typeof FR.exercises; muscle: MuscleKey }[] = [
  { id: "pushups", muscle: "chest" },
  { id: "bench", muscle: "chest" },
  { id: "dips", muscle: "chest" },
  { id: "pullups", muscle: "back" },
  { id: "row", muscle: "back" },
  { id: "deadlift", muscle: "back" },
  { id: "squat", muscle: "legs" },
  { id: "lunges", muscle: "legs" },
  { id: "rdl", muscle: "legs" },
  { id: "glute", muscle: "legs" },
  { id: "calves", muscle: "legs" },
  { id: "ohp", muscle: "shoulders" },
  { id: "lateral", muscle: "shoulders" },
  { id: "curl", muscle: "arms" },
  { id: "triceps", muscle: "arms" },
  { id: "plank", muscle: "core" },
  { id: "sidePlank", muscle: "core" },
  { id: "deadBug", muscle: "core" },
  { id: "burpees", muscle: "cardio" },
  { id: "climbers", muscle: "cardio" },
  { id: "jacks", muscle: "cardio" },
];

const MUSCLES: ("all" | MuscleKey)[] = ["all", "chest", "back", "legs", "shoulders", "arms", "core", "cardio"];

/** Ready-made sessions. MET: resistance training 3.5 (moderate) / 6.0 (vigorous), circuit 8.0. */
const PROGRAMS: { id: ProgramId; minutes: number; met: number; strength: boolean; level: LevelKey }[] = [
  { id: "fullBody", minutes: 35, met: 3.5, strength: true, level: "beginner" },
  { id: "hiit", minutes: 20, met: 8.0, strength: false, level: "intermediate" },
  { id: "upper", minutes: 50, met: 6.0, strength: true, level: "intermediate" },
  { id: "lower", minutes: 50, met: 6.0, strength: true, level: "intermediate" },
  { id: "mobility", minutes: 15, met: 2.5, strength: false, level: "all" },
];

const DEFAULT_KG = 70;

/** WHO counts vigorous minutes double against the 150-minute moderate target. */
const equivalentMinutes = (minutes: number, met: number) => (met >= 6 ? 2 : met >= 3 ? 1 : 0) * minutes;
const kcal = (met: number, kg: number, minutes: number) => Math.round(met * kg * (minutes / 60));

function weekStart(today: string) {
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(today, -dow);
}

export function Sport({ module, today, entries, related }: ModuleProps) {
  const { t, locale } = useI18n();
  const m = t.modulesA;
  const { add, remove, schedule, pending } = useEntries(module);
  const weightRow = (related["sante:corps"] ?? []).find((e) => e.kind === "weight" && e.value);
  const kg = weightRow?.value ?? DEFAULT_KG;
  const [muscle, setMuscle] = useState<"all" | MuscleKey>("all");
  const [activity, setActivity] = useState<string>(SPORTS[0].id);
  const [minutes, setMinutes] = useState("45");
  const [day, setDay] = useState(today);

  const workouts = entries.filter((e) => e.kind === "workout");
  const monday = weekStart(today);
  const week = workouts.filter((w) => w.day >= monday && w.day <= today);
  const eq = week.reduce((s, w) => s + equivalentMinutes(w.value ?? 0, Number(w.data.met ?? 0)), 0);
  const strengthDays = new Set(week.filter((w) => w.data.strength).map((w) => w.day)).size;
  const weekKcal = week.reduce((s, w) => s + kcal(Number(w.data.met ?? 0), kg, w.value ?? 0), 0);

  // Rows keep the French name (as they always have); the reader sees it in their language.
  const options = [
    ...PROGRAMS.map((p) => ({ id: p.id as string, stored: FR.programs[p.id].name, label: m.programs[p.id].name, met: p.met, strength: p.strength, minutes: p.minutes })),
    ...SPORTS.map((s) => ({ id: s.id as string, stored: FR.sports[s.id], label: m.sports[s.id], met: s.met, strength: false, minutes: s.minutes })),
  ];
  const shown = (text: string | null) => options.find((o) => o.stored === text)?.label ?? text ?? "";
  const log = (stored: string, met: number, mins: number, strength: boolean, on = today) =>
    add("workout", { day: on, text: stored, value: mins, data: { met, strength } });

  return (
    <>
      <Block title={m.sport.weekTitle} hint={m.sport.weekHint} wide>
        <Stats
          items={[
            { label: m.sport.statMinutes, value: `${eq}`, sub: m.sport.statMinutesSub, tone: "gold" },
            { label: m.sport.statSessions, value: `${week.length}` },
            { label: m.sport.statStrength, value: fmt(m.sport.statStrengthValue, { n: strengthDays }) },
            {
              label: m.sport.statEnergy,
              value: `${weekKcal.toLocaleString(INTL[locale])} kcal`,
              sub: weightRow ? fmt(m.sport.forKg, { kg }) : fmt(m.sport.forKgDefault, { kg: DEFAULT_KG }),
            },
          ]}
        />
        <div className="mt-4">
          <Meter value={eq} max={150} label={m.sport.whoGoal} />
        </div>
      </Block>

      <Block title={m.sport.logTitle} hint={m.sport.logHint}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const o = options.find((x) => x.id === activity)!;
            log(o.stored, o.met, Number(minutes) || o.minutes, o.strength, day);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <select
            value={activity}
            onChange={(e) => {
              setActivity(e.target.value);
              setMinutes(String(options.find((x) => x.id === e.target.value)?.minutes ?? 45));
            }}
            aria-label={m.sport.activity}
            className={`${field} flex-1 basis-52 cursor-pointer appearance-none`}
          >
            <optgroup label={m.sport.programsGroup}>
              {PROGRAMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {m.programs[p.id].name}
                </option>
              ))}
            </optgroup>
            <optgroup label={m.sport.sportsGroup}>
              {SPORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {m.sports[s.id]}
                </option>
              ))}
            </optgroup>
          </select>
          <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label={m.sport.minutesAria} className={`${field} w-24`} />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={m.sport.day} className={`${field} w-36`} />
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> {t.common.save}
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {workouts.slice(0, 6).map((w) => (
            <li key={w.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--ink)]">{shown(w.text)}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
                  {fmt(m.sport.workoutLine, { day: dayIn(locale, w.day), min: w.value ?? 0, kcal: kcal(Number(w.data.met ?? 0), kg, w.value ?? 0) })}
                </p>
              </div>
              <IconButton label={t.common.delete} onClick={() => remove(w.id)} disabled={pending}>
                <Trash2 size={13} />
              </IconButton>
            </li>
          ))}
          {workouts.length === 0 && <Empty>{m.sport.noWorkouts}</Empty>}
        </ul>
      </Block>

      <StrengthLog module={module} today={today} entries={entries} exercises={EXERCISES.filter((x) => x.muscle !== "cardio").map((x) => m.exercises[x.id].name)} />
      <WorkoutPlanner />

      <ProgramBuilder module={module} today={today} entries={entries} />

      <Block title={m.sport.programsTitle} hint={m.sport.programsHint}>
        <ul className="space-y-2.5">
          {PROGRAMS.map((p) => {
            const name = m.programs[p.id].name;
            const steps = m.programs[p.id].steps.split("|");
            return (
              <li key={p.id} className="tile px-3.5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{name}</p>
                    <p className="text-xs text-[var(--ink-dim)]">{fmt(m.sport.programLine, { min: p.minutes, level: m.levels[p.level], kcal: kcal(p.met, kg, p.minutes) })}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-[var(--ink-dim)]">{steps.join(" · ")}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <ScheduleButton title={fmt(m.sport.sessionTitle, { name })} notes={steps.join("\n")} minutes={p.minutes} today={today} onSchedule={schedule} />
                  <button type="button" disabled={pending} onClick={() => log(FR.programs[p.id].name, p.met, p.minutes, p.strength)} className="mod-chip focus-ring">
                    {m.sport.doneToday}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Block>

      <Block title={m.sport.sportsTitle} hint={fmt(m.sport.sportsHint, { kg })}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SPORTS.map((s) => (
            <li key={s.id} className="tile flex flex-col gap-2 px-3.5 py-3">
              <div>
                <p className="text-sm text-[var(--ink)]">{m.sports[s.id]}</p>
                <p className="text-xs text-[var(--ink-dim)]">{fmt(m.sport.perHour, { met: s.met.toLocaleString(INTL[locale]), kcal: kcal(s.met, kg, 60) })}</p>
              </div>
              <ScheduleButton title={m.sports[s.id]} minutes={s.minutes} today={today} onSchedule={schedule} />
            </li>
          ))}
        </ul>
      </Block>

      <Block title={m.sport.libraryTitle} hint={m.sport.libraryHint} wide>
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
          {MUSCLES.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === muscle} data-on={k === muscle || undefined} onClick={() => setMuscle(k)} className="mod-tab focus-ring">
              {m.muscles[k]}
            </button>
          ))}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXERCISES.filter((x) => muscle === "all" || x.muscle === muscle).map((x) => (
            <li key={x.id} className="tile px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink)]">{m.exercises[x.id].name}</p>
                <span className="shrink-0 text-xs tabular-nums text-[#f0cd79]">{m.exercises[x.id].dose}</span>
              </div>
              <p className="text-[0.7rem] uppercase tracking-wide text-[var(--ink-faint)]">{m.muscles[x.muscle]}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">{m.exercises[x.id].cue}</p>
            </li>
          ))}
        </ul>
      </Block>
    </>
  );
}

// =========================================================================== Corps

function LogBlock({
  module,
  entries,
  today,
  kind,
  title,
  hint,
  unit,
  step = "0.1",
  describe,
}: {
  module: string;
  entries: Entry[];
  today: string;
  kind: string;
  title: string;
  hint?: string;
  unit: string;
  step?: string;
  describe?: (v: number) => string;
}) {
  const { t, locale } = useI18n();
  const { add, remove, pending } = useEntries(module);
  const [v, setV] = useState("");
  const rows = entries.filter((e) => e.kind === kind && e.value != null);
  const last = rows[0];
  const series = [...rows].reverse().slice(-30).map((r) => r.value!);
  const first30 = series[0];

  return (
    <Block title={title} hint={hint}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tabular-nums text-[var(--ink)]">
            {last ? last.value!.toLocaleString(INTL[locale]) : "—"}
            <span className="ml-1 text-sm font-normal text-[var(--ink-dim)]">{unit}</span>
          </p>
          <p className="text-xs text-[var(--ink-dim)]">
            {last ? `${dayIn(locale, last.day)}${describe ? ` · ${describe(last.value!)}` : ""}` : t.modulesA.corps.noMeasure}
            {series.length > 1 && first30 !== undefined && ` · ${fmt(t.modulesA.corps.overPeriod, { delta: signed(last!.value! - first30, 1, locale), unit })}`}
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!v) return;
            add(kind, { day: today, value: Number(v) });
            setV("");
          }}
          className="flex items-center gap-2"
        >
          <input type="number" step={step} value={v} onChange={(e) => setV(e.target.value)} placeholder={unit} aria-label={title} className={`${field} w-24`} />
          <IconButton label={t.modulesA.corps.addMeasure} tone="gold" onClick={() => v && (add(kind, { day: today, value: Number(v) }), setV(""))} disabled={pending}>
            <Plus size={14} />
          </IconButton>
        </form>
      </div>
      <div className="mt-3">
        <Sparkline points={series} />
      </div>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {rows.slice(0, 4).map((r) => (
            <li key={r.id} className="flex items-center justify-between text-xs text-[var(--ink-dim)]">
              <span>{dayIn(locale, r.day)}</span>
              <span className="flex items-center gap-2 tabular-nums text-[var(--ink)]">
                {r.value!.toLocaleString(INTL[locale])} {unit}
                <button type="button" onClick={() => remove(r.id)} aria-label={t.common.delete} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                  <Trash2 size={12} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

/**
 * Highlights, after Apple Health: every number already recorded elsewhere in Santé, this
 * week against last, said in a sentence. Nothing to type here.
 */
function HealthSummary({ today, entries, related }: { today: string; entries: Entry[]; related: Record<string, Entry[]> }) {
  const { t, locale } = useI18n();
  const c = t.modulesA.corps;
  const sport = (related["sante:sport"] ?? []).filter((e) => e.kind === "workout");
  const sleep = (related["sante:sommeil"] ?? []).filter((e) => e.kind === "sleep" && e.value != null);
  const water = (related["sante:nutrition"] ?? []).filter((e) => e.kind === "water");
  const hygiene = (related["sante:hygiene"] ?? []).filter((e) => e.kind === "check");
  const inWeek = (d: string, back: number) => {
    const age = daysBetween(d, today);
    return age >= back * 7 && age < back * 7 + 7;
  };
  const sum = (list: Entry[], back: number, f: (e: Entry) => number) => list.filter((e) => inWeek(e.day, back)).reduce((a, e) => a + f(e), 0);
  const avg = (list: Entry[], back: number) => {
    const xs = list.filter((e) => inWeek(e.day, back));
    return xs.length ? xs.reduce((a, e) => a + (e.value ?? 0), 0) / xs.length : null;
  };
  const minutes = [0, 1].map((b) => sum(sport, b, (w) => equivalentMinutes(w.value ?? 0, Number(w.data.met ?? 0))));
  const nights = [0, 1].map((b) => avg(sleep, b));
  const glasses = [0, 1].map((b) => avg(water, b));
  const weights = entries.filter((e) => e.kind === "weight" && e.value != null);
  const w30 = weights.filter((w) => daysBetween(w.day, today) <= 30);
  const hygieneDays = new Set(hygiene.filter((h) => inWeek(h.day, 0)).map((h) => h.day)).size;

  const trend = (a: number | null, b: number | null, unit: string, digits = 0) => {
    if (a == null || b == null || b === 0) return null;
    const d = a - b;
    if (Math.abs(d) < 0.05) return t.modulesA.stableVsLastWeek;
    return fmt(t.modulesA.vsLastWeek, { arrow: d > 0 ? "▲" : "▼", n: dec(Math.abs(d), digits, locale), unit });
  };
  const cards = [
    {
      key: "activity",
      title: c.activity,
      value: fmt(t.modulesA.minutes, { n: minutes[0] }),
      sub: fmt(c.whoShare, { n: Math.min(100, Math.round((minutes[0] / 150) * 100)) }),
      note: trend(minutes[0], minutes[1], "min"),
      color: "#ef4444",
    },
    {
      key: "sleep",
      title: c.sleep,
      value: nights[0] != null ? fmt(t.modulesA.hoursMinutes, { h: Math.floor(nights[0]), m: String(Math.round((nights[0] % 1) * 60)).padStart(2, "0") }) : "—",
      sub: nights[0] != null ? (nights[0] >= 7 ? c.sleepOk : c.sleepLow) : c.sleepEmpty,
      note: nights[0] != null && nights[1] != null ? trend(nights[0] * 60, nights[1] * 60, "min") : null,
      color: "#8b5cf6",
    },
    {
      key: "hydration",
      title: c.hydration,
      value: glasses[0] != null ? `${dec((glasses[0] * 250) / 1000, 1, locale)} L` : "—",
      sub: c.hydrationSub,
      note: glasses[0] != null && glasses[1] != null ? trend(glasses[0] * 0.25, glasses[1] * 0.25, "L", 1) : null,
      color: "#3b82f6",
    },
    {
      key: "weight",
      title: c.weight,
      value: weights[0]?.value != null ? `${weights[0].value.toLocaleString(INTL[locale])} kg` : "—",
      sub: w30.length > 1 ? fmt(c.weight30, { delta: signed(w30[0].value! - w30[w30.length - 1].value!, 1, locale) }) : c.weightEmpty,
      note: null,
      color: "#f0cd79",
    },
    {
      key: "hygiene",
      title: c.hygiene,
      value: fmt(c.hygieneValue, { n: hygieneDays }),
      sub: c.hygieneSub,
      note: null,
      color: "#10b981",
    },
  ];
  return (
    <Block title={c.summaryTitle} hint={c.summaryHint} wide>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.key} className="mod-stat" style={{ boxShadow: `inset 3px 0 0 ${card.color}, inset 0 1px 0 rgba(255,226,158,0.12)` }}>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide" style={{ color: card.color }}>
              {card.title}
            </span>
            <span className="mt-1 text-2xl font-semibold tabular-nums text-[var(--ink)]">{card.value}</span>
            <span className="text-xs text-[var(--ink-dim)]">{card.sub}</span>
            {card.note && <span className="mt-1 text-[0.7rem] text-[var(--ink-faint)]">{card.note}</span>}
          </li>
        ))}
      </ul>
    </Block>
  );
}

export function Corps({ module, today, entries, related }: ModuleProps) {
  const { t, locale } = useI18n();
  const c = t.modulesA.corps;
  const { add, pending } = useEntries(module);
  const height = entries.find((e) => e.kind === "height")?.value ?? null;
  const weight = entries.find((e) => e.kind === "weight")?.value ?? null;
  const [h, setH] = useState(height ? String(height) : "");
  const bmi = height && weight ? weight / (height / 100) ** 2 : null;
  const bmiClass = (b: number) => (b < 18.5 ? c.underweight : b < 25 ? c.normal : b < 30 ? c.overweight : c.obesity);
  const ranges = c.bmiRanges.split("|");
  const bands = [c.underweightShort, c.normalShort, c.overweight, c.obesity];

  return (
    <>
      <HealthSummary today={today} entries={entries} related={related} />
      <Block title={c.bmiTitle} hint={c.bmiHint} wide>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-[#f0cd79]">{bmi ? dec(bmi, 1, locale) : "—"}</p>
            <p className="text-xs text-[var(--ink-dim)]">{bmi ? bmiClass(bmi) : c.bmiEmpty}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (h) add("height", { day: today, value: Number(h) });
            }}
            className="flex items-center gap-2"
          >
            <input type="number" value={h} onChange={(e) => setH(e.target.value)} placeholder={c.heightPlaceholder} aria-label={c.heightAria} className={`${field} w-32`} />
            <button type="submit" disabled={pending} className="mod-chip focus-ring">
              {t.common.save}
            </button>
          </form>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[0.68rem] text-[var(--ink-dim)]">
          {ranges.map((r, i) => {
            const on = bmi != null && [bmi < 18.5, bmi >= 18.5 && bmi < 25, bmi >= 25 && bmi < 30, bmi >= 30][i];
            return (
              <div key={r} className={`rounded-lg px-1 py-2 ${on ? "bg-[rgba(240,205,121,0.18)] text-[var(--ink)]" : "bg-[rgba(255,220,148,0.05)]"}`}>
                <p className="font-semibold tabular-nums">{r}</p>
                <p>{bands[i]}</p>
              </div>
            );
          })}
        </div>
      </Block>

      <LogBlock module={module} entries={entries} today={today} kind="weight" title={c.weight} unit="kg" hint={c.weightHint} />
      <LogBlock
        module={module}
        entries={entries}
        today={today}
        kind="hr"
        title={c.hrTitle}
        unit="bpm"
        step="1"
        hint={c.hrHint}
        describe={(v) => (v < 60 ? c.hrLow : v <= 100 ? c.hrNormal : c.hrHigh)}
      />
      <LogBlock module={module} entries={entries} today={today} kind="waist" title={c.waistTitle} unit="cm" hint={c.waistHint} />
    </>
  );
}

// =========================================================================== Sommeil

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const clock = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function Sommeil({ module, today, entries }: ModuleProps) {
  const { t, locale } = useI18n();
  const z = t.modulesA.sommeil;
  const hours = (h: number) => fmt(t.modulesA.hoursMinutes, { h: Math.floor(h), m: String(Math.round((h % 1) * 60)).padStart(2, "0") });
  const { add, remove, schedule, pending } = useEntries(module);
  const [bed, setBed] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [target, setTarget] = useState("07:00");
  const nights = entries.filter((e) => e.kind === "sleep" && e.value != null);
  const week = nights.filter((n) => daysBetween(n.day, today) < 7);
  const avg = week.length ? week.reduce((s, n) => s + n.value!, 0) / week.length : 0;
  const enough = week.filter((n) => n.value! >= 7).length;
  // Regularity: spread of bedtimes, unwrapped around midnight.
  const spread = useMemo(() => {
    const beds = week.map((n) => {
      const m = toMin(String(n.data.bed ?? "23:00"));
      return m < 12 * 60 ? m + 1440 : m;
    });
    if (beds.length < 2) return null;
    const mean = beds.reduce((a, b) => a + b, 0) / beds.length;
    return Math.round(Math.sqrt(beds.reduce((s, b) => s + (b - mean) ** 2, 0) / beds.length));
  }, [week]);
  const duration = ((toMin(wake) - toMin(bed) + 1440) % 1440) / 60;
  // Bedtimes for 5 or 6 full 90-minute cycles, allowing ~15 minutes to fall asleep.
  const bedtimes = [6, 5].map((c) => clock(toMin(target) - c * 90 - 15));
  const tips = Object.values(z.tips);

  return (
    <>
      <Block title={z.weekTitle} hint={z.weekHint} wide>
        <Stats
          items={[
            { label: z.average, value: week.length ? hours(avg) : "—", sub: z.last7, tone: "gold" },
            { label: z.nights7, value: `${enough} / ${week.length}` },
            { label: z.regularity, value: spread == null ? "—" : `± ${spread} min`, sub: z.regularitySub },
            { label: z.nightsLogged, value: `${nights.length}` },
          ]}
        />
        <div className="mt-4">
          <DayBars days={lastDays(today, 7)} value={(d) => nights.find((n) => n.day === d)?.value ?? 0} target={8} unit="h" />
        </div>
      </Block>

      <Block title={z.logTitle} hint={z.logHint}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add("sleep", { day: today, value: Math.round(duration * 100) / 100, data: { bed, wake } });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            {z.bed}
            <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={`${field} w-28`} />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            {z.wake}
            <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={`${field} w-28`} />
          </label>
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Moon size={13} /> {hours(duration)}
          </button>
        </form>
        {nights.length === 0 ? (
          <div className="mt-4">
            <Empty>{z.empty}</Empty>
          </div>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {nights.slice(0, 7).map((n) => (
              <li key={n.id} className="flex items-center justify-between text-xs text-[var(--ink-dim)]">
                <span>
                  {dayIn(locale, n.day)} · {String(n.data.bed ?? "")} → {String(n.data.wake ?? "")}
                </span>
                <span className="flex items-center gap-2 tabular-nums text-[var(--ink)]">
                  {hours(n.value!)}
                  <button type="button" onClick={() => remove(n.id)} aria-label={t.common.delete} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                    <Trash2 size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={z.bedtimeTitle} hint={z.bedtimeHint}>
        <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
          {z.wantWake}
          <input type="time" value={target} onChange={(e) => setTarget(e.target.value)} className={`${field} w-28`} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {bedtimes.map((b, i) => (
            <div key={b} className="mod-stat">
              <span className="text-2xl font-semibold tabular-nums text-[#f0cd79]">{b}</span>
              <span className="text-xs text-[var(--ink-dim)]">{i === 0 ? z.cycles6 : z.cycles5}</span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <ScheduleButton title={z.bedEvent} minutes={15} today={today} onSchedule={(x) => schedule({ ...x, start: bedtimes[1], end: clock(toMin(bedtimes[1]) + 15) })} label={z.addBedtime} />
        </div>
      </Block>

      <Block title={z.tipsTitle} hint={z.tipsHint} wide>
        <ul className="grid gap-2 sm:grid-cols-2">
          {tips.map((tip) => (
            <li key={tip.title} className="tile px-3.5 py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{tip.title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">{tip.text}</p>
            </li>
          ))}
        </ul>
      </Block>
    </>
  );
}

// =========================================================================== Hygiène

type RenewKey = "toothbrush" | "dentist" | "sheets" | "towels" | "haircut";
const RENEW: { key: RenewKey; period: number }[] = [
  { key: "toothbrush", period: 91 },
  { key: "dentist", period: 182 },
  { key: "sheets", period: 7 },
  { key: "towels", period: 7 },
  { key: "haircut", period: 30 },
];

export function Hygiene({ module, today, entries }: ModuleProps) {
  const { t } = useI18n();
  const y = t.modulesA.hygiene;
  // A suggestion already added, in either language, is not offered again.
  const have = new Set(entries.filter((e) => e.kind === "recurring").map((e) => e.text));
  const suggestions = RENEW.filter((r) => !have.has(modulesA.fr.hygiene[r.key]) && !have.has(modulesA.en.hygiene[r.key])).map((r) => ({ text: y[r.key], period: r.period }));
  return (
    <>
      <Block title={y.routineTitle} hint={y.routineHint}>
        <DailyChecklist
          module={module}
          entries={entries}
          today={today}
          items={[
            { key: "brush-am", label: y.brushAm, sub: y.brushAmSub },
            { key: "brush-pm", label: y.brushPm, sub: y.brushPmSub },
            { key: "floss", label: y.floss, sub: y.flossSub },
            { key: "shower", label: y.shower },
            { key: "skin", label: y.skin, sub: y.skinSub },
            { key: "hands", label: y.hands, sub: y.handsSub },
          ]}
        />
      </Block>

      <Block title={y.renewTitle} hint={y.renewHint}>
        <RecurringList
          module={module}
          entries={entries}
          today={today}
          suggestions={suggestions}
          periods={[
            [y.daily, 1],
            [y.weekly, 7],
            [y.biweekly, 14],
            [y.monthly, 30],
            [y.quarterly, 91],
            [y.halfYearly, 182],
            [y.yearly, 365],
          ]}
        />
      </Block>
    </>
  );
}

export const SANTE_SOURCES = {
  sport: [
    "OMS, Lignes directrices sur l'activité physique et la sédentarité (2020).",
    "Ainsworth B.E. et al., 2011 Compendium of Physical Activities, Med Sci Sports Exerc 43(8).",
  ],
  corps: [
    "OMS, Classification de l'IMC chez l'adulte ; OMS, Waist circumference and waist-hip ratio (2008).",
    "American Heart Association, fréquence cardiaque au repos de l'adulte.",
  ],
  sommeil: [
    "Watson N.F. et al., Recommended Amount of Sleep for a Healthy Adult, AASM/SRS (2015).",
    "Hirshkowitz M. et al., National Sleep Foundation's sleep time duration recommendations (2015).",
    "Drake C. et al., Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed, J Clin Sleep Med (2013).",
  ],
  hygiene: [
    "American Dental Association, brossage 2 × 2 min/jour, nettoyage interdentaire quotidien, brosse changée tous les 3–4 mois.",
    "CDC, lavage des mains de 20 secondes ; American Academy of Dermatology, écran solaire FPS 30+.",
  ],
};
