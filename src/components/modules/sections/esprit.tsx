"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, LocateFixed, Pause, Play, Plus, Trash2 } from "lucide-react";
import {
  Block,
  DailyChecklist,
  DayBars,
  Empty,
  EntryList,
  IconButton,
  Meter,
  Stats,
  addDays,
  field,
  lastDays,
  streak,
  useEntries,
  type ModuleProps,
} from "@/components/modules/kit";
import { METHODS, PRAYERS, atUtcHour, prayerTimes, qibla, type PrayerKey } from "@/lib/prayer";
import { useI18n } from "@/i18n/client";
import { INTL, fmt, type Locale } from "@/i18n/config";
import { modulesA } from "@/i18n/ns/modulesA";
import { currentZone } from "@/lib/dates";

/** A calendar day ("2026-10-09") in the reader's language. The day has no time, hence UTC. */
const dayIn = (locale: Locale, iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat(INTL[locale], { timeZone: "UTC", ...opts }).format(new Date(`${iso}T12:00:00Z`));

// =========================================================================== Prière

/** Where times are computed until the person shares their location (later: from their settings). */
const OTTAWA = { lat: 45.4215, lng: -75.6972, city: "Ottawa" };
/** Stored as the city when the browser gave the location (kept in French: it is data). */
const MY_POSITION = "Ma position";
const hhmm = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

export function Priere({ module, today, entries }: ModuleProps) {
  const { t, locale } = useI18n();
  const pr = t.modulesA.priere;
  const { add, update, pending } = useEntries(module);
  const settings = entries.find((e) => e.kind === "settings");
  const s = {
    lat: Number(settings?.data.lat ?? OTTAWA.lat),
    lng: Number(settings?.data.lng ?? OTTAWA.lng),
    city: String(settings?.data.city ?? OTTAWA.city),
    method: String(settings?.data.method ?? "ISNA"),
    asr: (Number(settings?.data.asr ?? 1) === 2 ? 2 : 1) as 1 | 2,
  };
  const save = (patch: Record<string, unknown>) =>
    settings ? update(settings.id, { data: patch }) : add("settings", { data: { ...s, ...patch } });
  const method = METHODS.find((m) => m.key === s.method) ?? METHODS[0];
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || currentZone(), []);
  const city = s.city === MY_POSITION ? pr.myPosition : s.city;
  const prayerName = (p: (typeof PRAYERS)[number], short = false) => (p.key === "sunrise" ? (short ? pr.sunriseShort : pr.sunrise) : p.label);
  const methodName = (key: string, fallback: string) => (key in pr.methods ? pr.methods[key as keyof typeof pr.methods] : fallback);
  const direction = (deg: number) => pr.directions.split("|")[Math.round(deg / 45) % 8];
  const [geoNote, setGeoNote] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const times = prayerTimes(today, s.lat, s.lng, method, s.asr);
  const dates = Object.fromEntries(PRAYERS.map((p) => [p.key, atUtcHour(today, times[p.key])])) as Record<PrayerKey, Date>;
  const next = PRAYERS.filter((p) => p.key !== "sunrise").find((p) => dates[p.key].getTime() > now);
  const until = next ? Math.max(0, Math.round((dates[next.key].getTime() - now) / 60000)) : null;
  const q = qibla(s.lat, s.lng);
  const [locating, setLocating] = useState(false);

  return (
    <>
      <Block title={fmt(pr.title, { city })} hint={fmt(pr.hint, { method: methodName(method.key, method.label), asr: s.asr === 2 ? pr.asrHanafi : pr.asrStandard })} wide>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PRAYERS.map((p) => {
            const on = next?.key === p.key;
            return (
              <div key={p.key} className={`mod-stat items-center text-center ${on ? "ring-1 ring-[#f0cd79]" : ""}`}>
                <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--ink-faint)]">{prayerName(p)}</span>
                <span className={`mt-1 text-xl font-semibold tabular-nums ${on ? "text-[#f0cd79]" : p.key === "sunrise" ? "text-[var(--ink-dim)]" : "text-[var(--ink)]"}`}>
                  {hhmm(dates[p.key], tz)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-[var(--ink-dim)]">
          {next && until != null ? (
            <>
              {pr.next} <span className="font-semibold text-[var(--ink)]">{prayerName(next)}</span> {pr.in}{" "}
              {until >= 60 ? fmt(t.modulesA.hoursMinutes, { h: Math.floor(until / 60), m: String(until % 60).padStart(2, "0") }) : fmt(t.modulesA.minutes, { n: until })}
            </>
          ) : (
            pr.allPassed
          )}
        </p>
      </Block>

      <Block title={pr.myPrayers} hint={pr.myPrayersHint}>
        <DailyChecklist
          module={module}
          entries={entries}
          today={today}
          items={PRAYERS.filter((p) => p.key !== "sunrise").map((p) => ({ key: p.key, label: prayerName(p), sub: hhmm(dates[p.key], tz) }))}
        />
      </Block>

      <Block title={pr.settings} hint={pr.settingsHint}>
        <div className="space-y-3">
          <label className="block text-xs text-[var(--ink-dim)]">
            {pr.method}
            <select value={method.key} onChange={(e) => save({ method: e.target.value })} disabled={pending} className={`${field} mt-1 w-full cursor-pointer appearance-none`}>
              {METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {methodName(m.key, m.label)} — Fajr {m.fajr}°, Isha {typeof m.isha === "number" ? `${m.isha}°` : `${m.isha.minutes} min`}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--ink-dim)]">
            Asr
            <select value={s.asr} onChange={(e) => save({ asr: Number(e.target.value) })} disabled={pending} className={`${field} mt-1 w-full cursor-pointer appearance-none`}>
              <option value={1}>{pr.asrStandardOption}</option>
              <option value={2}>{pr.asrHanafiOption}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={locating || pending}
              onClick={() => {
                setGeoNote(null);
                if (!navigator.geolocation) return setGeoNote(fmt(pr.geoUnavailable, { city }));
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    save({ lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4), city: MY_POSITION });
                    setLocating(false);
                  },
                  () => {
                    setLocating(false);
                    setGeoNote(pr.geoFailed);
                  },
                  { timeout: 10000 }
                );
              }}
              className="mod-chip focus-ring"
            >
              <LocateFixed size={13} /> {locating ? pr.locating : pr.useMyPosition}
            </button>
            {s.city !== OTTAWA.city && (
              <button type="button" onClick={() => save(OTTAWA)} className="mod-chip focus-ring">
                {pr.backToDefault}
              </button>
            )}
          </div>
          {s.city === OTTAWA.city && <p className="text-xs leading-5 text-[var(--ink-dim)]">{fmt(pr.defaultPlace, { city: OTTAWA.city })}</p>}
          {geoNote && (
            <p role="alert" className="rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">
              {geoNote}
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(255,220,148,0.06)] ring-1 ring-[rgba(255,220,148,0.2)]">
              <Compass size={16} className="absolute text-[var(--ink-faint)]" />
              <span className="absolute h-6 w-0.5 origin-bottom rounded-full bg-[#f0cd79]" style={{ bottom: "50%", transform: `rotate(${q}deg)` }} />
            </span>
            <p className="text-sm text-[var(--ink)]">
              {pr.qibla} <span className="font-semibold tabular-nums">{Math.round(q)}°</span>
              <span className="block text-xs text-[var(--ink-dim)]">{fmt(pr.fromNorth, { dir: direction(q) })}</span>
            </p>
          </div>
        </div>
      </Block>

      <Block title={pr.next7} wide>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-[0.7rem] uppercase tracking-wide text-[var(--ink-faint)]">
                <th className="py-1.5 font-medium">{pr.day}</th>
                {PRAYERS.map((p) => (
                  <th key={p.key} className="py-1.5 font-medium">
                    {prayerName(p, true)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => {
                const times7 = prayerTimes(d, s.lat, s.lng, method, s.asr);
                return (
                  <tr key={d} className="border-t border-[rgba(255,220,148,0.08)] tabular-nums text-[var(--ink)]">
                    <td className="py-1.5 text-[var(--ink-dim)]">{dayIn(locale, d)}</td>
                    {PRAYERS.map((p) => (
                      <td key={p.key} className="py-1.5">
                        {hhmm(atUtcHour(d, times7[p.key]), tz)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Block>
    </>
  );
}

// =========================================================================== Lecture (Coran)

const QURAN_PAGES = 604;
// First page of each juz in the standard Madinah mushaf (604 pages).
const JUZ = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
const juzOf = (page: number) => JUZ.filter((p) => p <= page).length || 1;

export function Lecture({ module, today, entries }: ModuleProps) {
  const { t } = useI18n();
  const l = t.modulesA.lecture;
  const { add, update, pending } = useEntries(module);
  const marks = entries.filter((e) => e.kind === "page" && e.value != null);
  const page = marks[0]?.value ?? 0;
  const plan = entries.find((e) => e.kind === "plan");
  const days = plan?.value ?? 30;
  const [input, setInput] = useState("");
  const pagesOn = (day: string) => {
    const at = marks.find((m) => m.day === day)?.value;
    if (at == null) return 0;
    const before = marks.find((m) => m.day < day)?.value ?? 0;
    return Math.max(0, at - before);
  };
  const perDay = Math.ceil((QURAN_PAGES - page) / Math.max(1, days));
  const run = streak(today, (d) => pagesOn(d) > 0);

  const setPage = (p: number) => {
    const todayMark = marks.find((m) => m.day === today);
    if (todayMark) update(todayMark.id, { value: p });
    else add("page", { day: today, value: p });
  };

  return (
    <>
      <Block title={l.title} hint={l.hint} wide>
        <Stats
          items={[
            { label: l.page, value: `${page} / ${QURAN_PAGES}`, tone: "gold" },
            { label: l.juz, value: page ? `${juzOf(page)} / 30` : "—" },
            { label: l.today, value: fmt(l.pagesShort, { n: pagesOn(today) }) },
            { label: t.modulesA.streak, value: fmt(t.modulesA.daysShort, { n: run }) },
          ]}
        />
        <div className="mt-4">
          <Meter value={page} max={QURAN_PAGES} label={l.khatm} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const p = Math.min(QURAN_PAGES, Math.max(0, Number(input)));
            if (input) setPage(p);
            setInput("");
          }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <input type="number" min={0} max={QURAN_PAGES} value={input} onChange={(e) => setInput(e.target.value)} placeholder={l.pageReached} aria-label={l.pageReached} className={`${field} w-40`} />
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            {l.update}
          </button>
          {[1, 2, 5, 20].map((n) => (
            <button key={n} type="button" disabled={pending} onClick={() => setPage(Math.min(QURAN_PAGES, page + n))} className="mod-chip focus-ring">
              {n === 20 ? l.plusJuz : fmt(l.plusPages, { n })}
            </button>
          ))}
        </form>
        <div className="mt-4">
          <DayBars days={lastDays(today, 7)} value={pagesOn} target={Math.max(1, perDay)} unit={l.pagesUnit} />
        </div>
      </Block>

      <Block title={l.planTitle} hint={l.planHint}>
        <div className="flex flex-wrap gap-1.5">
          {[30, 60, 90, 180, 365].map((n) => (
            <button
              key={n}
              type="button"
              data-on={n === days || undefined}
              disabled={pending}
              onClick={() => (plan ? update(plan.id, { value: n }) : add("plan", { value: n }))}
              className="mod-tab focus-ring"
            >
              {n === 365 ? l.oneYear : fmt(l.nDays, { n })}
            </button>
          ))}
        </div>
        <p className="mt-4 text-3xl font-semibold tabular-nums text-[#f0cd79]">
          {page >= QURAN_PAGES ? l.finished : fmt(l.perDay, { n: perDay })}
        </p>
        <p className="mt-1 text-xs text-[var(--ink-dim)]">
          {page >= QURAN_PAGES ? l.accepted : fmt(l.pace, { juz: Math.round((perDay * 30) / 20), left: QURAN_PAGES - page })}
        </p>
      </Block>

      <Block title={l.othersTitle} hint={l.othersHint}>
        <EntryList
          module={module}
          kind="book"
          entries={entries}
          today={today}
          fields={[
            { key: "title", label: l.bookTitle, type: "text", to: "text", required: true },
            { key: "author", label: l.author, type: "text", width: "w-36" },
          ]}
          render={(e) => ({ title: e.text, sub: e.data.author ? String(e.data.author) : undefined })}
          empty={l.othersEmpty}
        />
      </Block>
    </>
  );
}

// =========================================================================== Méditation

type PatternKey = keyof typeof modulesA.fr.meditation.patterns;
type Phase = "inhale" | "hold" | "exhale";

/** Breathing patterns: phases of [label, seconds, scale the circle grows to]. */
const PATTERNS: { key: PatternKey; phases: [Phase, number, number][] }[] = [
  {
    key: "coherence",
    phases: [
      ["inhale", 5, 1],
      ["exhale", 5, 0.55],
    ],
  },
  {
    key: "box",
    phases: [
      ["inhale", 4, 1],
      ["hold", 4, 1],
      ["exhale", 4, 0.55],
      ["hold", 4, 0.55],
    ],
  },
  {
    key: "478",
    phases: [
      ["inhale", 4, 1],
      ["hold", 7, 1],
      ["exhale", 8, 0.55],
    ],
  },
];

export function Meditation({ module, today, entries }: ModuleProps) {
  const { t, locale } = useI18n();
  const md = t.modulesA.meditation;
  const { add, remove, pending } = useEntries(module);
  const [pattern, setPattern] = useState(PATTERNS[0]);
  const [length, setLength] = useState(5);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const seconds = useRef(0);

  const cycle = pattern.phases.reduce((sum, p) => sum + p[1], 0);
  // Which phase the current second falls in.
  let phase = 0;
  for (let t = elapsed % cycle; t >= pattern.phases[phase][1]; phase++) t -= pattern.phases[phase][1];

  const reset = () => {
    seconds.current = 0;
    setElapsed(0);
  };

  // The tick lives in the interval: a finished session stops itself and is recorded.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      seconds.current += 1;
      if (seconds.current >= length * 60) {
        clearInterval(id);
        seconds.current = 0;
        setElapsed(0);
        setRunning(false);
        // Stored under its French name, as sessions always have been.
        add("session", { day: today, value: length, text: modulesA.fr.meditation.patterns[pattern.key].name });
      } else {
        setElapsed(seconds.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, length, add, today, pattern.key]);

  const sessions = entries.filter((e) => e.kind === "session");
  const minutesOn = (d: string) => sessions.filter((s) => s.day === d).reduce((a, s) => a + (s.value ?? 0), 0);
  const week = lastDays(today, 7).reduce((a, d) => a + minutesOn(d), 0);
  const [label, secs, scale] = pattern.phases[phase];
  const sessionName = (text: string | null) => {
    const key = (Object.keys(modulesA.fr.meditation.patterns) as PatternKey[]).find((k) => modulesA.fr.meditation.patterns[k].name === text);
    return key ? md.patterns[key].name : (text ?? "");
  };
  const left = length * 60 - elapsed;

  return (
    <>
      <Block title={md.title} hint={md.hint} wide>
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {PATTERNS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={p.key === pattern.key}
              data-on={p.key === pattern.key || undefined}
              onClick={() => {
                setPattern(p);
                reset();
                setRunning(false);
              }}
              className="mod-tab focus-ring"
            >
              {md.patterns[p.key].name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-dim)]">{md.patterns[pattern.key].desc}</p>

        <div className="my-6 flex flex-col items-center gap-5">
          <div className="relative flex h-52 w-52 items-center justify-center">
            <span
              className="breath-ring"
              style={{
                transform: `scale(${running ? scale : 0.55})`,
                transitionDuration: running ? `${secs}s` : "0.6s",
              }}
              aria-hidden
            />
            <div className="relative text-center">
              <p className="text-xl font-semibold text-[var(--ink)]">{running ? md[label] : md.ready}</p>
              <p className="text-xs tabular-nums text-[var(--ink-dim)]">
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[1, 3, 5, 10].map((m) => (
              <button
                key={m}
                type="button"
                data-on={m === length || undefined}
                onClick={() => {
                  setLength(m);
                  reset();
                }}
                className="mod-tab focus-ring"
              >
                {fmt(t.modulesA.minutes, { n: m })}
              </button>
            ))}
            <button type="button" onClick={() => setRunning((r) => !r)} className="mod-chip mod-chip-gold focus-ring">
              {running ? <Pause size={13} /> : <Play size={13} />} {running ? md.pause : elapsed ? md.resume : md.start}
            </button>
          </div>
        </div>
      </Block>

      <Block title={md.practiceTitle} hint={md.practiceHint}>
        <Stats
          items={[
            { label: md.days7, value: fmt(t.modulesA.minutes, { n: week }), tone: "gold" },
            { label: t.modulesA.streak, value: fmt(t.modulesA.daysShort, { n: streak(today, (d) => minutesOn(d) > 0) }) },
          ]}
        />
        <div className="mt-4">
          <DayBars days={lastDays(today, 7)} value={minutesOn} target={10} unit="min" />
        </div>
        {sessions.length === 0 && (
          <div className="mt-3">
            <Empty>{md.empty}</Empty>
          </div>
        )}
        <ul className="mt-3 space-y-1.5">
          {sessions.slice(0, 5).map((s) => (
            <li key={s.id} className="flex items-center justify-between text-xs text-[var(--ink-dim)]">
              <span>
                {dayIn(locale, s.day)} · {sessionName(s.text)}
              </span>
              <span className="flex items-center gap-2 tabular-nums text-[var(--ink)]">
                {fmt(t.modulesA.minutes, { n: s.value ?? 0 })}
                <button type="button" disabled={pending} onClick={() => remove(s.id)} aria-label={t.common.delete} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                  <Trash2 size={12} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Block>
    </>
  );
}

// =========================================================================== Gratitude

export function Gratitude({ module, today, entries }: ModuleProps) {
  const { t, locale } = useI18n();
  const g = t.modulesA.gratitude;
  const prompts = Object.values(g.prompts);
  const { add, remove, pending } = useEntries(module);
  const [text, setText] = useState("");
  const notes = entries.filter((e) => e.kind === "note");
  const todays = notes.filter((n) => n.day === today);
  const dayIndex = Math.floor(new Date(`${today}T12:00:00Z`).getTime() / 86400000);
  const prompt = prompts[dayIndex % prompts.length];
  // Worded before the memo below, so the compiler can keep it.
  const placeholder = fmt(g.placeholder, { n: Math.min(todays.length + 1, 3) });
  const progress = fmt(g.progress, { n: todays.length });
  const byDay = useMemo(() => {
    const m = new Map<string, typeof notes>();
    for (const n of notes) (m.get(n.day) ?? m.set(n.day, []).get(n.day)!).push(n);
    return [...m.entries()].slice(0, 10);
  }, [notes]);
  const run = streak(today, (d) => notes.some((n) => n.day === d));

  return (
    <>
      <Block title={g.title} hint={g.hint} wide>
        <p className="mb-3 text-sm italic text-[#f0cd79]">{prompt}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            add("note", { day: today, text });
            setText("");
          }}
          className="flex items-center gap-2"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={g.aria} className={`${field} flex-1`} />
          <IconButton label={g.add} tone="gold" onClick={() => text.trim() && (add("note", { day: today, text }), setText(""))} disabled={pending}>
            <Plus size={14} />
          </IconButton>
        </form>
        <Meter value={todays.length} max={3} label={progress} />
        <p className="mt-2 text-xs text-[var(--ink-dim)]">{fmt((locale === "fr" ? run <= 1 : run === 1) ? g.streakOne : g.streakMany, { n: run })}</p>
      </Block>

      <Block title={g.journal} wide>
        {byDay.length === 0 ? (
          <Empty>{g.empty}</Empty>
        ) : (
          <div className="space-y-4">
            {byDay.map(([d, list]) => (
              <div key={d}>
                <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{dayIn(locale, d, { weekday: "long", day: "numeric", month: "long" })}</p>
                <ul className="space-y-1.5">
                  {list.map((n) => (
                    <li key={n.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 text-sm text-[var(--ink)]">{n.text}</span>
                      <IconButton label={t.common.delete} onClick={() => remove(n.id)} disabled={pending}>
                        <Trash2 size={13} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Block>
    </>
  );
}

export const ESPRIT_SOURCES = {
  priere: [
    "Algorithme de calcul des horaires d'après PrayTimes.org (H. Zarrabi-Zadeh) ; angles des méthodes ISNA, MWL, UOIF, Égypte, Umm al-Qura, Karachi.",
    "Direction de la Qibla : azimut du grand cercle vers la Kaaba (21,4225° N, 39,8262° E).",
  ],
  lecture: ["Pagination du mushaf de Médine (Complexe du roi Fahd) : 604 pages, 30 juz."],
  meditation: [
    "Lehrer P. & Gevirtz R., Heart rate variability biofeedback: how and why does it work?, Front Psychol (2014).",
    "Zaccaro A. et al., How breath-control can change your life: a systematic review, Front Hum Neurosci (2018).",
  ],
  gratitude: ["Emmons R.A. & McCullough M.E., Counting blessings versus burdens, J Pers Soc Psychol 84(2) (2003)."],
};
