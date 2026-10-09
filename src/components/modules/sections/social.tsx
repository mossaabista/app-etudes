"use client";

import { useState } from "react";
import { Cake, Check, Plus, Trash2 } from "lucide-react";
import {
  Block,
  Empty,
  EntryList,
  IconButton,
  ScheduleButton,
  addDays,
  dayLabel,
  daysBetween,
  field,
  useEntries,
  type ModuleProps,
} from "@/components/modules/kit";

const CADENCES: [string, number][] = [
  ["Chaque semaine", 7],
  ["Toutes les 2 semaines", 14],
  ["Chaque mois", 30],
  ["Tous les 3 mois", 91],
];

/** Days until the next occurrence of an "MM-DD" birthday. */
function untilBirthday(today: string, md: string) {
  const year = Number(today.slice(0, 4));
  let next = `${year}-${md}`;
  if (next < today) next = `${year + 1}-${md}`;
  return { days: daysBetween(today, next), day: next };
}

/**
 * People to keep in touch with: each has a rhythm, and the list puts whoever is overdue
 * first. Birthdays (optional) feed an upcoming list.
 */
function Contacts({ module, today, entries, relations, defaultCadence }: ModuleProps & { relations: string[]; defaultCadence: number }) {
  const { add, update, remove, schedule, pending } = useEntries(module);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState(relations[0]);
  const [cadence, setCadence] = useState(String(defaultCadence));
  const [birthday, setBirthday] = useState("");
  const people = entries
    .filter((e) => e.kind === "contact")
    .map((e) => {
      const last = (e.data.last as string | null) ?? null;
      const due = last ? addDays(last, e.value ?? defaultCadence) : today;
      return { e, last, late: daysBetween(today, due) };
    })
    .sort((a, b) => a.late - b.late);
  const birthdays = people
    .filter((p) => p.e.data.birthday)
    .map((p) => ({ ...p, ...untilBirthday(today, String(p.e.data.birthday)) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  return (
    <>
      <Block title="Garder le contact" hint="Choisis à quel rythme prendre des nouvelles : ceux qu'il est temps d'appeler remontent en haut." wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            add("contact", { text: name, value: Number(cadence), data: { relation, birthday: birthday ? birthday.slice(5) : null, last: null } });
            setName("");
            setBirthday("");
          }}
          className="mb-4 flex flex-wrap items-center gap-2"
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom" aria-label="Prénom" className={`${field} flex-1 basis-36`} required />
          <select value={relation} onChange={(e) => setRelation(e.target.value)} aria-label="Lien" className={`${field} w-36 cursor-pointer appearance-none`}>
            {relations.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <select value={cadence} onChange={(e) => setCadence(e.target.value)} aria-label="Rythme" className={`${field} w-44 cursor-pointer appearance-none`}>
            {CADENCES.map(([l, d]) => (
              <option key={d} value={d}>
                {l}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-[var(--ink-dim)]">
            Anniversaire
            <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={`${field} w-36`} />
          </label>
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> Ajouter
          </button>
        </form>

        {people.length === 0 ? (
          <Empty>Ajoute les personnes à qui tu veux donner des nouvelles régulièrement.</Empty>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {people.map(({ e, last, late }) => (
              <li key={e.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(240,205,121,0.15)] text-sm font-semibold text-[#f0cd79]">
                  {(e.text ?? "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--ink)]">{e.text}</p>
                  <p className="truncate text-xs text-[var(--ink-dim)]">
                    {String(e.data.relation ?? "")} · {last ? `dernier contact ${dayLabel(last)}` : "pas encore de contact noté"}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-semibold ${late <= 0 ? "text-[#f0cd79]" : "text-[var(--ink-faint)]"}`}>{late <= 0 ? "À appeler" : `J-${late}`}</span>
                <IconButton label="Contacté aujourd'hui" tone="gold" onClick={() => update(e.id, { data: { last: today } })} disabled={pending}>
                  <Check size={13} />
                </IconButton>
                <IconButton label="Supprimer" onClick={() => remove(e.id)} disabled={pending}>
                  <Trash2 size={13} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Anniversaires à venir">
        {birthdays.length === 0 ? (
          <Empty>Ajoute une date d&apos;anniversaire à un contact pour la voir ici.</Empty>
        ) : (
          <ul className="space-y-2">
            {birthdays.map((b) => (
              <li key={b.e.id} className="tile flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                <Cake size={16} className="text-[#f0cd79]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--ink)]">{b.e.text}</p>
                  <p className="text-xs text-[var(--ink-dim)]">
                    {dayLabel(b.day, { day: "numeric", month: "long" })} · {b.days === 0 ? "aujourd'hui" : `dans ${b.days} j`}
                  </p>
                </div>
                <ScheduleButton title={`Anniversaire de ${b.e.text}`} today={b.day} minutes={30} onSchedule={schedule} label="Rappel" />
              </li>
            ))}
          </ul>
        )}
      </Block>
    </>
  );
}

export function Famille(props: ModuleProps) {
  return <Contacts {...props} relations={["Parent", "Frère / sœur", "Grand-parent", "Oncle / tante", "Cousin·e", "Enfant", "Conjoint·e", "Autre"]} defaultCadence={7} />;
}

export function Amis(props: ModuleProps) {
  return <Contacts {...props} relations={["Ami·e proche", "Ami·e", "Collègue", "Camarade de cours", "Voisin·e", "Autre"]} defaultCadence={14} />;
}

export function Evenements({ module, today, entries }: ModuleProps) {
  const { schedule } = useEntries(module);
  const events = entries.filter((e) => e.kind === "event");
  return (
    <>
      <Block title="Événements" hint="Fêtes, mariages, sorties, voyages : avec le compte à rebours et un rappel au calendrier." wide>
        <EntryList
          module={module}
          kind="event"
          entries={entries}
          today={today}
          checkable={false}
          fields={[
            { key: "text", label: "Événement", type: "text", to: "text", required: true },
            { key: "day", label: "Date", type: "date", to: "day" },
            { key: "time", label: "Heure", type: "time", width: "w-24", defaultValue: "19:00" },
            { key: "place", label: "Lieu", type: "text", width: "w-36" },
          ]}
          sort={(a, b) => a.day.localeCompare(b.day)}
          render={(e) => {
            const d = daysBetween(today, e.day);
            return {
              title: e.text,
              sub: `${dayLabel(e.day, { weekday: "long", day: "numeric", month: "long" })}${e.data.time ? ` · ${e.data.time}` : ""}${e.data.place ? ` · ${e.data.place}` : ""}`,
              aside: <span className="font-semibold text-[#f0cd79]">{d < 0 ? "Passé" : d === 0 ? "Aujourd'hui" : `J-${d}`}</span>,
            };
          }}
          extra={(e) =>
            e.day >= today ? (
              <ScheduleButton
                title={e.text ?? "Événement"}
                today={e.day}
                minutes={120}
                onSchedule={(x) => schedule({ ...x, start: x.start ?? (e.data.time ? String(e.data.time) : null) })}
                label="Calendrier"
              />
            ) : null
          }
          empty="Aucun événement prévu."
        />
      </Block>
      <Block title="À préparer" hint={events.length ? "Invitations, cadeaux, réservations…" : "Les préparatifs de tes événements."} wide>
        <EntryList
          module={module}
          kind="prep"
          entries={entries}
          today={today}
          fields={[
            { key: "text", label: "Préparatif", type: "text", to: "text", required: true },
            ...(events.length
              ? [{ key: "event", label: "Pour", type: "select" as const, options: events.map((e) => e.text ?? "Événement"), width: "w-44" }]
              : []),
          ]}
          render={(e) => ({ title: e.text, sub: e.data.event ? String(e.data.event) : undefined })}
          empty="Rien à préparer pour l'instant."
        />
      </Block>
    </>
  );
}
