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
  dayLabel,
  daysBetween,
  field,
  lastDays,
  useEntries,
  type Entry,
  type ModuleProps,
} from "@/components/modules/kit";
import { ProgramBuilder, StrengthLog } from "@/components/modules/sections/sport-extra";
import { WorkoutPlanner } from "@/components/modules/sections/WorkoutPlanner";

// =========================================================================== Sport

/**
 * Energy cost of activities in METs, from the Compendium of Physical Activities
 * (Ainsworth et al., 2011). kcal ≈ MET × body mass (kg) × hours.
 */
const SPORTS: { name: string; met: number; minutes: number }[] = [
  { name: "Course à pied (≈ 10 km/h)", met: 9.8, minutes: 40 },
  { name: "Marche rapide (≈ 5,6 km/h)", met: 4.3, minutes: 45 },
  { name: "Vélo (19–22 km/h)", met: 8.0, minutes: 60 },
  { name: "Natation (crawl, modéré)", met: 5.8, minutes: 45 },
  { name: "Football (loisir)", met: 7.0, minutes: 90 },
  { name: "Tennis (simple)", met: 8.0, minutes: 60 },
  { name: "Basketball", met: 6.5, minutes: 60 },
  { name: "Badminton (loisir)", met: 5.5, minutes: 60 },
  { name: "Volleyball (loisir)", met: 4.0, minutes: 60 },
  { name: "Corde à sauter (modéré)", met: 11.8, minutes: 15 },
  { name: "Rameur (modéré)", met: 7.0, minutes: 30 },
  { name: "Randonnée", met: 6.0, minutes: 120 },
  { name: "Boxe (sac de frappe)", met: 5.5, minutes: 45 },
  { name: "Danse (aérobic)", met: 7.3, minutes: 45 },
  { name: "Yoga (hatha)", met: 2.5, minutes: 45 },
];

interface Exercise {
  name: string;
  muscle: string;
  dose: string;
  cue: string;
}

const EXERCISES: Exercise[] = [
  { name: "Pompes", muscle: "Pectoraux", dose: "3 × 8–15", cue: "Mains sous les épaules, corps gainé de la tête aux talons, poitrine jusqu'au sol." },
  { name: "Développé couché", muscle: "Pectoraux", dose: "4 × 6–10", cue: "Omoplates serrées, barre au bas des pectoraux, pieds ancrés au sol." },
  { name: "Dips", muscle: "Pectoraux", dose: "3 × 6–12", cue: "Buste légèrement penché, descendre jusqu'à 90° aux coudes." },
  { name: "Tractions", muscle: "Dos", dose: "4 × 4–10", cue: "Partir bras tendus, tirer les coudes vers les hanches, menton au-dessus de la barre." },
  { name: "Rowing haltère", muscle: "Dos", dose: "3 × 10 / bras", cue: "Dos plat, tirer l'haltère vers la hanche, pas vers l'épaule." },
  { name: "Soulevé de terre", muscle: "Dos", dose: "4 × 5", cue: "Barre contre les tibias, dos neutre, pousser le sol avec les jambes." },
  { name: "Squat", muscle: "Jambes", dose: "4 × 8–12", cue: "Pieds largeur d'épaules, genoux dans l'axe des pieds, hanches sous les genoux si la mobilité le permet." },
  { name: "Fentes", muscle: "Jambes", dose: "3 × 10 / jambe", cue: "Grand pas, genou arrière vers le sol, buste droit." },
  { name: "Soulevé de terre roumain", muscle: "Jambes", dose: "3 × 8–10", cue: "Genoux souples, hanches vers l'arrière, étirement des ischios, dos plat." },
  { name: "Pont fessier", muscle: "Jambes", dose: "3 × 12–15", cue: "Talons près des fesses, pousser le bassin vers le haut, serrer les fessiers 1 s." },
  { name: "Mollets debout", muscle: "Jambes", dose: "3 × 15–20", cue: "Amplitude complète, pause en haut, descente contrôlée." },
  { name: "Développé militaire", muscle: "Épaules", dose: "4 × 6–10", cue: "Gainage fort, barre au-dessus de la tête dans l'axe des oreilles." },
  { name: "Élévations latérales", muscle: "Épaules", dose: "3 × 12–15", cue: "Coudes légèrement fléchis, monter jusqu'à l'horizontale, sans élan." },
  { name: "Curl biceps", muscle: "Bras", dose: "3 × 10–12", cue: "Coudes fixes le long du corps, descente lente." },
  { name: "Extensions triceps", muscle: "Bras", dose: "3 × 10–12", cue: "Coudes pointés vers l'avant, seule l'avant-bras bouge." },
  { name: "Gainage", muscle: "Abdos", dose: "3 × 30–60 s", cue: "Avant-bras sous les épaules, bassin aligné, respirer normalement." },
  { name: "Gainage latéral", muscle: "Abdos", dose: "3 × 20–40 s / côté", cue: "Hanches hautes, corps en ligne droite." },
  { name: "Dead bug", muscle: "Abdos", dose: "3 × 10 / côté", cue: "Bas du dos plaqué au sol, bras et jambe opposés s'allongent lentement." },
  { name: "Burpees", muscle: "Cardio", dose: "4 × 40 s", cue: "Squat, planche, pompe facultative, saut bras tendus." },
  { name: "Mountain climbers", muscle: "Cardio", dose: "4 × 40 s", cue: "Position de planche, genoux vers la poitrine en alternance, rapide." },
  { name: "Jumping jacks", muscle: "Cardio", dose: "4 × 45 s", cue: "Ouvrir bras et jambes ensemble, rythme régulier." },
];

const MUSCLES = ["Tous", "Pectoraux", "Dos", "Jambes", "Épaules", "Bras", "Abdos", "Cardio"];

/** Ready-made sessions. MET: resistance training 3.5 (moderate) / 6.0 (vigorous), circuit 8.0. */
const PROGRAMS: { name: string; minutes: number; met: number; strength: boolean; level: string; steps: string[] }[] = [
  {
    name: "Full body débutant",
    minutes: 35,
    met: 3.5,
    strength: true,
    level: "Débutant",
    steps: ["Squat 3 × 12", "Pompes 3 × 8–12", "Rowing haltère 3 × 10 / bras", "Fentes 3 × 10 / jambe", "Pont fessier 3 × 15", "Gainage 3 × 30 s"],
  },
  {
    name: "HIIT 20 minutes",
    minutes: 20,
    met: 8.0,
    strength: false,
    level: "Intermédiaire",
    steps: ["Échauffement 3 min", "4 tours : jumping jacks, burpees, mountain climbers, squats sautés", "40 s d'effort / 20 s de repos", "Retour au calme 2 min"],
  },
  {
    name: "Haut du corps",
    minutes: 50,
    met: 6.0,
    strength: true,
    level: "Intermédiaire",
    steps: ["Développé couché 4 × 6–10", "Tractions 4 × 4–10", "Développé militaire 3 × 8", "Rowing haltère 3 × 10", "Curl + extensions triceps 3 × 12"],
  },
  {
    name: "Bas du corps",
    minutes: 50,
    met: 6.0,
    strength: true,
    level: "Intermédiaire",
    steps: ["Squat 4 × 8", "Soulevé de terre roumain 3 × 10", "Fentes 3 × 10 / jambe", "Pont fessier 3 × 12", "Mollets 3 × 15"],
  },
  {
    name: "Mobilité & étirements",
    minutes: 15,
    met: 2.5,
    strength: false,
    level: "Tous niveaux",
    steps: ["Rotations articulaires 3 min", "Fente avec rotation thoracique", "Étirement ischios et fléchisseurs de hanche", "Chat-vache, posture de l'enfant"],
  },
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
  const { add, remove, schedule, pending } = useEntries(module);
  const weightRow = (related["sante:corps"] ?? []).find((e) => e.kind === "weight" && e.value);
  const kg = weightRow?.value ?? DEFAULT_KG;
  const [muscle, setMuscle] = useState("Tous");
  const [activity, setActivity] = useState(SPORTS[0].name);
  const [minutes, setMinutes] = useState("45");
  const [day, setDay] = useState(today);

  const workouts = entries.filter((e) => e.kind === "workout");
  const monday = weekStart(today);
  const week = workouts.filter((w) => w.day >= monday && w.day <= today);
  const eq = week.reduce((s, w) => s + equivalentMinutes(w.value ?? 0, Number(w.data.met ?? 0)), 0);
  const strengthDays = new Set(week.filter((w) => w.data.strength).map((w) => w.day)).size;
  const weekKcal = week.reduce((s, w) => s + kcal(Number(w.data.met ?? 0), kg, w.value ?? 0), 0);

  const options = [...PROGRAMS.map((p) => ({ name: p.name, met: p.met, strength: p.strength, minutes: p.minutes })), ...SPORTS.map((s) => ({ ...s, strength: false }))];
  const log = (name: string, met: number, mins: number, strength: boolean, on = today) =>
    add("workout", { day: on, text: name, value: mins, data: { met, strength } });

  return (
    <>
      <Block title="Cette semaine" hint="L'OMS recommande 150 à 300 min d'activité modérée par semaine (ou 75 à 150 min d'activité intense), et du renforcement musculaire au moins 2 jours." wide>
        <Stats
          items={[
            { label: "Minutes (équiv. modérées)", value: `${eq}`, sub: "objectif 150", tone: "gold" },
            { label: "Séances", value: `${week.length}` },
            { label: "Renforcement", value: `${strengthDays} / 2 j` },
            { label: "Énergie estimée", value: `${weekKcal.toLocaleString("fr-CA")} kcal`, sub: weightRow ? `pour ${kg} kg` : `pour ${DEFAULT_KG} kg (ajoute ton poids dans Corps)` },
          ]}
        />
        <div className="mt-4">
          <Meter value={eq} max={150} label="Objectif hebdomadaire de l'OMS" />
        </div>
      </Block>

      <Block title="Enregistrer une séance" hint="Une activité ou un programme, sa durée et le jour.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const o = options.find((x) => x.name === activity)!;
            log(o.name, o.met, Number(minutes) || o.minutes, o.strength, day);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <select
            value={activity}
            onChange={(e) => {
              setActivity(e.target.value);
              setMinutes(String(options.find((x) => x.name === e.target.value)?.minutes ?? 45));
            }}
            aria-label="Activité"
            className={`${field} flex-1 basis-52 cursor-pointer appearance-none`}
          >
            <optgroup label="Programmes">
              {PROGRAMS.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </optgroup>
            <optgroup label="Sports">
              {SPORTS.map((s) => (
                <option key={s.name}>{s.name}</option>
              ))}
            </optgroup>
          </select>
          <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" className={`${field} w-24`} />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Jour" className={`${field} w-36`} />
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> Enregistrer
          </button>
        </form>

        <ul className="mt-4 space-y-2">
          {workouts.slice(0, 6).map((w) => (
            <li key={w.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--ink)]">{w.text}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
                  {dayLabel(w.day)} · {w.value} min · ≈ {kcal(Number(w.data.met ?? 0), kg, w.value ?? 0)} kcal
                </p>
              </div>
              <IconButton label="Supprimer" onClick={() => remove(w.id)} disabled={pending}>
                <Trash2 size={13} />
              </IconButton>
            </li>
          ))}
          {workouts.length === 0 && <Empty>Aucune séance enregistrée pour l&apos;instant.</Empty>}
        </ul>
      </Block>

      <StrengthLog module={module} today={today} entries={entries} exercises={EXERCISES.filter((x) => x.muscle !== "Cardio").map((x) => x.name)} />
      <WorkoutPlanner />

      <ProgramBuilder module={module} today={today} entries={entries} />

      <Block title="Programmes" hint="Des séances prêtes : planifie-les dans ton calendrier, ou note-les comme faites.">
        <ul className="space-y-2.5">
          {PROGRAMS.map((p) => (
            <li key={p.name} className="tile px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{p.name}</p>
                  <p className="text-xs text-[var(--ink-dim)]">
                    {p.minutes} min · {p.level} · ≈ {kcal(p.met, kg, p.minutes)} kcal
                  </p>
                </div>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[var(--ink-dim)]">{p.steps.join(" · ")}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <ScheduleButton title={`Séance : ${p.name}`} notes={p.steps.join("\n")} minutes={p.minutes} today={today} onSchedule={schedule} />
                <button type="button" disabled={pending} onClick={() => log(p.name, p.met, p.minutes, p.strength)} className="mod-chip focus-ring">
                  Fait aujourd&apos;hui
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Sports" hint={`Dépense estimée par heure pour ${kg} kg, d'après les valeurs MET du Compendium des activités physiques.`}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {SPORTS.map((s) => (
            <li key={s.name} className="tile flex flex-col gap-2 px-3.5 py-3">
              <div>
                <p className="text-sm text-[var(--ink)]">{s.name}</p>
                <p className="text-xs text-[var(--ink-dim)]">
                  {s.met} MET · ≈ {kcal(s.met, kg, 60)} kcal/h
                </p>
              </div>
              <ScheduleButton title={s.name} minutes={s.minutes} today={today} onSchedule={schedule} />
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Bibliothèque d'exercices" hint="Le bon geste avant la charge : la technique, puis les séries." wide>
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
          {MUSCLES.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={m === muscle} data-on={m === muscle || undefined} onClick={() => setMuscle(m)} className="mod-tab focus-ring">
              {m}
            </button>
          ))}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXERCISES.filter((x) => muscle === "Tous" || x.muscle === muscle).map((x) => (
            <li key={x.name} className="tile px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--ink)]">{x.name}</p>
                <span className="shrink-0 text-xs tabular-nums text-[#f0cd79]">{x.dose}</span>
              </div>
              <p className="text-[0.7rem] uppercase tracking-wide text-[var(--ink-faint)]">{x.muscle}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">{x.cue}</p>
            </li>
          ))}
        </ul>
      </Block>
    </>
  );
}

// =========================================================================== Corps

const bmiClass = (b: number) =>
  b < 18.5 ? "Insuffisance pondérale" : b < 25 ? "Corpulence normale" : b < 30 ? "Surpoids" : "Obésité";

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
            {last ? last.value : "—"}
            <span className="ml-1 text-sm font-normal text-[var(--ink-dim)]">{unit}</span>
          </p>
          <p className="text-xs text-[var(--ink-dim)]">
            {last ? `${dayLabel(last.day)}${describe ? ` · ${describe(last.value!)}` : ""}` : "Aucune mesure"}
            {series.length > 1 && first30 !== undefined && ` · ${(last!.value! - first30 >= 0 ? "+" : "")}${(last!.value! - first30).toFixed(1)} ${unit} sur la période`}
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
          <IconButton label="Ajouter la mesure" tone="gold" onClick={() => v && (add(kind, { day: today, value: Number(v) }), setV(""))} disabled={pending}>
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
              <span>{dayLabel(r.day)}</span>
              <span className="flex items-center gap-2 tabular-nums text-[var(--ink)]">
                {r.value} {unit}
                <button type="button" onClick={() => remove(r.id)} aria-label="Supprimer" className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
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
    if (Math.abs(d) < 0.05) return "stable par rapport à la semaine dernière";
    return `${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(digits).replace(".", ",")} ${unit} par rapport à la semaine dernière`;
  };
  const cards = [
    {
      title: "Activité",
      value: `${minutes[0]} min`,
      sub: `${Math.min(100, Math.round((minutes[0] / 150) * 100))} % de l'objectif OMS de la semaine`,
      note: trend(minutes[0], minutes[1], "min"),
      color: "#ef4444",
    },
    {
      title: "Sommeil",
      value: nights[0] != null ? `${Math.floor(nights[0])} h ${String(Math.round((nights[0] % 1) * 60)).padStart(2, "0")}` : "—",
      sub: nights[0] != null ? (nights[0] >= 7 ? "dans la recommandation (7 h et plus)" : "sous les 7 h recommandées") : "note tes nuits dans Sommeil",
      note: nights[0] != null && nights[1] != null ? trend(nights[0] * 60, nights[1] * 60, "min") : null,
      color: "#8b5cf6",
    },
    {
      title: "Hydratation",
      value: glasses[0] != null ? `${((glasses[0] * 250) / 1000).toFixed(1).replace(".", ",")} L` : "—",
      sub: "moyenne par jour cette semaine",
      note: glasses[0] != null && glasses[1] != null ? trend(glasses[0] * 0.25, glasses[1] * 0.25, "L", 1) : null,
      color: "#3b82f6",
    },
    {
      title: "Poids",
      value: weights[0]?.value != null ? `${weights[0].value} kg` : "—",
      sub: w30.length > 1 ? `${(w30[0].value! - w30[w30.length - 1].value! >= 0 ? "+" : "")}${(w30[0].value! - w30[w30.length - 1].value!).toFixed(1).replace(".", ",")} kg sur 30 jours` : "ajoute une mesure ci-dessous",
      note: null,
      color: "#f0cd79",
    },
    {
      title: "Hygiène",
      value: `${hygieneDays} / 7 j`,
      sub: "jours avec la routine cochée",
      note: null,
      color: "#10b981",
    },
  ];
  return (
    <Block title="Résumé santé" hint="Tout ce que tu notes dans Santé, rassemblé et comparé à la semaine dernière." wide>
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.title} className="mod-stat" style={{ boxShadow: `inset 3px 0 0 ${c.color}, inset 0 1px 0 rgba(255,226,158,0.12)` }}>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide" style={{ color: c.color }}>
              {c.title}
            </span>
            <span className="mt-1 text-2xl font-semibold tabular-nums text-[var(--ink)]">{c.value}</span>
            <span className="text-xs text-[var(--ink-dim)]">{c.sub}</span>
            {c.note && <span className="mt-1 text-[0.7rem] text-[var(--ink-faint)]">{c.note}</span>}
          </li>
        ))}
      </ul>
    </Block>
  );
}

export function Corps({ module, today, entries, related }: ModuleProps) {
  const { add, pending } = useEntries(module);
  const height = entries.find((e) => e.kind === "height")?.value ?? null;
  const weight = entries.find((e) => e.kind === "weight")?.value ?? null;
  const [h, setH] = useState(height ? String(height) : "");
  const bmi = height && weight ? weight / (height / 100) ** 2 : null;

  return (
    <>
      <HealthSummary today={today} entries={entries} related={related} />
      <Block title="Indice de masse corporelle" hint="IMC = poids (kg) / taille (m)². Un repère de population : il ne distingue pas muscle et graisse." wide>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-[#f0cd79]">{bmi ? bmi.toFixed(1) : "—"}</p>
            <p className="text-xs text-[var(--ink-dim)]">{bmi ? bmiClass(bmi) : "Renseigne ta taille et ton poids"}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (h) add("height", { day: today, value: Number(h) });
            }}
            className="flex items-center gap-2"
          >
            <input type="number" value={h} onChange={(e) => setH(e.target.value)} placeholder="Taille (cm)" aria-label="Taille en cm" className={`${field} w-32`} />
            <button type="submit" disabled={pending} className="mod-chip focus-ring">
              Enregistrer
            </button>
          </form>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[0.68rem] text-[var(--ink-dim)]">
          {[
            ["< 18,5", "Insuffisance"],
            ["18,5–24,9", "Normale"],
            ["25–29,9", "Surpoids"],
            ["≥ 30", "Obésité"],
          ].map(([r, l], i) => {
            const on = bmi != null && [bmi < 18.5, bmi >= 18.5 && bmi < 25, bmi >= 25 && bmi < 30, bmi >= 30][i];
            return (
              <div key={r} className={`rounded-lg px-1 py-2 ${on ? "bg-[rgba(240,205,121,0.18)] text-[var(--ink)]" : "bg-[rgba(255,220,148,0.05)]"}`}>
                <p className="font-semibold tabular-nums">{r}</p>
                <p>{l}</p>
              </div>
            );
          })}
        </div>
      </Block>

      <LogBlock module={module} entries={entries} today={today} kind="weight" title="Poids" unit="kg" hint="Pèse-toi dans les mêmes conditions (le matin, à jeun) pour comparer ce qui est comparable." />
      <LogBlock
        module={module}
        entries={entries}
        today={today}
        kind="hr"
        title="Fréquence cardiaque au repos"
        unit="bpm"
        step="1"
        hint="Au réveil, avant de te lever, sur 60 s. Chez l'adulte, 60 à 100 bpm est la norme ; plus bas chez les sportifs."
        describe={(v) => (v < 60 ? "sous 60" : v <= 100 ? "dans la norme" : "au-dessus de 100")}
      />
      <LogBlock
        module={module}
        entries={entries}
        today={today}
        kind="waist"
        title="Tour de taille"
        unit="cm"
        hint="Au niveau du nombril, en fin d'expiration. Risque accru au-delà de 94 cm (hommes) ou 80 cm (femmes) selon l'OMS."
      />
    </>
  );
}

// =========================================================================== Sommeil

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const hours = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

export function Sommeil({ module, today, entries }: ModuleProps) {
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
  const bedtimes = [6, 5].map((c) => fmt(toMin(target) - c * 90 - 15));

  return (
    <>
      <Block title="Cette semaine" hint="Les adultes ont besoin d'au moins 7 heures de sommeil par nuit (AASM / Sleep Research Society) ; 7 à 9 h entre 18 et 64 ans." wide>
        <Stats
          items={[
            { label: "Moyenne", value: week.length ? hours(avg) : "—", sub: "7 dernières nuits", tone: "gold" },
            { label: "Nuits ≥ 7 h", value: `${enough} / ${week.length}` },
            { label: "Régularité", value: spread == null ? "—" : `± ${spread} min`, sub: "écart des heures de coucher" },
            { label: "Nuits notées", value: `${nights.length}` },
          ]}
        />
        <div className="mt-4">
          <DayBars days={lastDays(today, 7)} value={(d) => nights.find((n) => n.day === d)?.value ?? 0} target={8} unit="h" />
        </div>
      </Block>

      <Block title="Noter ma nuit" hint="Heure du coucher et du réveil ; la nuit est datée du matin.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add("sleep", { day: today, value: Math.round(duration * 100) / 100, data: { bed, wake } });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            Coucher
            <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={`${field} w-28`} />
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            Réveil
            <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={`${field} w-28`} />
          </label>
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Moon size={13} /> {hours(duration)}
          </button>
        </form>
        <ul className="mt-4 space-y-1.5">
          {nights.slice(0, 7).map((n) => (
            <li key={n.id} className="flex items-center justify-between text-xs text-[var(--ink-dim)]">
              <span>
                {dayLabel(n.day)} · {String(n.data.bed ?? "")} → {String(n.data.wake ?? "")}
              </span>
              <span className="flex items-center gap-2 tabular-nums text-[var(--ink)]">
                {hours(n.value!)}
                <button type="button" onClick={() => remove(n.id)} aria-label="Supprimer" className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                  <Trash2 size={12} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="À quelle heure me coucher ?" hint="Un cycle de sommeil dure environ 90 minutes ; se réveiller en fin de cycle aide à se sentir reposé.">
        <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
          Je veux me réveiller à
          <input type="time" value={target} onChange={(e) => setTarget(e.target.value)} className={`${field} w-28`} />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {bedtimes.map((t, i) => (
            <div key={t} className="mod-stat">
              <span className="text-2xl font-semibold tabular-nums text-[#f0cd79]">{t}</span>
              <span className="text-xs text-[var(--ink-dim)]">
                {i === 0 ? "6 cycles · 9 h" : "5 cycles · 7 h 30"}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <ScheduleButton title="Coucher" minutes={15} today={today} onSchedule={(x) => schedule({ ...x, start: bedtimes[1], end: fmt(toMin(bedtimes[1]) + 15) })} label="Ajouter le coucher au calendrier" />
        </div>
      </Block>

      <Block title="Bien dormir" hint="Les recommandations d'hygiène du sommeil les mieux établies." wide>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            ["Des horaires réguliers", "Se coucher et se lever à la même heure, week-end compris, stabilise l'horloge interne."],
            ["La lumière du matin", "S'exposer à la lumière du jour dans l'heure qui suit le réveil avance l'endormissement le soir."],
            ["Pas de caféine en fin de journée", "Prise même 6 h avant le coucher, la caféine réduit encore le sommeil (Drake et al., 2013)."],
            ["Une chambre fraîche et sombre", "Autour de 16–19 °C, dans le noir et au calme."],
            ["Écrans et lumière vive", "Les tamiser l'heure avant le coucher ; garder le lit pour dormir."],
            ["Siestes courtes", "20 à 30 minutes, en début d'après-midi, pour ne pas décaler la nuit."],
          ].map(([t, d]) => (
            <li key={t} className="tile px-3.5 py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{t}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">{d}</p>
            </li>
          ))}
        </ul>
      </Block>
    </>
  );
}

// =========================================================================== Hygiène

export function Hygiene({ module, today, entries }: ModuleProps) {
  return (
    <>
      <Block title="Routine du jour" hint="Coche au fil de la journée ; la série compte les jours où tout est fait.">
        <DailyChecklist
          module={module}
          entries={entries}
          today={today}
          items={[
            { key: "brush-am", label: "Brossage du matin", sub: "2 minutes, dentifrice fluoré" },
            { key: "brush-pm", label: "Brossage du soir", sub: "2 minutes, avant le coucher" },
            { key: "floss", label: "Fil dentaire ou brossettes", sub: "Une fois par jour, entre les dents" },
            { key: "shower", label: "Douche" },
            { key: "skin", label: "Soin du visage et écran solaire", sub: "FPS 30 ou plus, même par temps couvert" },
            { key: "hands", label: "Mains lavées avant les repas", sub: "20 secondes au savon" },
          ]}
        />
      </Block>

      <Block title="À renouveler" hint="Ce qui revient tous les quelques mois, calculé à partir de la dernière fois.">
        <RecurringList
          module={module}
          entries={entries}
          today={today}
          suggestions={[
            { text: "Changer de brosse à dents", period: 91 },
            { text: "Rendez-vous chez le dentiste", period: 182 },
            { text: "Changer les draps", period: 7 },
            { text: "Laver les serviettes", period: 7 },
            { text: "Coupe de cheveux", period: 30 },
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
