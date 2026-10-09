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
  dayLabel,
  field,
  lastDays,
  streak,
  useEntries,
  type ModuleProps,
} from "@/components/modules/kit";
import { METHODS, PRAYERS, atUtcHour, compass, prayerTimes, qibla, type PrayerKey } from "@/lib/prayer";

// =========================================================================== Prière

const OTTAWA = { lat: 45.4215, lng: -75.6972, city: "Ottawa" };
const hhmm = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

export function Priere({ module, today, entries }: ModuleProps) {
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
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto", []);

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
      <Block title={`Horaires du jour · ${s.city}`} hint={`${method.label} · Asr ${s.asr === 2 ? "hanafite" : "standard (chafiite, malikite, hanbalite)"}`} wide>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PRAYERS.map((p) => {
            const on = next?.key === p.key;
            return (
              <div key={p.key} className={`mod-stat items-center text-center ${on ? "ring-1 ring-[#f0cd79]" : ""}`}>
                <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--ink-faint)]">{p.label}</span>
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
              Prochaine prière : <span className="font-semibold text-[var(--ink)]">{next.label}</span> dans{" "}
              {until >= 60 ? `${Math.floor(until / 60)} h ${String(until % 60).padStart(2, "0")}` : `${until} min`}
            </>
          ) : (
            "Toutes les prières du jour sont passées."
          )}
        </p>
      </Block>

      <Block title="Mes prières" hint="Coche chaque prière accomplie ; la série compte les journées complètes.">
        <DailyChecklist
          module={module}
          entries={entries}
          today={today}
          items={PRAYERS.filter((p) => p.key !== "sunrise").map((p) => ({ key: p.key, label: p.label, sub: hhmm(dates[p.key], tz) }))}
        />
      </Block>

      <Block title="Réglages" hint="La méthode fixe l'angle du soleil pour Fajr et Isha ; l'Asr hanafite est plus tardive.">
        <div className="space-y-3">
          <label className="block text-xs text-[var(--ink-dim)]">
            Méthode de calcul
            <select value={method.key} onChange={(e) => save({ method: e.target.value })} disabled={pending} className={`${field} mt-1 w-full cursor-pointer appearance-none`}>
              {METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} — Fajr {m.fajr}°, Isha {typeof m.isha === "number" ? `${m.isha}°` : `${m.isha.minutes} min`}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--ink-dim)]">
            Asr
            <select value={s.asr} onChange={(e) => save({ asr: Number(e.target.value) })} disabled={pending} className={`${field} mt-1 w-full cursor-pointer appearance-none`}>
              <option value={1}>Standard (ombre = 1 fois la hauteur)</option>
              <option value={2}>Hanafite (ombre = 2 fois la hauteur)</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={locating || pending}
              onClick={() => {
                if (!navigator.geolocation) return;
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    save({ lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4), city: "Ma position" });
                    setLocating(false);
                  },
                  () => setLocating(false),
                  { timeout: 10000 }
                );
              }}
              className="mod-chip focus-ring"
            >
              <LocateFixed size={13} /> {locating ? "Localisation…" : "Utiliser ma position"}
            </button>
            {s.city !== OTTAWA.city && (
              <button type="button" onClick={() => save(OTTAWA)} className="mod-chip focus-ring">
                Revenir à Ottawa
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(255,220,148,0.06)] ring-1 ring-[rgba(255,220,148,0.2)]">
              <Compass size={16} className="absolute text-[var(--ink-faint)]" />
              <span className="absolute h-6 w-0.5 origin-bottom rounded-full bg-[#f0cd79]" style={{ bottom: "50%", transform: `rotate(${q}deg)` }} />
            </span>
            <p className="text-sm text-[var(--ink)]">
              Qibla : <span className="font-semibold tabular-nums">{Math.round(q)}°</span>
              <span className="block text-xs text-[var(--ink-dim)]">depuis le nord, vers le {compass(q)}</span>
            </p>
          </div>
        </div>
      </Block>

      <Block title="Les 7 prochains jours" wide>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-left text-[0.7rem] uppercase tracking-wide text-[var(--ink-faint)]">
                <th className="py-1.5 font-medium">Jour</th>
                {PRAYERS.map((p) => (
                  <th key={p.key} className="py-1.5 font-medium">
                    {p.label === "Lever du soleil" ? "Lever" : p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => {
                const t = prayerTimes(d, s.lat, s.lng, method, s.asr);
                return (
                  <tr key={d} className="border-t border-[rgba(255,220,148,0.08)] tabular-nums text-[var(--ink)]">
                    <td className="py-1.5 text-[var(--ink-dim)]">{dayLabel(d)}</td>
                    {PRAYERS.map((p) => (
                      <td key={p.key} className="py-1.5">
                        {hhmm(atUtcHour(d, t[p.key]), tz)}
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
      <Block title="Lecture du Coran" hint="Progression dans le mushaf de Médine (604 pages, 30 juz)." wide>
        <Stats
          items={[
            { label: "Page", value: `${page} / ${QURAN_PAGES}`, tone: "gold" },
            { label: "Juz", value: page ? `${juzOf(page)} / 30` : "—" },
            { label: "Aujourd'hui", value: `${pagesOn(today)} p.` },
            { label: "Série", value: `${run} j` },
          ]}
        />
        <div className="mt-4">
          <Meter value={page} max={QURAN_PAGES} label="Khatm" />
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
          <input type="number" min={0} max={QURAN_PAGES} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Page atteinte" aria-label="Page atteinte" className={`${field} w-40`} />
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            Mettre à jour
          </button>
          {[1, 2, 5, 20].map((n) => (
            <button key={n} type="button" disabled={pending} onClick={() => setPage(Math.min(QURAN_PAGES, page + n))} className="mod-chip focus-ring">
              +{n === 20 ? "1 juz" : `${n} p.`}
            </button>
          ))}
        </form>
        <div className="mt-4">
          <DayBars days={lastDays(today, 7)} value={pagesOn} target={Math.max(1, perDay)} unit="pages" />
        </div>
      </Block>

      <Block title="Plan de lecture" hint="Choisis en combien de jours finir : le rythme quotidien s'ajuste à ta progression.">
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
              {n === 365 ? "1 an" : `${n} jours`}
            </button>
          ))}
        </div>
        <p className="mt-4 text-3xl font-semibold tabular-nums text-[#f0cd79]">
          {page >= QURAN_PAGES ? "Khatm terminé" : `${perDay} pages / jour`}
        </p>
        <p className="mt-1 text-xs text-[var(--ink-dim)]">
          {page >= QURAN_PAGES ? "Qu'Allah l'accepte." : `soit environ ${Math.round((perDay * 30) / 20)} juz par mois, ${QURAN_PAGES - page} pages restantes`}
        </p>
      </Block>

      <Block title="Autres lectures" hint="Tafsir, hadith, livres de spiritualité.">
        <EntryList
          module={module}
          kind="book"
          entries={entries}
          today={today}
          fields={[
            { key: "title", label: "Titre", type: "text", to: "text", required: true },
            { key: "author", label: "Auteur", type: "text", width: "w-36" },
          ]}
          render={(e) => ({ title: e.text, sub: e.data.author ? String(e.data.author) : undefined })}
          empty="Aucune autre lecture en cours."
        />
      </Block>
    </>
  );
}

// =========================================================================== Méditation

/** Breathing patterns: phases of [label, seconds, scale the circle grows to]. */
const PATTERNS: { key: string; name: string; desc: string; phases: [string, number, number][] }[] = [
  {
    key: "coherence",
    name: "Cohérence cardiaque",
    desc: "6 respirations par minute (5 s / 5 s), la fréquence dite de résonance du système cardiovasculaire.",
    phases: [
      ["Inspire", 5, 1],
      ["Expire", 5, 0.55],
    ],
  },
  {
    key: "box",
    name: "Respiration carrée",
    desc: "4 temps égaux. Utilisée pour se recentrer avant un effort ou sous stress.",
    phases: [
      ["Inspire", 4, 1],
      ["Retiens", 4, 1],
      ["Expire", 4, 0.55],
      ["Retiens", 4, 0.55],
    ],
  },
  {
    key: "478",
    name: "4 – 7 – 8",
    desc: "Expiration longue qui ralentit le rythme, souvent pratiquée avant de dormir.",
    phases: [
      ["Inspire", 4, 1],
      ["Retiens", 7, 1],
      ["Expire", 8, 0.55],
    ],
  },
];

export function Meditation({ module, today, entries }: ModuleProps) {
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
        add("session", { day: today, value: length, text: pattern.name });
      } else {
        setElapsed(seconds.current);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, length, add, today, pattern.name]);

  const sessions = entries.filter((e) => e.kind === "session");
  const minutesOn = (d: string) => sessions.filter((s) => s.day === d).reduce((a, s) => a + (s.value ?? 0), 0);
  const week = lastDays(today, 7).reduce((a, d) => a + minutesOn(d), 0);
  const [label, secs, scale] = pattern.phases[phase];
  const left = length * 60 - elapsed;

  return (
    <>
      <Block title="Respiration guidée" hint="Suis le cercle : il grandit à l'inspiration et se resserre à l'expiration." wide>
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
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--ink-dim)]">{pattern.desc}</p>

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
              <p className="text-xl font-semibold text-[var(--ink)]">{running ? label : "Prêt"}</p>
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
                {m} min
              </button>
            ))}
            <button type="button" onClick={() => setRunning((r) => !r)} className="mod-chip mod-chip-gold focus-ring">
              {running ? <Pause size={13} /> : <Play size={13} />} {running ? "Pause" : elapsed ? "Reprendre" : "Commencer"}
            </button>
          </div>
        </div>
      </Block>

      <Block title="Ma pratique" hint="Les séances terminées s'enregistrent toutes seules.">
        <Stats
          items={[
            { label: "7 jours", value: `${week} min`, tone: "gold" },
            { label: "Série", value: `${streak(today, (d) => minutesOn(d) > 0)} j` },
          ]}
        />
        <div className="mt-4">
          <DayBars days={lastDays(today, 7)} value={minutesOn} target={10} unit="min" />
        </div>
        <ul className="mt-3 space-y-1.5">
          {sessions.slice(0, 5).map((s) => (
            <li key={s.id} className="flex items-center justify-between text-xs text-[var(--ink-dim)]">
              <span>
                {dayLabel(s.day)} · {s.text}
              </span>
              <span className="flex items-center gap-2 tabular-nums text-[var(--ink)]">
                {s.value} min
                <button type="button" disabled={pending} onClick={() => remove(s.id)} aria-label="Supprimer" className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
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

const PROMPTS = [
  "Une personne qui a rendu ta journée meilleure.",
  "Quelque chose de simple qui t'a fait sourire.",
  "Un progrès, même petit, que tu as fait.",
  "Un moment de calme que tu as eu.",
  "Une chose que ton corps t'a permis de faire.",
  "Un conseil reçu qui t'a aidé.",
  "Un repas ou un goût que tu as apprécié.",
  "Une difficulté qui t'a appris quelque chose.",
  "Un endroit où tu te sens bien.",
  "Quelque chose que tu attends avec plaisir.",
  "Un geste gentil que tu as fait ou reçu.",
  "Une chance que tu as et que d'autres n'ont pas.",
  "Un souvenir heureux qui t'est revenu.",
  "Ce que tu aimes dans ta vie en ce moment.",
];

export function Gratitude({ module, today, entries }: ModuleProps) {
  const { add, remove, pending } = useEntries(module);
  const [text, setText] = useState("");
  const notes = entries.filter((e) => e.kind === "note");
  const todays = notes.filter((n) => n.day === today);
  const dayIndex = Math.floor(new Date(`${today}T12:00:00Z`).getTime() / 86400000);
  const prompt = PROMPTS[dayIndex % PROMPTS.length];
  const byDay = useMemo(() => {
    const m = new Map<string, typeof notes>();
    for (const n of notes) (m.get(n.day) ?? m.set(n.day, []).get(n.day)!).push(n);
    return [...m.entries()].slice(0, 10);
  }, [notes]);

  return (
    <>
      <Block title="Trois choses aujourd'hui" hint="Noter chaque jour ce pour quoi on est reconnaissant améliore le bien-être (Emmons & McCullough, 2003)." wide>
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
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`${Math.min(todays.length + 1, 3)}. Je suis reconnaissant pour…`} aria-label="Gratitude" className={`${field} flex-1`} />
          <IconButton label="Ajouter" tone="gold" onClick={() => text.trim() && (add("note", { day: today, text }), setText(""))} disabled={pending}>
            <Plus size={14} />
          </IconButton>
        </form>
        <Meter value={todays.length} max={3} label={`${todays.length} / 3 aujourd'hui`} />
        <p className="mt-2 text-xs text-[var(--ink-dim)]">Série : {streak(today, (d) => notes.some((n) => n.day === d))} jour(s)</p>
      </Block>

      <Block title="Mon carnet" wide>
        {byDay.length === 0 ? (
          <Empty>Ton carnet est vide : commence par une chose, aujourd&apos;hui.</Empty>
        ) : (
          <div className="space-y-4">
            {byDay.map(([d, list]) => (
              <div key={d}>
                <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{dayLabel(d, { weekday: "long", day: "numeric", month: "long" })}</p>
                <ul className="space-y-1.5">
                  {list.map((n) => (
                    <li key={n.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 text-sm text-[var(--ink)]">{n.text}</span>
                      <IconButton label="Supprimer" onClick={() => remove(n.id)} disabled={pending}>
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
