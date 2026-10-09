"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Dumbbell, Plus, Sparkles, Trash2, Trophy } from "lucide-react";
import { Block, Empty, IconButton, Sparkline, Stats, addDays, dayLabel, field, useEntries, type Entry } from "@/components/modules/kit";
import { aiHelperAction } from "@/server/actions/ai.actions";

/** Estimated one-rep max (Epley): the usual way to compare sets of different reps. */
const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

/**
 * The gym log of Hevy or Strong: exercise, load, reps and sets; personal records by
 * estimated 1RM, weekly volume, and the progression of the exercise picked.
 */
export function StrengthLog({ module, today, entries, exercises }: { module: string; today: string; entries: Entry[]; exercises: string[] }) {
  const { add, remove, pending } = useEntries(module);
  const [exercise, setExercise] = useState(exercises[0] ?? "");
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("8");
  const [sets, setSets] = useState("3");
  const rows = entries.filter((e) => e.kind === "set");

  const records = useMemo(() => {
    const best = new Map<string, { kg: number; reps: number; e1: number; day: string }>();
    for (const r of rows) {
      const ex = String(r.data.exercise ?? "");
      const k = Number(r.data.kg ?? 0);
      const rp = Number(r.data.reps ?? 0);
      const v = e1rm(k, rp);
      if (!best.has(ex) || v > best.get(ex)!.e1) best.set(ex, { kg: k, reps: rp, e1: v, day: r.day });
    }
    return [...best.entries()].sort((a, b) => b[1].e1 - a[1].e1);
  }, [rows]);

  const weekFrom = addDays(today, -6);
  const volume = rows.filter((r) => r.day >= weekFrom).reduce((s, r) => s + Number(r.data.kg ?? 0) * Number(r.data.reps ?? 0) * Number(r.data.sets ?? 1), 0);
  const progression = rows
    .filter((r) => r.data.exercise === exercise)
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => Math.round(e1rm(Number(r.data.kg ?? 0), Number(r.data.reps ?? 0))));
  const last = rows.filter((r) => r.data.exercise === exercise).sort((a, b) => b.day.localeCompare(a.day))[0];

  return (
    <Block title="Journal de musculation" hint="Note chaque exercice : charge, répétitions, séries. Records calculés par 1RM estimé (formule d'Epley)." wide>
      <Stats
        items={[
          { label: "Volume 7 j", value: `${Math.round(volume).toLocaleString("fr-CA")} kg`, tone: "gold" },
          { label: "Séries notées", value: String(rows.length) },
          { label: "Exercices suivis", value: String(records.length) },
          { label: "Record", value: records[0] ? `${Math.round(records[0][1].e1)} kg` : "—", sub: records[0]?.[0] },
        ]}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const k = Number(kg.replace(",", "."));
          if (!exercise.trim() || !Number.isFinite(k)) return;
          add("set", { day: today, text: exercise, value: k, data: { exercise: exercise.trim(), kg: k, reps: Number(reps), sets: Number(sets) } });
          setKg("");
        }}
        className="mt-4 flex flex-wrap items-center gap-2"
      >
        <input list="sport-exercises" value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="Exercice" aria-label="Exercice" className={`${field} min-w-0 flex-1 basis-44`} />
        <datalist id="sport-exercises">
          {exercises.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <input value={kg} onChange={(e) => setKg(e.target.value)} inputMode="decimal" placeholder={last ? `${last.data.kg} kg` : "kg"} aria-label="Charge en kg" className={`${field} w-20`} />
        <span className="text-xs text-[var(--ink-dim)]">×</span>
        <input value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Répétitions" className={`${field} w-16`} />
        <span className="text-xs text-[var(--ink-dim)]">reps ×</span>
        <input value={sets} onChange={(e) => setSets(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Séries" className={`${field} w-14`} />
        <span className="text-xs text-[var(--ink-dim)]">séries</span>
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          <Plus size={13} /> Noter
        </button>
      </form>
      {last && (
        <p className="mt-2 text-xs text-[var(--ink-dim)]">
          Dernière fois ({dayLabel(last.day)}) : {String(last.data.kg)} kg × {String(last.data.reps)} × {String(last.data.sets)}. Pour progresser, ajoute 1 répétition ou 2,5 kg.
        </p>
      )}
      {progression.length > 1 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-[var(--ink-faint)]">Progression · {exercise} (1RM estimé)</p>
          <Sparkline points={progression} />
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
            <Trophy size={12} className="text-[#f0cd79]" /> Records
          </p>
          {records.length === 0 ? (
            <Empty>Tes records apparaîtront ici.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {records.slice(0, 8).map(([ex, r]) => (
                <li key={ex} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{ex}</span>
                  <span className="text-xs text-[var(--ink-dim)]">
                    {r.kg} kg × {r.reps}
                  </span>
                  <span className="w-16 text-right text-xs font-semibold text-[#f0cd79]">{Math.round(r.e1)} kg</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Dernières séries</p>
          {rows.length === 0 ? (
            <Empty>Rien de noté pour l&apos;instant.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {[...rows]
                .sort((a, b) => b.day.localeCompare(a.day))
                .slice(0, 8)
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    <span className="w-14 shrink-0 text-xs text-[var(--ink-faint)]">{r.day === today ? "Auj." : dayLabel(r.day, { day: "numeric", month: "short" })}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{String(r.data.exercise)}</span>
                    <span className="text-xs text-[var(--ink-dim)]">
                      {String(r.data.kg)} × {String(r.data.reps)} × {String(r.data.sets)}
                    </span>
                    <IconButton label="Supprimer" onClick={() => remove(r.id)} disabled={pending}>
                      <Trash2 size={12} />
                    </IconButton>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </Block>
  );
}

interface Program {
  name: string;
  sessions: { title: string; focus?: string; exercises: { name: string; sets: number; reps: string; rest?: string }[] }[];
  advice?: string;
}

const GOALS = ["Prise de muscle", "Perte de poids", "Force", "Endurance", "Forme générale", "Préparation d'un sport"];
const LEVELS = ["Débutant", "Intermédiaire", "Avancé"];
const EQUIPMENT = ["Salle complète", "Haltères à la maison", "Poids du corps", "Élastiques"];

/**
 * A programme built for you (as Fitbod does): goal, days a week, level, equipment and time.
 * Saved in the section, and its sessions can be put on the calendar for the coming week.
 */
export function ProgramBuilder({ module, today, entries }: { module: string; today: string; entries: Entry[] }) {
  const { add, remove, schedule, pending } = useEntries(module);
  const saved = entries.find((e) => e.kind === "program");
  const [goal, setGoal] = useState(GOALS[0]);
  const [days, setDays] = useState("3");
  const [level, setLevel] = useState(LEVELS[0]);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  const [minutes, setMinutes] = useState("50");
  const [draft, setDraft] = useState<Program | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [time, setTime] = useState("18:00");
  const program = draft ?? ((saved?.data.program as Program | undefined) ?? null);

  const generate = async () => {
    setBusy(true);
    setNote(null);
    const res = await aiHelperAction({ kind: "program", goal, days: Number(days), level, equipment, minutes: Number(minutes) });
    setBusy(false);
    if ("error" in res) return setNote(res.error);
    setDraft(res.result as unknown as Program);
  };
  const save = () => {
    if (!draft) return;
    if (saved) remove(saved.id);
    add("program", { text: draft.name, data: { program: draft, goal, level, equipment } });
    setDraft(null);
    setNote("Programme enregistré.");
  };
  // One session every other day from tomorrow, at the chosen time.
  const planWeek = () => {
    if (!program) return;
    const gap = Math.max(1, Math.floor(7 / program.sessions.length));
    program.sessions.forEach((s, i) => {
      const day = addDays(today, 1 + i * gap);
      const [h, m] = time.split(":").map(Number);
      const end = h * 60 + m + Number(minutes);
      schedule({ title: s.title, day, start: time, end: `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`, notes: s.exercises.map((x) => `${x.name} ${x.sets} × ${x.reps}`).join(" · ") });
    });
    setNote(`${program.sessions.length} séance${program.sessions.length > 1 ? "s" : ""} ajoutée${program.sessions.length > 1 ? "s" : ""} à ton calendrier.`);
  };

  return (
    <Block title="Programme sur mesure" hint="L'assistant construit un programme sûr et progressif (recommandations ACSM) pour ton objectif, ton niveau et ton matériel." wide>
      <div className="flex flex-wrap gap-2">
        <select value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Objectif" className={`${field} cursor-pointer appearance-none`}>
          {GOALS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <select value={days} onChange={(e) => setDays(e.target.value)} aria-label="Jours par semaine" className={`${field} w-32 cursor-pointer appearance-none`}>
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} jours / sem.
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Niveau" className={`${field} w-36 cursor-pointer appearance-none`}>
          {LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="Matériel" className={`${field} cursor-pointer appearance-none`}>
          {EQUIPMENT.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Durée par séance" className={`${field} w-28 cursor-pointer appearance-none`}>
          {[30, 45, 50, 60, 75, 90].map((n) => (
            <option key={n} value={n}>
              {n} min
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void generate()} disabled={busy} className="mod-chip mod-chip-gold focus-ring">
          <Sparkles size={13} /> {busy ? "Je construis ton programme…" : saved ? "Nouveau programme" : "Créer mon programme"}
        </button>
      </div>
      {note && <p className="mt-3 text-xs text-[#f0cd79]">{note}</p>}

      {program && (
        <div className="mt-4 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <Dumbbell size={15} className="text-[#f0cd79]" /> {program.name}
            {draft && <span className="text-xs font-normal text-[var(--ink-faint)]">· aperçu</span>}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {program.sessions.map((s, i) => (
              <div key={i} className="tile px-4 py-3">
                <p className="text-sm font-semibold text-[var(--ink)]">{s.title}</p>
                {s.focus && <p className="text-xs text-[var(--ink-dim)]">{s.focus}</p>}
                <ul className="mt-2 space-y-1">
                  {s.exercises.map((x, j) => (
                    <li key={j} className="flex gap-2 text-xs text-[var(--ink-dim)]">
                      <span className="min-w-0 flex-1 text-[var(--ink)]">{x.name}</span>
                      <span>
                        {x.sets} × {x.reps}
                      </span>
                      {x.rest && <span className="text-[var(--ink-faint)]">{x.rest}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {program.advice && <p className="rounded-2xl bg-[rgba(240,205,121,0.08)] px-4 py-3 text-xs leading-5 text-[var(--ink-dim)]">{program.advice}</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {draft ? (
              <>
                <button type="button" onClick={() => setDraft(null)} className="mod-chip focus-ring">
                  Ignorer
                </button>
                <button type="button" onClick={save} disabled={pending} className="mod-chip mod-chip-gold focus-ring">
                  Garder ce programme
                </button>
              </>
            ) : (
              <>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Heure des séances" className={`${field} w-28`} />
                <button type="button" onClick={planWeek} disabled={pending} className="mod-chip mod-chip-gold focus-ring">
                  <CalendarPlus size={13} /> Planifier la semaine
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Block>
  );
}
