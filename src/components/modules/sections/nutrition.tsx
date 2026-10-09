"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Droplet, Pencil, Plus, RefreshCw, ShieldAlert, ShoppingCart, Sparkles, Trash2, Undo2, Utensils } from "lucide-react";
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
  ALLERGENS,
  DIETS,
  FOODS,
  GOALS,
  activityText,
  aisleLabel,
  allergenLabel,
  dayMenu,
  dietLabel,
  foodConflictText,
  foodLabel,
  goalText,
  gramsLabelFor,
  recipeName,
  recipeNameByKey,
  recipeSteps,
  sanitizeFoodPrefs,
  slotText,
  storedSlotLabel,
  shoppingList,
  targets,
  targetsWhy,
  weekMenu,
  type FoodPrefs,
  type Goal,
  type Macros,
  type NutritionProfile,
  type Sex,
  type Slot,
} from "@/lib/nutrition";
import { addGroceriesAction, removeGroceriesAction } from "@/server/actions/nutrition.actions";
import { useI18n } from "@/i18n/client";
import { INTL, fmt, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

const GLASS_ML = 250;
const n0 = (x: number, locale: Locale) => Math.round(x).toLocaleString(INTL[locale]);
const dec = (x: number, digits: number, locale: Locale) => x.toLocaleString(INTL[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** What a meal row stored as its slot (a French label, or "Autre"), in the reader's language. */
const slotShown = (stored: unknown, n: Messages["modulesA"]["nutrition"], locale: Locale) => {
  const s = String(stored ?? "");
  if (!s) return "";
  return storedSlotLabel(s, locale) ?? (s === "Autre" ? n.other : s);
};
/** The confirmation after sending groceries, or what went wrong. */
const groceryMessage = (r: Awaited<ReturnType<typeof addGroceriesAction>>, n: Messages["modulesA"]["nutrition"], skippedTemplate: string) => {
  if ("error" in r) return n.groceryError;
  if (!r.added) return n.allThere;
  return `${r.added === 1 ? n.addedOne : fmt(n.addedMany, { n: r.added })}${r.skipped ? fmt(skippedTemplate, { n: r.skipped }) : ""}.`;
};

function MacroBar({ label, got, goal, unit = "g", tone }: { label: string; got: number; goal: number; unit?: string; tone: string }) {
  const { locale } = useI18n();
  const pct = goal ? Math.min(100, (got / goal) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[var(--ink)]">{label}</span>
        <span className="tabular-nums text-[var(--ink-dim)]">
          {n0(got, locale)} / {n0(goal, locale)} {unit}
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
  const { t, locale } = useI18n();
  const n = t.modulesA.nutrition;
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
          <button key={g.key} type="button" data-on={g.key === p.goal || undefined} onClick={() => setP({ ...p, goal: g.key })} className="mod-tab focus-ring" title={goalText(g.key, locale).desc}>
            {goalText(g.key, locale).label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={p.sex} onChange={(e) => setP({ ...p, sex: e.target.value as Sex })} aria-label={n.sex} className={`${field} cursor-pointer appearance-none`}>
          <option value="homme">{n.male}</option>
          <option value="femme">{n.female}</option>
        </select>
        <input type="number" value={p.age} onChange={(e) => setP({ ...p, age: e.target.value })} placeholder={n.age} aria-label={n.age} className={field} />
        <input type="number" value={p.height} onChange={(e) => setP({ ...p, height: e.target.value })} placeholder={n.heightPlaceholder} aria-label={n.heightAria} className={field} />
        <input type="number" step="0.1" value={p.weight} onChange={(e) => setP({ ...p, weight: e.target.value })} placeholder={n.weightPlaceholder} aria-label={n.weightAria} className={field} />
      </div>
      <select value={p.activity} onChange={(e) => setP({ ...p, activity: e.target.value })} aria-label={n.activityLevel} className={`${field} w-full cursor-pointer appearance-none`}>
        {ACTIVITY.map((a) => (
          <option key={a.key} value={a.key}>
            {activityText(a, locale).label} — {activityText(a, locale).desc}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" disabled={!ok} className="mod-chip mod-chip-gold focus-ring">
          <Check size={13} /> {n.compute}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="mod-chip focus-ring">
            {t.common.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

export function Nutrition({ module, today, entries, related }: ModuleProps) {
  const { t: i18n, locale } = useI18n();
  const n = i18n.modulesA.nutrition;
  const { add, update, remove, schedule, pending } = useEntries(module);
  const corps = related["sante:corps"] ?? [];
  const planRow = entries.find((e) => e.kind === "plan");
  const profile = planRow?.data as unknown as NutritionProfile | undefined;
  const [editing, setEditing] = useState(false);
  const [why, setWhy] = useState(false);
  const t = profile ? targets(profile) : null;
  const whyLines = profile ? targetsWhy(profile, locale) : [];

  const prefs = sanitizeFoodPrefs((planRow?.data as { prefs?: unknown } | undefined)?.prefs);
  // Which recipe each slot shows today: rotates with the date, "Changer" steps through;
  // only recipes that respect every restriction are ever offered.
  const [shift, setShift] = useState<Partial<Record<Slot, number>>>({});
  const plan = dayMenu(today, t?.kcal ?? 2000, prefs, shift).map((p) => ({
    ...p,
    st: slotText(p.slot, locale),
    name: p.recipe ? recipeName(p.recipe, locale) : "",
    steps: p.recipe ? recipeSteps(p.recipe, locale) : "",
  }));
  const [groceryNote, setGroceryNote] = useState<string | null>(null);
  const toGroceries = async (items: Record<string, number>) => {
    try {
      const r = await addGroceriesAction(Object.entries(items).map(([food, grams]) => ({ food, grams })));
      setGroceryNote(groceryMessage(r, n, n.skippedParen));
    } catch {
      setGroceryNote(i18n.common.serverDown);
    }
  };

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
  const [estimateFailed, setEstimateFailed] = useState(false);

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
        title={profile ? n.editProfile : n.yourPlan}
        hint={n.setupHint}
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
        title={fmt(n.goalTitle, { goal: GOALS.some((g) => g.key === profile.goal) ? goalText(profile.goal, locale).label.toLowerCase() : "" })}
        action={
          <IconButton label={n.editProfileAria} onClick={() => setEditing(true)}>
            <Pencil size={13} />
          </IconButton>
        }
        wide
      >
        <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className="text-center md:text-left">
            <p className="text-4xl font-semibold tabular-nums text-[#f0cd79]">{n0(t!.kcal, locale)}</p>
            <p className="text-xs text-[var(--ink-dim)]">{n.kcalPerDay}</p>
            <p className="mt-2 text-sm text-[var(--ink)]">
              {left >= 0 ? fmt(n.left, { n: n0(left, locale) }) : fmt(n.over, { n: n0(-left, locale) })}
            </p>
          </div>
          <div className="space-y-2.5">
            <MacroBar label={n.calories} got={eaten.kcal} goal={t!.kcal} unit="kcal" tone="linear-gradient(90deg,#a6761f,#ffe9a0)" />
            <MacroBar label={n.protein} got={eaten.p} goal={t!.protein} tone="linear-gradient(90deg,#b4472b,#f2876a)" />
            <MacroBar label={n.carbs} got={eaten.c} goal={t!.carbs} tone="linear-gradient(90deg,#3a6fb0,#8ab8f0)" />
            <MacroBar label={n.fat} got={eaten.f} goal={t!.fat} tone="linear-gradient(90deg,#7d5bb5,#c3a6f2)" />
            <MacroBar label={n.fiber} got={eaten.fib} goal={t!.fiber} tone="linear-gradient(90deg,#2f8a55,#86d6a4)" />
          </div>
        </div>
        <button type="button" onClick={() => setWhy(!why)} className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#f0cd79]">
          <ChevronDown size={14} className={`transition-transform ${why ? "rotate-180" : ""}`} /> {n.why}
        </button>
        {why && (
          <ol className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--ink-dim)]">
            {whyLines.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="tabular-nums text-[var(--ink-faint)]">{i + 1}.</span>
                {w}
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Block title={n.menuTitle} hint={n.menuHint} wide>
        <ul className="grid gap-3 md:grid-cols-2">
          {plan.map(({ slot, recipe, items, macros, st, name, steps }) => {
            if (!recipe)
              return (
                <li key={slot.key} className="tile flex flex-col gap-1.5 px-4 py-3.5">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#f0cd79]">
                    {st.label} · {slot.time}
                  </p>
                  <p className="text-xs leading-5 text-[var(--ink-dim)]">{n.noRecipe}</p>
                </li>
              );
            const logged = meals.some((m) => m.data.recipe === recipe.key);
            return (
              <li key={slot.key} className="tile flex flex-col gap-2.5 px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#f0cd79]">
                      {st.label} · {slot.time}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{name}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">{n0(macros.kcal, locale)} kcal</span>
                </div>
                <p className="text-xs leading-5 text-[var(--ink-dim)]">
                  {Object.entries(items)
                    .map(([f, g]) => fmt(n.ingredient, { food: foodLabel(f, locale), g }))
                    .join(" · ")}
                </p>
                <p className="text-xs text-[var(--ink-faint)]">
                  {fmt(n.macroLine, { p: n0(macros.p, locale), c: n0(macros.c, locale), f: n0(macros.f, locale), fib: n0(macros.fib, locale), min: recipe.minutes, steps })}
                </p>
                <p className="text-[0.7rem] italic text-[var(--ink-faint)]">{fmt(n.when, { when: st.when })}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pending || logged}
                    onClick={() => add("meal", { day: today, text: recipe.name, value: Math.round(macros.kcal), data: { slot: slot.label, recipe: recipe.key, macros } })}
                    className="mod-chip mod-chip-gold focus-ring"
                  >
                    <Utensils size={12} /> {logged ? n.eaten : n.ate}
                  </button>
                  <button type="button" onClick={() => setShift({ ...shift, [slot.key]: (shift[slot.key] ?? 0) + 1 })} className="mod-chip focus-ring" aria-label={fmt(n.changeAria, { slot: st.label.toLowerCase() })}>
                    <RefreshCw size={12} /> {n.change}
                  </button>
                  <ScheduleButton title={fmt(n.mealEvent, { slot: st.label, name })} minutes={30} today={today} defaultTime={slot.time} onSchedule={(x) => schedule(x)} />
                  <button type="button" disabled={pending} onClick={() => toGroceries(items)} className="mod-chip focus-ring">
                    <ShoppingCart size={12} /> {n.groceries}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {groceryNote && (
          <p role="status" className="mt-3 text-xs text-[var(--ink-dim)]">
            {groceryNote}
          </p>
        )}
      </Block>

      <FoodPrefsBlock prefs={prefs} pending={pending} onSave={(p) => planRow && update(planRow.id, { data: { prefs: p } })} />

      <WeekBlock today={today} kcal={t!.kcal} prefs={prefs} />

      <Block title={n.journalTitle} hint={n.journalHint}>
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
              setEstimateFailed(false);
              const res = await aiHelperAction({ kind: "meal", text }).catch(() => ({ error: "unreachable" }) as const);
              setEstimating(false);
              if ("error" in res) {
                add("meal", { day: today, text, value: null, data: { slot: "Autre" } });
                setEstimateFailed(true);
              }
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
          <input value={free} onChange={(e) => setFree(e.target.value)} placeholder={n.foodPlaceholder} aria-label={n.foodAria} className={`${field} flex-1 basis-40`} />
          <input type="number" value={freeKcal} onChange={(e) => setFreeKcal(e.target.value)} placeholder="kcal" aria-label={n.calories} className={`${field} w-24`} />
          <button type="submit" disabled={pending || estimating} className="mod-chip mod-chip-gold focus-ring">
            {freeKcal ? <Plus size={13} /> : <Sparkles size={13} />} {estimating ? n.estimating : freeKcal ? n.add : n.analyze}
          </button>
        </form>
        {estimateFailed && (
          <p role="status" className="mb-3 rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">
            {n.notEstimated}
          </p>
        )}
        {meals.length === 0 ? (
          <Empty>{n.journalEmpty}</Empty>
        ) : (
          <ul className="space-y-1.5">
            {meals.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 text-[var(--ink)]">
                  <span className="text-xs text-[var(--ink-faint)]">{slotShown(m.data.slot, n, locale)} · </span>
                  {(typeof m.data.recipe === "string" && recipeNameByKey(m.data.recipe, locale)) || m.text}
                  {Boolean(m.data.estimated) && (m.data.macros as Macros | undefined) && (
                    <span className="block text-[0.7rem] text-[var(--ink-faint)]">
                      {fmt(n.estimated, { p: n0((m.data.macros as Macros).p, locale), c: n0((m.data.macros as Macros).c, locale), f: n0((m.data.macros as Macros).f, locale) })}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-[var(--ink-dim)]">
                  {m.value ? `${n0(m.value, locale)} kcal` : "—"}
                  <button type="button" onClick={() => remove(m.id)} aria-label={i18n.common.delete} className="text-[var(--ink-faint)] hover:text-[var(--ink)]">
                    <Trash2 size={12} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={n.hydrationTitle} hint={fmt(n.hydrationHint, { l: dec(t!.water / 1000, 1, locale) })}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Droplet className="text-[#f0cd79]" size={28} />
            <div>
              <p className="text-2xl font-semibold tabular-nums text-[var(--ink)]">{dec((glasses * GLASS_ML) / 1000, 2, locale)} L</p>
              <p className="text-xs text-[var(--ink-dim)]">
                {fmt(n.glasses, { n: glasses, target: waterTarget })}
              </p>
            </div>
          </div>
          <Counter value={glasses} onChange={setGlasses} max={24} />
        </div>
        <div className="mt-4">
          <DayBars days={lastDays(today, 7)} value={(d) => water.find((w) => w.day === d)?.value ?? 0} target={waterTarget} unit={n.glassesUnit} />
        </div>
      </Block>

      <Block title={n.adviceTitle} wide>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...(profile.goal in n.advice ? Object.values(n.advice[profile.goal]) : []), ...Object.values(n.advice.all)].map(({ title, text }) => (
            <li key={title} className="tile px-3.5 py-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-dim)]">{text}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Stats
            items={[
              { label: n.bmr, value: `${n0(t!.bmr, locale)} kcal` },
              { label: n.tdee, value: `${n0(t!.tdee, locale)} kcal` },
              { label: n.proteinPerMeal, value: `${n0(t!.protein / 4, locale)} g`, sub: n.over4 },
              { label: n.water, value: `${dec(t!.water / 1000, 1, locale)} L` },
            ]}
          />
        </div>
        <div className="mt-3">
          <Meter value={eaten.p} max={t!.protein} label={n.proteinToday} />
        </div>
      </Block>
    </>
  );
}

/** Diet, allergies and foods to avoid: every menu and grocery list respects them. */
function FoodPrefsBlock({ prefs, pending, onSave }: { prefs: FoodPrefs; pending: boolean; onSave: (p: FoodPrefs) => void }) {
  const { t, locale } = useI18n();
  const n = t.modulesA.nutrition;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prefs);
  const toggle = <T extends string>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const summary = [
    dietLabel(prefs.diet, locale),
    prefs.allergens.length ? fmt(n.allergiesList, { list: prefs.allergens.map((a) => allergenLabel(a, locale).toLowerCase()).join(", ") }) : n.noAllergy,
    prefs.avoid.length ? fmt(n.without, { list: prefs.avoid.map((f) => foodLabel(f, locale).toLowerCase()).join(", ") }) : null,
  ].filter(Boolean);
  return (
    <Block
      title={n.prefsTitle}
      hint={n.prefsHint}
      action={
        !editing && (
          <IconButton
            label={n.prefsEdit}
            onClick={() => {
              setDraft(prefs);
              setEditing(true);
            }}
          >
            <Pencil size={13} />
          </IconButton>
        )
      }
      wide
    >
      {!editing ? (
        <p className="flex items-start gap-2 text-sm text-[var(--ink)]">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-[#f0cd79]" />
          {summary.join(" · ")}
        </p>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-[var(--ink-dim)]">{n.diet}</legend>
            <div className="flex flex-wrap gap-1.5">
              {DIETS.map((d) => (
                <button key={d.key} type="button" aria-pressed={draft.diet === d.key} data-on={draft.diet === d.key || undefined} onClick={() => setDraft({ ...draft, diet: d.key })} className="mod-tab focus-ring">
                  {dietLabel(d.key, locale)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-[var(--ink-dim)]">{n.allergies}</legend>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGENS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  aria-pressed={draft.allergens.includes(a.key)}
                  data-on={draft.allergens.includes(a.key) || undefined}
                  onClick={() => setDraft({ ...draft, allergens: toggle(draft.allergens, a.key) })}
                  className="mod-tab focus-ring"
                >
                  {allergenLabel(a.key, locale)}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-[var(--ink-dim)]">{n.avoid}</legend>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(FOODS).map((k) => {
                const blocked = foodConflictText(k, { ...draft, avoid: [] }, locale);
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={!!blocked}
                    title={blocked ?? undefined}
                    aria-pressed={draft.avoid.includes(k)}
                    data-on={draft.avoid.includes(k) || undefined}
                    onClick={() => setDraft({ ...draft, avoid: toggle(draft.avoid, k) })}
                    className="mod-tab focus-ring text-xs disabled:opacity-40"
                  >
                    {foodLabel(k, locale)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
              className="mod-chip mod-chip-gold focus-ring"
            >
              <Check size={13} /> {t.common.save}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="mod-chip focus-ring">
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
    </Block>
  );
}

/** Seven days of menus and what they need from the store, added up. */
function WeekBlock({ today, kcal, prefs }: { today: string; kcal: number; prefs: FoodPrefs }) {
  const { t, locale } = useI18n();
  const n = t.modulesA.nutrition;
  // A calendar day with no time of its own: read in UTC so it never shifts.
  const weekday = new Intl.DateTimeFormat(INTL[locale], { weekday: "short", day: "numeric", timeZone: "UTC" });
  const week = useMemo(() => weekMenu(today, kcal, prefs), [today, kcal, prefs]);
  const list = useMemo(
    () =>
      shoppingList(week)
        .map((i) => ({ ...i, label: foodLabel(i.food, locale), aisle: aisleLabel(i.aisle, locale) }))
        .sort((a, b) => a.aisle.localeCompare(b.aisle, locale) || a.label.localeCompare(b.label, locale)),
    [week, locale]
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ text: string; ids: string[] } | null>(null);
  const missing = week.reduce((n, d) => n + d.meals.filter((m) => !m.recipe).length, 0);
  return (
    <Block title={n.weekTitle} hint={n.weekHint} wide>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {week.map((d) => (
          <li key={d.day} className="tile px-3.5 py-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[#f0cd79]">{weekday.format(new Date(`${d.day}T12:00:00Z`))}</p>
            <ul className="mt-1 space-y-0.5 text-xs leading-5 text-[var(--ink-dim)]">
              {d.meals.map((m) => (
                <li key={m.slot.key}>
                  <span className="text-[var(--ink-faint)]">{fmt(n.mealEvent, { slot: slotText(m.slot, locale).label, name: "" })}</span>
                  {m.recipe ? recipeName(m.recipe, locale) : "—"}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {missing > 0 && <p className="mt-2 text-xs text-[var(--ink-faint)]">{fmt(n.weekMissing, { n: missing })}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mod-chip focus-ring">
          <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} /> {fmt(n.weekList, { n: list.length })}
        </button>
        <button
          type="button"
          disabled={busy || !list.length}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await addGroceriesAction(list.map((i) => ({ food: i.food, grams: i.grams })));
              setDone({ text: groceryMessage(r, n, n.skippedComma), ids: "error" in r ? [] : r.ids });
            } catch {
              setDone({ text: t.common.serverDown, ids: [] });
            }
            setBusy(false);
          }}
          className="mod-chip mod-chip-gold focus-ring"
        >
          <ShoppingCart size={13} /> {busy ? n.adding : n.addAll}
        </button>
        {done && (
          <span role="status" className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            {done.text}
            {done.ids.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const r = await removeGroceriesAction(done.ids);
                    setDone({ text: fmt((locale === "fr" ? r.removed <= 1 : r.removed === 1) ? n.removedOne : n.removedMany, { n: r.removed }), ids: [] });
                  } catch {
                    setDone({ text: t.common.serverDown, ids: done.ids });
                  }
                }}
                className="mod-chip focus-ring"
              >
                <Undo2 size={12} /> {t.common.undo}
              </button>
            )}
          </span>
        )}
      </div>
      {open && (
        <ul className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          {list.map((i) => (
            <li key={i.food} className="flex justify-between gap-3 border-b border-[rgba(255,220,148,0.1)] py-1">
              <span className="text-[var(--ink)]">
                {i.label} <span className="text-[var(--ink-faint)]">· {i.aisle}</span>
              </span>
              <span className="tabular-nums text-[var(--ink-dim)]">{gramsLabelFor(i.grams, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

export const NUTRITION_SOURCES = [
  "Mifflin M.D. et al., A new predictive equation for resting energy expenditure, Am J Clin Nutr 51(2) (1990).",
  "Jäger R. et al., ISSN Position Stand: protein and exercise, J Int Soc Sports Nutr 14:20 (2017).",
  "Schoenfeld B.J. & Aragon A.A., How much protein can the body use in a single meal?, J Int Soc Sports Nutr 15:10 (2018).",
  "Institute of Medicine, Dietary Reference Intakes (2005) : fibres 14 g / 1 000 kcal. EFSA, valeurs de référence pour l'eau (2010).",
  "Santé Canada, Guide alimentaire canadien (2019). Valeurs nutritives : USDA FoodData Central, Fichier canadien sur les éléments nutritifs.",
];
