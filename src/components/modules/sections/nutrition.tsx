"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Droplet, Pencil, Plus, RefreshCw, ShoppingCart, Sparkles, Trash2, Utensils } from "lucide-react";
import { aiHelperAction } from "@/server/actions/ai.actions";
import {
  Block,
  Counter,
  DayBars,
  Empty,
  IconButton,
  Meter,
  ScheduleButton,
  Stats,
  field,
  lastDays,
  useEntries,
  type ModuleProps,
} from "@/components/modules/kit";
import {
  ACTIVITY,
  FOODS,
  GOALS,
  RECIPES,
  SLOTS,
  portion,
  targets,
  type Goal,
  type Macros,
  type NutritionProfile,
  type Sex,
} from "@/lib/nutrition";

const GLASS_ML = 250;
const n0 = (x: number) => Math.round(x).toLocaleString("fr-CA");

function MacroBar({ label, got, goal, unit = "g", tone }: { label: string; got: number; goal: number; unit?: string; tone: string }) {
  const pct = goal ? Math.min(100, (got / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[var(--ink)]">{label}</span>
        <span className="tabular-nums text-[var(--ink-dim)]">
          {n0(got)} / {n0(goal)} {unit}
        </span>
      </div>
      <div className="mod-meter">
        <span style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

/** Profile form: the few facts the targets are computed from. Weight and height come from Corps. */
function Setup({ initial, onSave, onCancel }: { initial: Partial<NutritionProfile>; onSave: (p: NutritionProfile) => void; onCancel?: () => void }) {
  const [p, setP] = useState({
    sex: (initial.sex ?? "homme") as Sex,
    age: String(initial.age ?? 22),
    height: String(initial.height ?? ""),
    weight: String(initial.weight ?? ""),
    activity: String(initial.activity ?? 1.55),
    goal: (initial.goal ?? "maintenir") as Goal,
  });
  const ok = Number(p.age) > 12 && Number(p.height) > 120 && Number(p.weight) > 30;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave({ sex: p.sex, age: Number(p.age), height: Number(p.height), weight: Number(p.weight), activity: Number(p.activity), goal: p.goal });
      }}
      className="space-y-4"
    >
      <div className="flex flex-wrap gap-1.5">
        {GOALS.map((g) => (
          <button key={g.key} type="button" data-on={g.key === p.goal || undefined} onClick={() => setP({ ...p, goal: g.key })} className="mod-tab focus-ring" title={g.desc}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={p.sex} onChange={(e) => setP({ ...p, sex: e.target.value as Sex })} aria-label="Sexe" className={`${field} cursor-pointer appearance-none`}>
          <option value="homme">Homme</option>
          <option value="femme">Femme</option>
        </select>
        <input type="number" value={p.age} onChange={(e) => setP({ ...p, age: e.target.value })} placeholder="Âge" aria-label="Âge" className={field} />
        <input type="number" value={p.height} onChange={(e) => setP({ ...p, height: e.target.value })} placeholder="Taille (cm)" aria-label="Taille en cm" className={field} />
        <input type="number" step="0.1" value={p.weight} onChange={(e) => setP({ ...p, weight: e.target.value })} placeholder="Poids (kg)" aria-label="Poids en kg" className={field} />
      </div>
      <select value={p.activity} onChange={(e) => setP({ ...p, activity: e.target.value })} aria-label="Niveau d'activité" className={`${field} w-full cursor-pointer appearance-none`}>
        {ACTIVITY.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label} — {a.desc}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" disabled={!ok} className="mod-chip mod-chip-gold focus-ring">
          <Check size={13} /> Calculer mon plan
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="mod-chip focus-ring">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

export function Nutrition({ module, today, entries, related }: ModuleProps) {
  const { add, update, remove, schedule, pending } = useEntries(module);
  const corps = related["sante:corps"] ?? [];
  const planRow = entries.find((e) => e.kind === "plan");
  const profile = planRow?.data as unknown as NutritionProfile | undefined;
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState(false);
  const t = profile ? targets(profile) : null;

  // Which recipe each slot shows today: rotates with the date, "Changer" steps through.
  const dayIndex = Math.floor(new Date(`${today}T12:00:00Z`).getTime() / 86400000);
  const [shift, setShift] = useState<Record<string, number>>({});
  const plan = useMemo(
    () =>
      SLOTS.map((s) => {
        const options = RECIPES.filter((r) => r.slot === s.key);
        const recipe = options[(dayIndex + (shift[s.key] ?? 0)) % options.length];
        const p = portion(recipe, (t?.kcal ?? 2000) * s.share);
        return { slot: s, recipe, ...p };
      }),
    [dayIndex, shift, t?.kcal]
  );

  const meals = entries.filter((e) => e.kind === "meal" && e.day === today);
  const eaten = meals.reduce<Macros>(
    (s, m) => {
      const x = (m.data.macros ?? {}) as Partial<Macros>;
      return { kcal: s.kcal + (x.kcal ?? m.value ?? 0), p: s.p + (x.p ?? 0), c: s.c + (x.c ?? 0), f: s.f + (x.f ?? 0), fib: s.fib + (x.fib ?? 0) };
    },
    { kcal: 0, p: 0, c: 0, f: 0, fib: 0 }
  );

  const water = entries.filter((e) => e.kind === "water");
  const todayWater = water.find((w) => w.day === today);
  const glasses = todayWater?.value ?? 0;
  const waterTarget = Math.round((t ? t.water * 0.75 : 2000) / GLASS_ML); // ~75 % of total water comes from drinks
  const setGlasses = (n: number) => (todayWater ? update(todayWater.id, { value: n }) : add("water", { day: today, value: n }));
  const [free, setFree] = useState("");
  const [freeKcal, setFreeKcal] = useState("");
  const [estimating, setEstimating] = useState(false);

  const save = (p: NutritionProfile) => {
    const tt = targets(p);
    const data = { ...p, kcal: tt.kcal, protein: tt.protein, carbs: tt.carbs, fat: tt.fat };
    if (planRow) update(planRow.id, { data });
    else add("plan", { data });
    setEditing(false);
  };

  if (!profile || editing) {
    const latest = (k: string) => corps.find((e) => e.kind === k)?.value ?? undefined;
    return (
      <Block
        title={profile ? "Modifier mon profil" : "Ton plan nutritionnel"}
        hint="Quelques informations, et l'app calcule tes besoins, tes macros et un plan de repas chaque jour — comme le ferait un nutritionniste."
        wide
      >
        <Setup initial={{ ...profile, height: profile?.height ?? latest("height"), weight: profile?.weight ?? latest("weight") }} onSave={save} onCancel={profile ? () => setEditing(false) : undefined} />
      </Block>
    );
  }

  const left = t!.kcal - eaten.kcal;

  return (
    <>
      <Block
        title={`Objectif : ${GOALS.find((g) => g.key === profile.goal)?.label.toLowerCase()}`}
        action={
          <IconButton label="Modifier le profil" onClick={() => setEditing(true)}>
            <Pencil size={13} />
          </IconButton>
        }
        wide
      >
        <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className="text-center md:text-left">
            <p className="text-4xl font-semibold tabular-nums text-[#f0cd79]">{n0(t!.kcal)}</p>
            <p className="text-xs text-[var(--ink-dim)]">kcal par jour</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              {left >= 0 ? `Il te reste ${n0(left)} kcal aujourd'hui` : `${n0(-left)} kcal au-dessus de l'objectif`}
            </p>
          </div>
          <div className="space-y-2.5">
            <MacroBar label="Calories" got={eaten.kcal} goal={t!.kcal} unit="kcal" tone="linear-gradient(90deg,#a6761f,#ffe9a0)" />
            <MacroBar label="Protéines" got={eaten.p} goal={t!.protein} tone="linear-gradient(90deg,#b4472b,#f2876a)" />
            <MacroBar label="Glucides" got={eaten.c} goal={t!.carbs} tone="linear-gradient(90deg,#3a6fb0,#8ab8f0)" />
            <MacroBar label="Lipides" got={eaten.f} goal={t!.fat} tone="linear-gradient(90deg,#7d5bb5,#c3a6f2)" />
            <MacroBar label="Fibres" got={eaten.fib} goal={t!.fiber} tone="linear-gradient(90deg,#2f8a55,#86d6a4)" />
          </div>
        </div>
        <button type="button" onClick={() => setWhy(!why)} className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#f0cd79]">
          <ChevronDown size={14} className={`transition-transform ${why ? "rotate-180" : ""}`} /> Pourquoi ces chiffres ?
        </button>
        {why && (
          <ol className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--ink-dim)]">
            {t!.why.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="tabular-nums text-[var(--ink-faint)]">{i + 1}.</span>
                {w}
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Block title="Ton menu du jour" hint="Les portions sont calculées pour ton objectif. Change un repas s'il ne te tente pas, planifie-le, ou envoie ses ingrédients aux courses." wide>
        <ul className="grid gap-3 md:grid-cols-2">
          {plan.map(({ slot, recipe, items, macros }) => {
            const logged = meals.some((m) => m.data.recipe === recipe.key);
            return (
              <li key={slot.key} className="tile flex flex-col gap-2.5 px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#f0cd79]">
                      {slot.label} · {slot.time}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{recipe.name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">{n0(macros.kcal)} kcal</span>
                </div>
                <p className="text-xs leading-5 text-[var(--ink-dim)]">
                  {Object.entries(items)
                    .map(([f, g]) => `${FOODS[f].label} ${g} g`)
                    .join(" · ")}
                </p>
                <p className="text-xs text-[var(--ink-faint)]">
                  P {n0(macros.p)} g · G {n0(macros.c)} g · L {n0(macros.f)} g · fibres {n0(macros.fib)} g · {recipe.minutes} min — {recipe.steps}
                </p>
                <p className="text-[0.7rem] italic text-[var(--ink-faint)]">Quand : {slot.when}.</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pending || logged}
                    onClick={() => add("meal", { day: today, text: recipe.name, value: Math.round(macros.kcal), data: { slot: slot.label, recipe: recipe.key, macros } })}
                    className="mod-chip mod-chip-gold focus-ring"
                  >
                    <Utensils size={12} /> {logged ? "Mangé" : "Je l'ai mangé"}
                  </button>
                  <button type="button" onClick={() => setShift({ ...shift, [slot.key]: (shift[slot.key] ?? 0) + 1 })} className="mod-chip focus-ring">
                    <RefreshCw size={12} /> Changer
                  </button>
                  <ScheduleButton title={`${slot.label} : ${recipe.name}`} minutes={30} today={today} defaultTime={slot.time} onSchedule={(x) => schedule(x)} />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => Object.keys(items).forEach((f) => add("item", { text: FOODS[f].label, data: { aisle: FOODS[f].aisle } }, "quotidien:courses"))}
                    className="mod-chip focus-ring"
                  >
                    <ShoppingCart size={12} /> Courses
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Block>

      <Block title="Journal du jour" hint="Ce qui sort du menu : décris-le en mots (« un bol de riz au poulet et une pomme ») et l'assistant estime les calories et les macros.">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!free.trim()) return;
            const text = free.trim();
            // Calories typed by hand win; otherwise the assistant estimates the meal.
            if (freeKcal) {
              add("meal", { day: today, text, value: Number(freeKcal), data: { slot: "Autre" } });
            } else {
              setEstimating(true);
              const res = await aiHelperAction({ kind: "meal", text });
              setEstimating(false);
              if ("error" in res) add("meal", { day: today, text, value: null, data: { slot: "Autre" } });
              else {
                const r = res.result as { kcal: number; protein: number; carbs: number; fat: number; fiber?: number; note?: string };
                add("meal", { day: today, text, value: Math.round(r.kcal), data: { slot: "Autre", estimated: true, note: r.note ?? "", macros: { kcal: r.kcal, p: r.protein, c: r.carbs, f: r.fat, fib: r.fiber ?? 0 } } });
              }
            }
            setFree("");
            setFreeKcal("");
          }}
          className="mb-3 flex flex-wrap gap-2"
        >
          <input value={free} onChange={(e) => setFree(e.target.value)} placeholder="Ce que tu as mangé" aria-label="Aliment" className={`${field} flex-1 basis-40`} />
          <input type="number" value={freeKcal} onChange={(e) => setFreeKcal(e.target.value)} placeholder="kcal" aria-label="Calories" className={`${field} w-24`} />
          <button type="submit" disabled={pending || estimating} className="mod-chip mod-chip-gold focus-ring">
            {freeKcal ? <Plus size={13} /> : <Sparkles size={13} />} {estimating ? "Estimation…" : freeKcal ? "Ajouter" : "Analyser et ajouter"}
          </button>
        </form>
        {meals.length === 0 ? (
          <Empty>Rien de noté aujourd&apos;hui.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {meals.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 text-[var(--ink)]">
                  <span className="text-xs text-[var(--ink-faint)]">{String(m.data.slot ?? "")} · </span>
                  {m.text}
                  {Boolean(m.data.estimated) && (m.data.macros as Macros | undefined) && (
                    <span className="block text-[0.7rem] text-[var(--ink-faint)]">
                      estimé · P {n0((m.data.macros as Macros).p)} g · G {n0((m.data.macros as Macros).c)} g · L {n0((m.data.macros as Macros).f)} g
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-[var(--ink-dim)]">
                  {m.value ? `${n0(m.value)} kcal` : "—"}
                  <button type="button" onClick={() => remove(m.id)} aria-label="Supprimer" className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                    <Trash2 size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Hydratation" hint={`Environ ${(t!.water / 1000).toFixed(1).replace(".", ",")} L d'eau par jour au total ; les boissons en apportent les trois quarts.`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Droplet className="text-[#f0cd79]" size={28} />
            <div>
              <p className="text-2xl font-semibold tabular-nums text-[var(--ink)]">{((glasses * GLASS_ML) / 1000).toFixed(2).replace(".", ",")} L</p>
              <p className="text-xs text-[var(--ink-dim)]">
                {glasses} / {waterTarget} verres de 250 ml
              </p>
            </div>
          </div>
          <Counter value={glasses} onChange={setGlasses} max={24} />
        </div>
        <div className="mt-4">
          <DayBars days={lastDays(today, 7)} value={(d) => water.find((w) => w.day === d)?.value ?? 0} target={waterTarget} unit="verres" />
        </div>
      </Block>

      <Block title="Les conseils de ton nutritionniste" wide>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(ADVICE[profile.goal] ?? []).concat(ADVICE.all).map(([title, text]) => (
            <li key={title} className="tile px-3.5 py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Stats
            items={[
              { label: "Métabolisme de base", value: `${n0(t!.bmr)} kcal` },
              { label: "Dépense totale", value: `${n0(t!.tdee)} kcal` },
              { label: "Protéines / repas", value: `${n0(t!.protein / 4)} g`, sub: "sur 4 prises" },
              { label: "Eau", value: `${(t!.water / 1000).toFixed(1).replace(".", ",")} L` },
            ]}
          />
        </div>
        <div className="mt-3">
          <Meter value={eaten.p} max={t!.protein} label="Protéines du jour" />
        </div>
      </Block>
    </>
  );
}

const ADVICE: Record<string, [string, string][]> = {
  perdre: [
    ["Des protéines à chaque repas", "Elles rassasient le plus et protègent ta masse musculaire pendant le déficit : vise un quart de l'assiette."],
    ["Le volume avant tout", "Légumes, soupes, fruits entiers : beaucoup de volume pour peu de calories, la faim recule."],
    ["Attention aux calories liquides", "Jus, sodas, cafés sucrés et alcool s'additionnent vite sans rassasier."],
    ["Pèse-toi sur la moyenne", "Le poids varie de 1 à 2 kg d'un jour à l'autre (eau, sel). Compare les moyennes d'une semaine à l'autre."],
  ],
  maintenir: [
    ["Varie les couleurs", "Plus l'assiette est colorée, plus les vitamines et les fibres sont variées."],
    ["Écoute ta faim", "Mange à heures régulières et arrête-toi à satiété, sans écran si possible."],
  ],
  prendre: [
    ["Répartis les protéines", "Environ 0,4 g/kg à chaque repas, sur 4 prises, maximise la construction musculaire (Schoenfeld & Aragon, 2018)."],
    ["Glucides autour de l'entraînement", "Un repas avec des glucides 1 à 3 h avant, et protéines + glucides dans les heures qui suivent."],
    ["Un surplus modéré", "Au-delà de +300 kcal, le gain se fait surtout en gras. Vise +0,25 à 0,5 % du poids par semaine."],
  ],
  all: [
    ["Le dernier repas", "2 à 3 heures avant le coucher : la digestion perturbe moins le sommeil."],
    ["Des grains entiers", "Avoine, quinoa, riz brun, pain complet : plus de fibres, une énergie plus stable."],
  ],
};

export const NUTRITION_SOURCES = [
  "Mifflin M.D. et al., A new predictive equation for resting energy expenditure, Am J Clin Nutr 51(2) (1990).",
  "Jäger R. et al., ISSN Position Stand: protein and exercise, J Int Soc Sports Nutr 14:20 (2017).",
  "Schoenfeld B.J. & Aragon A.A., How much protein can the body use in a single meal?, J Int Soc Sports Nutr 15:10 (2018).",
  "Institute of Medicine, Dietary Reference Intakes (2005) : fibres 14 g / 1 000 kcal. EFSA, valeurs de référence pour l'eau (2010).",
  "Santé Canada, Guide alimentaire canadien (2019). Valeurs nutritives : USDA FoodData Central, Fichier canadien sur les éléments nutritifs.",
];
