"use client";

import { useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { Block, Empty, IconButton, Meter, field, useEntries, type Entry } from "@/components/modules/kit";

const money = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

// The category from the label, as banking apps do: instant, offline, and free.
const RULES: [RegExp, string][] = [
  [/loyer|bail|colocation|hypoth/i, "Logement"],
  [/[ée]picerie|metro|iga|maxi|provigo|walmart|costco|super ?c|loblaws|food basics|marché|boulangerie/i, "Alimentation"],
  [/uber(?! ?eats)|lyft|taxi|stm|oc ?transpo|presto|opus|essence|gaz|parking|stationnement|train|via rail|bus/i, "Transport"],
  [/pharmac|jean coutu|shoppers|m[ée]decin|dentiste|physio|lunettes|optom/i, "Santé"],
  [/hydro|[ée]lectricit|bell|rogers|videotron|vidéotron|fizz|koodo|internet|t[ée]l[ée]phone|cellulaire|assurance/i, "Factures"],
  [/scolarit|universit|livre|manuel|cours|formation|udemy|coursera/i, "Études"],
  [/resto|restaurant|mcdo|mcdonald|tim hortons|starbucks|caf[ée]|pizza|sushi|burger|uber ?eats|doordash|skip/i, "Restaurants"],
  [/cin[ée]ma|bar|concert|sortie|jeu|steam|playstation|xbox|bowling|spectacle/i, "Loisirs"],
  [/amazon|v[ée]tement|zara|h&m|uniqlo|shein|chaussure|best buy|ikea/i, "Shopping"],
  [/netflix|spotify|disney|prime|apple|icloud|youtube|abonnement|gym|chatgpt|adobe/i, "Abonnements"],
  [/avion|vol |h[ôo]tel|airbnb|voyage|booking/i, "Voyages"],
  [/cadeau|anniversaire|f[êe]te/i, "Cadeaux"],
  [/[ée]pargne|celi|reer|tfsa|rrsp/i, "Épargne"],
  [/placement|action|etf|crypto|wealthsimple|questrade/i, "Investissement"],
];
export const guessCategory = (label: string) => RULES.find(([re]) => re.test(label))?.[1] ?? null;

/** A monthly budget per category, with what is left and an alert once it is passed. */
export function Budgets({ module, entries, month, spentBy, categories }: { module: string; entries: Entry[]; month: string; spentBy: Map<string, number>; categories: string[] }) {
  const { add, update, remove, pending } = useEntries(module);
  const budgets = entries.filter((e) => e.kind === "budget");
  const [cat, setCat] = useState(categories.find((c) => !budgets.some((b) => b.text === c)) ?? categories[0]);
  const [amount, setAmount] = useState("");
  const total = budgets.reduce((s, b) => s + (b.value ?? 0), 0);
  const used = budgets.reduce((s, b) => s + (spentBy.get(b.text ?? "") ?? 0), 0);
  const dayOfMonth = new Date().getDate();
  const daysIn = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

  return (
    <Block title="Budgets du mois" hint="Un plafond par catégorie. La barre passe au rouge au-delà, et le rythme t'indique si tu dépenses trop vite pour le jour du mois.">
      {budgets.length === 0 ? (
        <Empty>Fixe un budget pour tes postes principaux (Alimentation, Restaurants, Loisirs…).</Empty>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const spent = spentBy.get(b.text ?? "") ?? 0;
            const cap = b.value ?? 0;
            const over = spent > cap;
            const pace = cap * (dayOfMonth / daysIn);
            return (
              <div key={b.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--ink)]">{b.text}</span>
                  <span className={`tabular-nums ${over ? "font-semibold text-[#ff9f8c]" : "text-[var(--ink-dim)]"}`}>
                    {money(spent)} / {money(cap)}
                    {!over && spent > pace * 1.15 && <span className="ml-1.5 text-[#f0cd79]">· rythme élevé</span>}
                  </span>
                </div>
                <div className={over ? "[&_div>div]:!bg-[#f07a6a]" : ""}>
                  <Meter value={Math.min(spent, cap)} max={cap || 1} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[0.68rem] text-[var(--ink-faint)]">
                  <span>{over ? `Dépassé de ${money(spent - cap)}` : `Reste ${money(cap - spent)}`}</span>
                  <span className="flex gap-1">
                    <input
                      defaultValue={cap}
                      onBlur={(e) => {
                        const v = Number(e.target.value.replace(",", "."));
                        if (Number.isFinite(v) && v !== cap) update(b.id, { value: v });
                      }}
                      inputMode="decimal"
                      aria-label={`Budget ${b.text}`}
                      className="w-16 rounded bg-transparent text-right text-[var(--ink-dim)] outline-none"
                    />
                    <IconButton label="Supprimer" onClick={() => remove(b.id)} disabled={pending}>
                      <Trash2 size={11} />
                    </IconButton>
                  </span>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-[var(--ink-dim)]">
            Total : {money(used)} dépensés sur {money(total)} budgétés.
          </p>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(amount.replace(",", "."));
          if (!v || budgets.some((b) => b.text === cat)) return;
          add("budget", { text: cat, value: v });
          setAmount("");
        }}
        className="mt-4 flex flex-wrap gap-2"
      >
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Catégorie" className={`${field} flex-1 basis-36 cursor-pointer appearance-none`}>
          {categories.map((c) => (
            <option key={c} disabled={budgets.some((b) => b.text === c)}>
              {c}
            </option>
          ))}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$ / mois" aria-label="Montant mensuel" className={`${field} w-28`} />
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          <Plus size={13} /> Budget
        </button>
      </form>
    </Block>
  );
}

/** Subscriptions: what they cost a month and a year, and when each one bills next. */
export function Subscriptions({ module, entries, today }: { module: string; entries: Entry[]; today: string }) {
  const { add, remove, pending } = useEntries(module);
  const subs = entries.filter((e) => e.kind === "sub");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const monthly = subs.reduce((s, x) => s + (x.value ?? 0), 0);
  const nextBilling = (d: number) => {
    const t = new Date(`${today}T12:00:00Z`);
    const next = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + (t.getUTCDate() > d ? 1 : 0), d));
    return Math.round((next.getTime() - t.getTime()) / 86400000);
  };

  return (
    <Block title="Abonnements" hint={subs.length ? `${money(monthly)} par mois, soit ${money(monthly * 12)} par an. Un abonnement oublié coûte en moyenne plus de 200 $ par an : fais le tri.` : "Liste tes abonnements pour voir ce qu'ils coûtent vraiment sur un an."}>
      {subs.length === 0 ? (
        <Empty>Aucun abonnement noté.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {subs
            .map((x) => ({ x, n: nextBilling(Number(x.data.day ?? 1)) }))
            .sort((a, b) => a.n - b.n)
            .map(({ x, n }) => (
              <li key={x.id} className="tile flex items-center gap-3 px-3.5 py-2">
                <Repeat size={14} className="shrink-0 text-[#f0cd79]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--ink)]">{x.text}</p>
                  <p className="text-xs text-[var(--ink-dim)]">
                    le {String(x.data.day ?? 1)} du mois · {n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} j`} · {money((x.value ?? 0) * 12)} / an
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">{money(x.value ?? 0)}</span>
                <IconButton label="Supprimer" onClick={() => remove(x.id)} disabled={pending}>
                  <Trash2 size={13} />
                </IconButton>
              </li>
            ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(amount.replace(",", "."));
          if (!name.trim() || !v) return;
          add("sub", { text: name.trim(), value: v, data: { day: Math.min(28, Math.max(1, Number(day) || 1)) } });
          setName("");
          setAmount("");
        }}
        className="mt-3 flex flex-wrap gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix, Spotify, salle…" aria-label="Abonnement" className={`${field} flex-1 basis-36`} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$ / mois" aria-label="Prix mensuel" className={`${field} w-24`} />
        <input value={day} onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Jour de prélèvement" placeholder="jour" className={`${field} w-16`} />
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          <Plus size={13} />
        </button>
      </form>
    </Block>
  );
}
