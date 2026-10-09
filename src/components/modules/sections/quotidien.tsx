"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Block,
  CheckBox,
  Empty,
  EntryList,
  IconButton,
  Meter,
  RecurringList,
  ScheduleButton,
  Stats,
  daysBetween,
  field,
  useEntries,
  useModuleText,
  type ModuleProps,
} from "@/components/modules/kit";
import { INTL, fmt } from "@/i18n/config";
import { guessAisle } from "@/lib/grocery";
import { Budgets, Subscriptions, guessCategory } from "@/components/modules/sections/finance-extra";

// =========================================================================== Courses

// Stored as written here (and by the assistant); shown in the reader's language.
const AISLES = ["Fruits & légumes", "Boulangerie", "Produits laitiers", "Viandes & poissons", "Épicerie", "Surgelés", "Boissons", "Hygiène & maison", "Autre"];


export function Courses({ module, entries }: ModuleProps) {
  const { add, update, remove, pending } = useEntries(module);
  const { t, value: valueLabel } = useModuleText();
  const g = t.modulesB.groceries;
  const [text, setText] = useState("");
  const [aisle, setAisle] = useState<string | null>(null);
  const items = entries.filter((e) => e.kind === "item");
  const left = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const missingStaples = g.staples.filter((s) => !left.some((i) => i.text?.toLowerCase() === s.toLowerCase()));

  const submit = (name: string, where?: string) => {
    if (!name.trim()) return;
    add("item", { text: name.trim(), data: { aisle: where ?? guessAisle(name) } });
  };

  return (
    <>
      <Block title={g.title} hint={g.hint} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(text, aisle ?? undefined);
            setText("");
            setAisle(null);
          }}
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={g.placeholder} aria-label={g.item} className={`${field} flex-1 basis-48`} />
          <select value={aisle ?? (text ? guessAisle(text) : AISLES[0])} onChange={(e) => setAisle(e.target.value)} aria-label={g.aisle} className={`${field} w-48 cursor-pointer appearance-none`}>
            {AISLES.map((a) => (
              <option key={a} value={a}>
                {valueLabel(a)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> {t.modulesB.kit.add}
          </button>
        </form>
        {missingStaples.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {missingStaples.map((s) => (
              <button key={s} type="button" disabled={pending} onClick={() => submit(s)} className="mod-chip focus-ring">
                <Plus size={12} /> {s}
              </button>
            ))}
          </div>
        )}

        {left.length === 0 ? (
          <Empty>{g.empty}</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {AISLES.map((a) => {
              const rows = left.filter((i) => (i.data.aisle ?? "Autre") === a);
              if (!rows.length) return null;
              return (
                <div key={a}>
                  <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                    {valueLabel(a)} · {rows.length}
                  </p>
                  <ul className="space-y-1.5">
                    {rows.map((i) => (
                      <li key={i.id} className="tile flex items-center gap-3 px-3.5 py-2">
                        <CheckBox checked={false} label={g.got} disabled={pending} onChange={() => update(i.id, { done: true })} />
                        <span className="min-w-0 flex-1 text-sm text-[var(--ink)]">{i.text}</span>
                        <IconButton label={t.common.delete} onClick={() => remove(i.id)} disabled={pending}>
                          <Trash2 size={13} />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {done.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{fmt(g.basket, { n: done.length })}</p>
              <button type="button" disabled={pending} onClick={() => done.forEach((d) => remove(d.id))} className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)]">
                {g.clear}
              </button>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {done.map((d) => (
                <li key={d.id}>
                  <button type="button" disabled={pending} onClick={() => update(d.id, { done: false })} className="mod-chip line-through opacity-60 focus-ring">
                    {d.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Block>
    </>
  );
}

// =========================================================================== Maison

const UPKEEP_PERIODS = [7, 7, 7, 7, 30, 30, 91, 91];

export function Maison({ module, today, entries }: ModuleProps) {
  const { t, value: valueLabel } = useModuleText();
  const h = t.modulesB.home;
  return (
    <>
      <Block title={h.upkeep} hint={h.upkeepHint} wide>
        <RecurringList
          module={module}
          entries={entries}
          today={today}
          suggestions={h.suggestions.map((text, i) => ({ text, period: UPKEEP_PERIODS[i] ?? 30 }))}
        />
      </Block>
      <Block title={h.repairs} hint={h.repairsHint} wide>
        <EntryList
          module={module}
          kind="todo"
          entries={entries}
          today={today}
          fields={[
            { key: "text", label: h.todo, type: "text", to: "text", required: true },
            { key: "room", label: h.room, type: "select", options: ["Cuisine", "Salon", "Chambre", "Salle de bain", "Entrée", "Extérieur", "Autre"], width: "w-36" },
          ]}
          render={(e) => ({ title: e.text, sub: e.data.room ? valueLabel(e.data.room) : undefined })}
          empty={h.repairsEmpty}
        />
      </Block>
    </>
  );
}

// =========================================================================== Finances

const NEEDS = ["Logement", "Alimentation", "Transport", "Santé", "Factures", "Études"];
const WANTS = ["Restaurants", "Loisirs", "Shopping", "Abonnements", "Voyages", "Cadeaux"];
const SAVINGS = ["Épargne", "Investissement", "Remboursement de dette"];
const INCOME = ["Salaire", "Bourse", "Aide familiale", "Autre revenu"];

export function Finances({ module, today, entries }: ModuleProps) {
  const { add, remove, pending } = useEntries(module);
  const { t: tr, locale, money, pct, day: dayLabel, value: valueLabel } = useModuleText();
  const f = tr.modulesB.finance;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [type, setType] = useState<"Dépense" | "Revenu">("Dépense");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(NEEDS[1]);
  const [picked, setPicked] = useState(false);
  const [day, setDay] = useState(today);

  const tx = entries.filter((e) => e.kind === "tx" && e.day.startsWith(month));
  const income = tx.filter((t) => t.data.type === "Revenu").reduce((s, t) => s + (t.value ?? 0), 0);
  const out = tx.filter((t) => t.data.type !== "Revenu");
  const spent = out.reduce((s, t) => s + (t.value ?? 0), 0);
  const sum = (cats: string[]) => out.filter((t) => cats.includes(String(t.data.category))).reduce((s, t) => s + (t.value ?? 0), 0);
  const split = [
    { name: f.needs, got: sum(NEEDS), target: 0.5 },
    { name: f.wants, got: sum(WANTS), target: 0.3 },
    { name: f.savings, got: sum(SAVINGS), target: 0.2 },
  ];
  const totals = new Map<string, number>();
  for (const t of out) totals.set(String(t.data.category), (totals.get(String(t.data.category)) ?? 0) + (t.value ?? 0));
  const byCat = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const monthName = new Intl.DateTimeFormat(INTL[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

  return (
    <>
      <Block
        title={monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        action={
          <div className="flex gap-1.5">
            <IconButton label={f.prevMonth} onClick={() => shift(-1)}>
              <ChevronLeft size={14} />
            </IconButton>
            <IconButton label={f.nextMonth} onClick={() => shift(1)}>
              <ChevronRight size={14} />
            </IconButton>
          </div>
        }
        wide
      >
        <Stats
          items={[
            { label: f.income, value: money(income) },
            { label: f.spending, value: money(spent) },
            { label: f.balance, value: money(income - spent), tone: "gold" },
            { label: f.savingsRate, value: income ? pct(Math.round((sum(SAVINGS) / income) * 100)) : "—" },
          ]}
        />
      </Block>

      <Block title={f.addTitle}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = Math.abs(Number(amount));
            if (!v) return;
            add("tx", { day, text: label || category, value: v, data: { type, category } });
            setLabel("");
            setAmount("");
            setPicked(false);
          }}
          className="space-y-2"
        >
          <div className="flex gap-1.5">
            {(["Dépense", "Revenu"] as const).map((t) => (
              <button
                key={t}
                type="button"
                data-on={t === type || undefined}
                onClick={() => {
                  setType(t);
                  setCategory(t === "Revenu" ? INCOME[0] : NEEDS[1]);
                }}
                className="mod-tab focus-ring"
              >
                {valueLabel(t)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={f.amount} aria-label={f.amountAria} className={`${field} w-32`} required />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPicked(true);
              }}
              aria-label={f.category} className={`${field} flex-1 basis-40 cursor-pointer appearance-none`}>
              {type === "Revenu" ? (
                INCOME.map((c) => (
                  <option key={c} value={c}>
                    {valueLabel(c)}
                  </option>
                ))
              ) : (
                <>
                  {(
                    [
                      [f.needs, NEEDS],
                      [f.wants, WANTS],
                      [f.savings, SAVINGS],
                    ] as const
                  ).map(([group, cats]) => (
                    <optgroup key={group} label={group}>
                      {cats.map((c) => (
                        <option key={c} value={c}>
                          {valueLabel(c)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </>
              )}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                // The label files the expense unless a category was picked by hand.
                const g = type === "Dépense" && !picked ? guessCategory(e.target.value) : null;
                if (g) setCategory(g);
              }}
              placeholder={f.labelPlaceholder}
              aria-label={f.label}
              className={`${field} flex-1 basis-40`}
            />
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={f.date} className={`${field} w-36`} />
            <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
              <Plus size={13} /> {tr.modulesB.kit.add}
            </button>
          </div>
        </form>
      </Block>

      <Budgets module={module} entries={entries} month={month} spentBy={totals} categories={[...NEEDS, ...WANTS]} />
      <Subscriptions module={module} entries={entries} today={today} />

      <Block title={f.rule} hint={f.ruleHint}>
        <div className="space-y-3">
          {split.map((s) => (
            <div key={s.name}>
              <div className="mb-1 flex justify-between text-xs text-[var(--ink-dim)]">
                <span>
                  {s.name} · {money(s.got)}
                </span>
                <span className="tabular-nums">
                  {income ? pct(Math.round((s.got / income) * 100)) : "—"} / {pct(s.target * 100)}
                </span>
              </div>
              <Meter value={s.got} max={income * s.target || 1} />
            </div>
          ))}
        </div>
        {!income && <p className="mt-3 text-xs text-[var(--ink-faint)]">{f.ruleEmpty}</p>}
      </Block>

      <Block title={f.byCategory}>
        {byCat.length === 0 ? (
          <Empty>{f.byCategoryEmpty}</Empty>
        ) : (
          <div className="space-y-2.5">
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-[var(--ink)]">{valueLabel(c)}</span>
                  <span className="tabular-nums text-[var(--ink-dim)]">{money(v)}</span>
                </div>
                <Meter value={v} max={byCat[0][1]} />
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block title={f.ops}>
        {tx.length === 0 ? (
          <Empty>{f.opsEmpty}</Empty>
        ) : (
          <ul className="space-y-1.5">
            {tx.map((t) => (
              <li key={t.id} className="tile flex items-center gap-3 px-3.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--ink)]">{t.text}</p>
                  <p className="text-xs text-[var(--ink-dim)]">
                    {dayLabel(t.day)} · {valueLabel(t.data.category)}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${t.data.type === "Revenu" ? "text-[#f0cd79]" : "text-[var(--ink)]"}`}>
                  {t.data.type === "Revenu" ? "+" : "−"}
                  {money(t.value ?? 0)}
                </span>
                <IconButton label={tr.common.delete} onClick={() => remove(t.id)} disabled={pending}>
                  <Trash2 size={13} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

// =========================================================================== Rendez-vous

export function RendezVous({ module, today, entries }: ModuleProps) {
  const { add, remove, schedule, pending } = useEntries(module);
  const { t, day: dayLabel } = useModuleText();
  const r = t.modulesB.appts;
  const k = t.modulesB.kit;
  const [text, setText] = useState("");
  const [day, setDay] = useState(today);
  const [time, setTime] = useState("10:00");
  const [place, setPlace] = useState("");
  const [toCal, setToCal] = useState(true);
  const appts = entries.filter((e) => e.kind === "appt");
  const upcoming = appts.filter((a) => a.day >= today).sort((a, b) => `${a.day} ${a.data.time ?? ""}`.localeCompare(`${b.day} ${b.data.time ?? ""}`));
  const past = appts.filter((a) => a.day < today);

  return (
    <>
      <Block title={r.newTitle} hint={r.newHint} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            add("appt", { day, text, data: { time, place } });
            if (toCal) {
              const [h, m] = time.split(":").map(Number);
              const end = `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
              schedule({ title: text, day, start: time, end, notes: place || null });
            }
            setText("");
            setPlace("");
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={r.subject} aria-label={r.subjectAria} className={`${field} flex-1 basis-48`} required />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={k.day} className={`${field} w-36`} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={k.time} className={`${field} w-24`} />
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={r.place} aria-label={r.place} className={`${field} w-40`} />
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            <CheckBox checked={toCal} label={k.addToCalendar} onChange={() => setToCal(!toCal)} />
            {r.calendar}
          </label>
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> {k.add}
          </button>
        </form>
      </Block>

      <Block title={r.upcoming}>
        {upcoming.length === 0 ? (
          <Empty>{r.upcomingEmpty}</Empty>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((a) => {
              const inDays = daysBetween(today, a.day);
              return (
                <li key={a.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--ink)]">{a.text}</p>
                    <p className="text-xs text-[var(--ink-dim)]">
                      {dayLabel(a.day, { weekday: "long", day: "numeric", month: "long" })} · {String(a.data.time ?? "")}
                      {a.data.place ? ` · ${a.data.place}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#f0cd79]">{inDays === 0 ? k.today : inDays === 1 ? k.tomorrow : fmt(k.countdown, { n: inDays })}</span>
                  <IconButton label={t.common.delete} onClick={() => remove(a.id)} disabled={pending}>
                    <Trash2 size={13} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <Block title={r.past}>
        {past.length === 0 ? (
          <Empty>{r.pastEmpty}</Empty>
        ) : (
          <ul className="space-y-1.5">
            {past.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center justify-between text-xs text-[var(--ink-dim)]">
                <span>
                  {dayLabel(a.day)} · {a.text}
                </span>
                <ScheduleButton title={a.text ?? r.fallback} today={today} onSchedule={schedule} label={r.again} />
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}
