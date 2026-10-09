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
  dayLabel,
  daysBetween,
  field,
  useEntries,
  type ModuleProps,
} from "@/components/modules/kit";
import { guessAisle } from "@/lib/grocery";
import { Budgets, Subscriptions, guessCategory } from "@/components/modules/sections/finance-extra";

// =========================================================================== Courses

const AISLES = ["Fruits & légumes", "Boulangerie", "Produits laitiers", "Viandes & poissons", "Épicerie", "Surgelés", "Boissons", "Hygiène & maison", "Autre"];


const STAPLES = ["Lait", "Œufs", "Pain", "Bananes", "Riz", "Pâtes", "Poulet", "Yogourt", "Tomates", "Oignons", "Fromage", "Café"];

export function Courses({ module, entries }: ModuleProps) {
  const { add, update, remove, pending } = useEntries(module);
  const [text, setText] = useState("");
  const [aisle, setAisle] = useState<string | null>(null);
  const items = entries.filter((e) => e.kind === "item");
  const left = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const missingStaples = STAPLES.filter((s) => !left.some((i) => i.text?.toLowerCase() === s.toLowerCase()));

  const submit = (name: string, where?: string) => {
    if (!name.trim()) return;
    add("item", { text: name.trim(), data: { aisle: where ?? guessAisle(name) } });
  };

  return (
    <>
      <Block title="Liste de courses" hint="Les articles se rangent par rayon pour faire le tour du magasin une seule fois." wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(text, aisle ?? undefined);
            setText("");
            setAisle(null);
          }}
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter un article" aria-label="Article" className={`${field} flex-1 basis-48`} />
          <select value={aisle ?? (text ? guessAisle(text) : AISLES[0])} onChange={(e) => setAisle(e.target.value)} aria-label="Rayon" className={`${field} w-48 cursor-pointer appearance-none`}>
            {AISLES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> Ajouter
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
          <Empty>Liste vide. Ajoute des articles, ou des repas depuis Nutrition.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {AISLES.map((a) => {
              const rows = left.filter((i) => (i.data.aisle ?? "Autre") === a);
              if (!rows.length) return null;
              return (
                <div key={a}>
                  <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                    {a} · {rows.length}
                  </p>
                  <ul className="space-y-1.5">
                    {rows.map((i) => (
                      <li key={i.id} className="tile flex items-center gap-3 px-3.5 py-2">
                        <CheckBox checked={false} label="Pris" disabled={pending} onChange={() => update(i.id, { done: true })} />
                        <span className="min-w-0 flex-1 text-sm text-[var(--ink)]">{i.text}</span>
                        <IconButton label="Supprimer" onClick={() => remove(i.id)} disabled={pending}>
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
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Dans le panier · {done.length}</p>
              <button type="button" disabled={pending} onClick={() => done.forEach((d) => remove(d.id))} className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)]">
                Vider le panier
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

export function Maison({ module, today, entries }: ModuleProps) {
  return (
    <>
      <Block title="Entretien régulier" hint="Chaque tâche réapparaît quand elle est due, selon sa fréquence." wide>
        <RecurringList
          module={module}
          entries={entries}
          today={today}
          suggestions={[
            { text: "Passer l'aspirateur", period: 7 },
            { text: "Nettoyer la salle de bain", period: 7 },
            { text: "Lessive", period: 7 },
            { text: "Sortir les poubelles et le recyclage", period: 7 },
            { text: "Nettoyer le réfrigérateur", period: 30 },
            { text: "Tester les détecteurs de fumée", period: 30 },
            { text: "Nettoyer le four", period: 91 },
            { text: "Changer le filtre de la hotte ou de la fournaise", period: 91 },
          ]}
        />
      </Block>
      <Block title="Petits travaux" hint="Réparations, achats pour la maison, choses à régler." wide>
        <EntryList
          module={module}
          kind="todo"
          entries={entries}
          today={today}
          fields={[
            { key: "text", label: "À faire", type: "text", to: "text", required: true },
            { key: "room", label: "Pièce", type: "select", options: ["Cuisine", "Salon", "Chambre", "Salle de bain", "Entrée", "Extérieur", "Autre"], width: "w-36" },
          ]}
          render={(e) => ({ title: e.text, sub: e.data.room ? String(e.data.room) : undefined })}
          empty="Rien à réparer pour l'instant."
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
const money = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export function Finances({ module, today, entries }: ModuleProps) {
  const { add, remove, pending } = useEntries(module);
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
    { name: "Besoins", got: sum(NEEDS), target: 0.5 },
    { name: "Envies", got: sum(WANTS), target: 0.3 },
    { name: "Épargne", got: sum(SAVINGS), target: 0.2 },
  ];
  const totals = new Map<string, number>();
  for (const t of out) totals.set(String(t.data.category), (totals.get(String(t.data.category)) ?? 0) + (t.value ?? 0));
  const byCat = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const monthName = new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

  return (
    <>
      <Block
        title={monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        action={
          <div className="flex gap-1.5">
            <IconButton label="Mois précédent" onClick={() => shift(-1)}>
              <ChevronLeft size={14} />
            </IconButton>
            <IconButton label="Mois suivant" onClick={() => shift(1)}>
              <ChevronRight size={14} />
            </IconButton>
          </div>
        }
        wide
      >
        <Stats
          items={[
            { label: "Revenus", value: money(income) },
            { label: "Dépenses", value: money(spent) },
            { label: "Solde", value: money(income - spent), tone: "gold" },
            { label: "Taux d'épargne", value: income ? `${Math.round((sum(SAVINGS) / income) * 100)} %` : "—" },
          ]}
        />
      </Block>

      <Block title="Ajouter une opération">
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
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant ($)" aria-label="Montant" className={`${field} w-32`} required />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPicked(true);
              }}
              aria-label="Catégorie" className={`${field} flex-1 basis-40 cursor-pointer appearance-none`}>
              {type === "Revenu" ? (
                INCOME.map((c) => <option key={c}>{c}</option>)
              ) : (
                <>
                  <optgroup label="Besoins">
                    {NEEDS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Envies">
                    {WANTS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Épargne">
                    {SAVINGS.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </optgroup>
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
              placeholder="Libellé (ex. Tim Hortons, loyer…)"
              aria-label="Libellé"
              className={`${field} flex-1 basis-40`}
            />
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Date" className={`${field} w-36`} />
            <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        </form>
      </Block>

      <Budgets module={module} entries={entries} month={month} spentBy={totals} categories={[...NEEDS, ...WANTS]} />
      <Subscriptions module={module} entries={entries} today={today} />

      <Block title="Règle 50 / 30 / 20" hint="Repère courant de budget : 50 % des revenus aux besoins, 30 % aux envies, 20 % à l'épargne.">
        <div className="space-y-3">
          {split.map((s) => (
            <div key={s.name}>
              <div className="mb-1 flex justify-between text-xs text-[var(--ink-dim)]">
                <span>
                  {s.name} · {money(s.got)}
                </span>
                <span className="tabular-nums">
                  {income ? `${Math.round((s.got / income) * 100)} %` : "—"} / {s.target * 100} %
                </span>
              </div>
              <Meter value={s.got} max={income * s.target || 1} />
            </div>
          ))}
        </div>
        {!income && <p className="mt-3 text-xs text-[var(--ink-faint)]">Ajoute tes revenus du mois pour comparer.</p>}
      </Block>

      <Block title="Par catégorie">
        {byCat.length === 0 ? (
          <Empty>Aucune dépense ce mois-ci.</Empty>
        ) : (
          <div className="space-y-2.5">
            {byCat.map(([c, v]) => (
              <div key={c}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-[var(--ink)]">{c}</span>
                  <span className="tabular-nums text-[var(--ink-dim)]">{money(v)}</span>
                </div>
                <Meter value={v} max={byCat[0][1]} />
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block title="Opérations du mois">
        {tx.length === 0 ? (
          <Empty>Rien d&apos;enregistré pour ce mois.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {tx.map((t) => (
              <li key={t.id} className="tile flex items-center gap-3 px-3.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--ink)]">{t.text}</p>
                  <p className="text-xs text-[var(--ink-dim)]">
                    {dayLabel(t.day)} · {String(t.data.category)}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${t.data.type === "Revenu" ? "text-[#f0cd79]" : "text-[var(--ink)]"}`}>
                  {t.data.type === "Revenu" ? "+" : "−"}
                  {money(t.value ?? 0)}
                </span>
                <IconButton label="Supprimer" onClick={() => remove(t.id)} disabled={pending}>
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
      <Block title="Nouveau rendez-vous" hint="Médecin, administration, banque… Il peut aller directement dans ton calendrier." wide>
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
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Objet du rendez-vous" aria-label="Objet" className={`${field} flex-1 basis-48`} required />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Jour" className={`${field} w-36`} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Heure" className={`${field} w-24`} />
          <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lieu" aria-label="Lieu" className={`${field} w-40`} />
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            <CheckBox checked={toCal} label="Ajouter au calendrier" onChange={() => setToCal(!toCal)} />
            Calendrier
          </label>
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> Ajouter
          </button>
        </form>
      </Block>

      <Block title="À venir">
        {upcoming.length === 0 ? (
          <Empty>Aucun rendez-vous prévu.</Empty>
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
                  <span className="shrink-0 text-xs font-semibold text-[#f0cd79]">{inDays === 0 ? "Aujourd'hui" : inDays === 1 ? "Demain" : `J-${inDays}`}</span>
                  <IconButton label="Supprimer" onClick={() => remove(a.id)} disabled={pending}>
                    <Trash2 size={13} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      <Block title="Passés">
        {past.length === 0 ? (
          <Empty>Rien pour l&apos;instant.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {past.slice(0, 8).map((a) => (
              <li key={a.id} className="flex items-center justify-between text-xs text-[var(--ink-dim)]">
                <span>
                  {dayLabel(a.day)} · {a.text}
                </span>
                <ScheduleButton title={a.text ?? "Rendez-vous"} today={today} onSchedule={schedule} label="Reprendre" />
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

export const QUOTIDIEN_SOURCES = {
  maison: ["Sécurité incendie : test mensuel des avertisseurs de fumée recommandé par les services d'incendie canadiens."],
  finances: ["Règle 50/30/20 popularisée par E. Warren et A. W. Tyagi, All Your Worth (2005) : un repère, pas une norme."],
};
