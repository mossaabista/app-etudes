"use client";

import { useState } from "react";
import { ListChecks, Mail, Plus, Sparkles, Trash2 } from "lucide-react";
import { aiHelperAction } from "@/server/actions/ai.actions";
import { quickTaskAction } from "@/server/actions/task.actions";
import {
  Block,
  addDays,
  DayBars,
  Empty,
  EntryList,
  IconButton,
  Meter,
  Stats,
  daysBetween,
  field,
  lastDays,
  useEntries,
  useModuleText,
  type Entry,
  type ModuleProps,
} from "@/components/modules/kit";
import { fmt } from "@/i18n/config";

// =========================================================================== Réunions (shared)

function Meetings({ module, today, entries, kinds }: ModuleProps & { kinds: string[] }) {
  const { add, update, remove, schedule, pending } = useEntries(module);
  const { t, locale, day: dayLabel, value: valueLabel } = useModuleText();
  const m_ = t.modulesB.meetings;
  const k = t.modulesB.kit;
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(today);
  const [time, setTime] = useState("10:00");
  const [length, setLength] = useState("30");
  const [type, setType] = useState(kinds[0]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [noteIsError, setNoteIsError] = useState(false);
  const fail = (text: string) => {
    setNoteIsError(true);
    setNote(text);
  };

  // The assistant drafts the agenda from the subject and length…
  const draftAgenda = async (m: Entry) => {
    setBusy(`agenda-${m.id}`);
    setNote(null);
    setNoteIsError(false);
    const res = await aiHelperAction({ kind: "agenda", subject: m.text ?? "", minutes: Number(m.data.length ?? 30), type: String(m.data.type ?? "") });
    setBusy(null);
    if ("error" in res) return fail(t.modulesB.ai.unavailable);
    update(m.id, { data: { notes: String(res.result.agenda ?? "") } });
  };
  // …and turns the notes into actions: each one listed below, and the ones without an
  // owner (yours) added to your tasks with their date.
  const extractActions = async (m: Entry) => {
    setBusy(`actions-${m.id}`);
    setNote(null);
    setNoteIsError(false);
    const res = await aiHelperAction({ kind: "actions", notes: String(m.data.notes ?? ""), today });
    setBusy(null);
    if ("error" in res) return fail(t.modulesB.ai.unavailable);
    const list = (res.result.actions as { text: string; owner?: string | null; due?: string | null }[] | undefined) ?? [];
    if (!list.length) return fail(m_.noActions);
    for (const a of list.slice(0, 12)) {
      const due = a.due && /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : addDays(today, 7);
      add("action", { day: due, text: a.text, data: { owner: a.owner ?? "", from: m.text } });
      if (!a.owner || /^(moi|je)$/i.test(a.owner)) await quickTaskAction({ title: a.text, category: module, due });
    }
    setNote(list.length > 1 ? fmt(m_.actionsMany, { n: list.length }) : m_.actionsOne);
  };
  const meetings = entries.filter((e) => e.kind === "meeting").sort((a, b) => b.day.localeCompare(a.day));
  const upcoming = meetings.filter((m) => m.day >= today).reverse();
  const past = meetings.filter((m) => m.day < today);

  const row = (m: Entry) => {
    const open = openId === m.id;
    return (
      <li key={m.id} className="tile px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setOpenId(open ? null : m.id)} className="min-w-0 flex-1 text-left">
            <p className="text-sm text-[var(--ink)]">{m.text}</p>
            <p className="text-xs text-[var(--ink-dim)]">
              {dayLabel(m.day)} · {String(m.data.time ?? "")} · {String(m.data.length ?? 30)} min · {valueLabel(m.data.type)}
            </p>
          </button>
          <IconButton label={t.common.delete} onClick={() => remove(m.id)} disabled={pending}>
            <Trash2 size={13} />
          </IconButton>
        </div>
        {open && (
          <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => void draftAgenda(m)} disabled={!!busy} className="mod-chip focus-ring">
              <Sparkles size={12} /> {busy === `agenda-${m.id}` ? m_.drafting : m_.draftAgenda}
            </button>
            <button type="button" onClick={() => void extractActions(m)} disabled={!!busy || !m.data.notes} className="mod-chip focus-ring">
              <ListChecks size={12} /> {busy === `actions-${m.id}` ? m_.reading : m_.extract}
            </button>
          </div>
          <textarea
            key={String(m.data.notes ?? "")}
            defaultValue={String(m.data.notes ?? m_.agenda.map((a) => `${a}${locale === "fr" ? " :" : ":"}\n`).join("\n"))}
            onBlur={(e) => update(m.id, { data: { notes: e.target.value } })}
            rows={8}
            aria-label={m_.notesAria}
            className="mt-2.5 w-full rounded-xl bg-[rgba(10,6,2,0.4)] p-3 text-sm leading-6 text-[var(--ink)] outline-none ring-1 ring-[rgba(255,220,148,0.15)] focus:ring-[rgba(255,220,148,0.4)]"
          />
          </>
        )}
      </li>
    );
  };

  return (
    <>
      <Block title={m_.planTitle} hint={m_.planHint} wide>
        {note && (
          <p className={noteIsError ? "mb-3 rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]" : "mb-3 text-xs text-[#f0cd79]"} role={noteIsError ? "alert" : "status"}>
            {note}
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            add("meeting", { day, text: title, data: { time, length: Number(length), type } });
            const [h, m] = time.split(":").map(Number);
            const t = h * 60 + m + Number(length);
            schedule({ title, day, start: time, end: `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, notes: type });
            setTitle("");
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={m_.subject} aria-label={m_.subject} className={`${field} flex-1 basis-48`} required />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label={m_.type} className={`${field} w-40 cursor-pointer appearance-none`}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {valueLabel(kind)}
              </option>
            ))}
          </select>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={k.day} className={`${field} w-36`} />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={k.time} className={`${field} w-24`} />
          <select value={length} onChange={(e) => setLength(e.target.value)} aria-label={m_.length} className={`${field} w-28 cursor-pointer appearance-none`}>
            {[15, 30, 45, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} min
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> {k.schedule}
          </button>
        </form>
      </Block>

      <Block title={m_.upcoming}>{upcoming.length ? <ul className="space-y-2">{upcoming.map(row)}</ul> : <Empty>{m_.upcomingEmpty}</Empty>}</Block>
      <Block title={m_.minutes}>{past.length ? <ul className="space-y-2">{past.slice(0, 10).map(row)}</ul> : <Empty>{m_.minutesEmpty}</Empty>}</Block>

      <Block title={m_.actions} hint={m_.actionsHint} wide>
        <EntryList
          module={module}
          kind="action"
          entries={entries}
          today={today}
          fields={[
            { key: "text", label: m_.action, type: "text", to: "text", required: true },
            { key: "owner", label: m_.owner, type: "text", width: "w-36" },
            { key: "day", label: m_.due, type: "date", to: "day" },
          ]}
          sort={(a, b) => Number(a.done) - Number(b.done) || a.day.localeCompare(b.day)}
          render={(e) => ({
            title: e.text,
            sub: `${e.data.owner ? `${e.data.owner} · ` : ""}${fmt(m_.forDay, { day: dayLabel(e.day) })}`,
            aside: !e.done && e.day < today ? <span className="font-semibold text-[#f0cd79]">{k.late}</span> : undefined,
          })}
          empty={m_.actionsEmpty}
        />
      </Block>
    </>
  );
}

export function Reunions(props: ModuleProps) {
  return <Meetings {...props} kinds={["Réunion", "Client", "Point d'avancement", "Entretien", "Atelier"]} />;
}

export function ReunionsEquipe(props: ModuleProps) {
  return <Meetings {...props} kinds={["Réunion d'équipe", "Point individuel (1:1)", "Rétrospective", "Planification", "Brainstorming"]} />;
}

// =========================================================================== Livrables

const STAGES = ["À faire", "En cours", "En revue", "Livré"];

export function Livrables({ module, today, entries }: ModuleProps) {
  const { add, update, remove, pending } = useEntries(module);
  const { t, day: dayLabel, value: valueLabel } = useModuleText();
  const d_ = t.modulesB.deliverables;
  const [text, setText] = useState("");
  const [forWho, setForWho] = useState("");
  const [day, setDay] = useState(today);
  const items = entries.filter((e) => e.kind === "deliverable");

  return (
    <>
      <Block title={d_.newTitle} hint={d_.newHint} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            add("deliverable", { day, text, data: { for: forWho, stage: STAGES[0] } });
            setText("");
            setForWho("");
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={d_.deliverable} aria-label={d_.deliverable} className={`${field} flex-1 basis-48`} required />
          <input value={forWho} onChange={(e) => setForWho(e.target.value)} placeholder={d_.forWho} aria-label={d_.recipient} className={`${field} w-40`} />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={d_.due} className={`${field} w-36`} />
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> {t.modulesB.kit.add}
          </button>
        </form>
      </Block>

      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
        {STAGES.map((stage, si) => {
          const col = items.filter((i) => (i.data.stage ?? STAGES[0]) === stage).sort((a, b) => a.day.localeCompare(b.day));
          return (
            <section key={stage} className="glass-card p-4">
              <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-[var(--ink)]">
                {valueLabel(stage)} <span className="text-xs font-normal text-[var(--ink-dim)]">{col.length}</span>
              </h3>
              <ul className="space-y-2">
                {col.map((i) => {
                  const d = daysBetween(today, i.day);
                  return (
                    <li key={i.id} className="tile px-3 py-2.5">
                      <p className="text-sm text-[var(--ink)]">{i.text}</p>
                      <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
                        {i.data.for ? `${i.data.for} · ` : ""}
                        <span className={stage !== "Livré" && d < 0 ? "font-semibold text-[#f0cd79]" : ""}>{stage === "Livré" ? dayLabel(i.day) : d < 0 ? fmt(d_.lateBy, { n: -d }) : d === 0 ? d_.today : fmt(t.modulesB.kit.countdown, { n: d })}</span>
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {si > 0 && (
                          <button type="button" disabled={pending} onClick={() => update(i.id, { data: { stage: STAGES[si - 1] } })} aria-label={d_.back} title={d_.back} className="mod-chip px-2 py-1 focus-ring">
                            ←
                          </button>
                        )}
                        {si < STAGES.length - 1 && (
                          <button type="button" disabled={pending} onClick={() => update(i.id, { data: { stage: STAGES[si + 1] }, done: si + 1 === STAGES.length - 1 })} className="mod-chip px-2 py-1 focus-ring">
                            {valueLabel(STAGES[si + 1])} →
                          </button>
                        )}
                        <span className="flex-1" />
                        <IconButton label={t.common.delete} onClick={() => remove(i.id)} disabled={pending}>
                          <Trash2 size={12} />
                        </IconButton>
                      </div>
                    </li>
                  );
                })}
                {col.length === 0 && <p className="py-3 text-center text-xs text-[var(--ink-faint)]">—</p>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

// =========================================================================== Suivis

export function Suivis({ module, today, entries }: ModuleProps) {
  const { t, day: dayLabel, value: valueLabel } = useModuleText();
  const f = t.modulesB.followups;
  const open = entries.filter((e) => e.kind === "followup" && !e.done);
  const late = open.filter((e) => e.day < today).length;
  return (
    <>
      <Block title={f.title} hint={f.hint} wide>
        <Stats
          items={[
            { label: f.waiting, value: `${open.length}` },
            { label: f.toChase, value: `${late}`, tone: "gold" },
          ]}
        />
        <div className="mt-4">
          <EntryList
            module={module}
            kind="followup"
            entries={entries}
            today={today}
            fields={[
              { key: "text", label: f.subject, type: "text", to: "text", required: true },
              { key: "person", label: f.person, type: "text", width: "w-36" },
              { key: "channel", label: f.channel, type: "select", options: ["Courriel", "Appel", "Message", "En personne"], width: "w-36" },
              { key: "day", label: f.chaseOn, type: "date", to: "day" },
            ]}
            sort={(a, b) => Number(a.done) - Number(b.done) || a.day.localeCompare(b.day)}
            render={(e) => ({
              title: e.text,
              sub: `${e.data.person ? `${e.data.person} · ` : ""}${valueLabel(e.data.channel)} · ${fmt(f.chaseOnDay, { day: dayLabel(e.day) })}`,
              aside: !e.done && e.day <= today ? <span className="font-semibold text-[#f0cd79]">{e.day < today ? t.modulesB.kit.late : t.modulesB.kit.today}</span> : undefined,
            })}
            empty={f.empty}
          />
        </div>
      </Block>
    </>
  );
}

// =========================================================================== Équipe

const members = (related: Record<string, Entry[]>, entries: Entry[], module: string) =>
  (module === "equipe:membres" ? entries : related["equipe:membres"] ?? []).filter((e) => e.kind === "member");

export function Membres({ module, today, entries }: ModuleProps) {
  const { t } = useModuleText();
  const m_ = t.modulesB.team;
  const team = entries.filter((e) => e.kind === "member");
  return (
    <Block title={fmt(m_.title, { n: team.length })} hint={m_.hint} wide>
      <EntryList
        module={module}
        kind="member"
        entries={entries}
        today={today}
        checkable={false}
        fields={[
          { key: "text", label: m_.name, type: "text", to: "text", required: true },
          { key: "role", label: m_.role, type: "text", width: "w-40" },
          { key: "email", label: m_.email, type: "text", width: "w-48" },
        ]}
        sort={(a, b) => (a.text ?? "").localeCompare(b.text ?? "")}
        render={(e) => ({
          title: (
            <span className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(240,205,121,0.15)] text-xs font-semibold text-[#f0cd79]">
                {(e.text ?? "?")
                  .split(" ")
                  .map((w) => w.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              {e.text}
            </span>
          ),
          sub: e.data.role ? String(e.data.role) : undefined,
        })}
        extra={(e) =>
          e.data.email ? (
            <a href={`mailto:${String(e.data.email)}`} aria-label={fmt(m_.writeTo, { name: e.text ?? "" })} className="mod-icon focus-ring">
              <Mail size={13} />
            </a>
          ) : null
        }
        empty={m_.membersEmpty}
      />
    </Block>
  );
}

export function Delegue({ module, today, entries, related }: ModuleProps) {
  const { t, day: dayLabel } = useModuleText();
  const m_ = t.modulesB.team;
  const team = members(related, entries, module);
  const items = entries.filter((e) => e.kind === "delegated");
  const people = [...new Set(items.filter((i) => !i.done).map((i) => String(i.data.to ?? "—")))];
  return (
    <>
      <Block title={m_.delegateTitle} hint={m_.delegateHint} wide>
        <EntryList
          module={module}
          kind="delegated"
          entries={entries}
          today={today}
          fields={[
            { key: "text", label: m_.task, type: "text", to: "text", required: true },
            team.length
              ? { key: "to", label: m_.toWhom, type: "select", options: team.map((m) => m.text ?? "—"), width: "w-40" }
              : { key: "to", label: m_.toWhom, type: "text", width: "w-40" },
            { key: "day", label: m_.forDay, type: "date", to: "day" },
          ]}
          sort={(a, b) => Number(a.done) - Number(b.done) || a.day.localeCompare(b.day)}
          render={(e) => ({
            title: e.text,
            sub: `${String(e.data.to ?? "—")} · ${fmt(m_.forDayLower, { day: dayLabel(e.day) })}`,
            aside: !e.done && e.day < today ? <span className="font-semibold text-[#f0cd79]">{m_.late}</span> : undefined,
          })}
          empty={team.length ? m_.delegateEmpty : m_.delegateEmptyNoTeam}
        />
      </Block>
      <Block title={m_.load}>
        {people.length === 0 ? (
          <Empty>{m_.loadEmpty}</Empty>
        ) : (
          <ul className="space-y-2.5">
            {people.map((p) => {
              const n = items.filter((i) => !i.done && String(i.data.to ?? "—") === p).length;
              return (
                <li key={p}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-[var(--ink)]">{p}</span>
                    <span className="text-[var(--ink-dim)]">{fmt(m_.inProgress, { n })}</span>
                  </div>
                  <Meter value={n} max={Math.max(...people.map((q) => items.filter((i) => !i.done && String(i.data.to ?? "—") === q).length))} />
                </li>
              );
            })}
          </ul>
        )}
      </Block>
    </>
  );
}

export function SuiviEquipe({ module, today, entries, related }: ModuleProps) {
  const delegated = (related["equipe:delegue"] ?? []).filter((e) => e.kind === "delegated");
  const done = delegated.filter((d) => d.done).length;
  const late = delegated.filter((d) => !d.done && d.day < today).length;
  const team = (related["equipe:membres"] ?? []).filter((e) => e.kind === "member").length;
  const kpis = entries.filter((e) => e.kind === "kpi");
  const { update, pending } = useEntries(module);
  const { t, pct } = useModuleText();
  const m_ = t.modulesB.team;

  return (
    <>
      <Block title={m_.overview} wide>
        <Stats
          items={[
            { label: m_.members, value: `${team}` },
            { label: m_.delegated, value: `${delegated.length}` },
            { label: m_.completed, value: delegated.length ? pct(Math.round((done / delegated.length) * 100)) : "—", tone: "gold" },
            { label: m_.late, value: `${late}` },
          ]}
        />
      </Block>
      <Block title={m_.goals} hint={m_.goalsHint} wide>
        <EntryList
          module={module}
          kind="kpi"
          entries={entries}
          today={today}
          checkable={false}
          fields={[
            { key: "text", label: m_.goal, type: "text", to: "text", required: true },
            { key: "value", label: m_.current, type: "number", to: "value", width: "w-24" },
            { key: "target", label: m_.target, type: "number", width: "w-24" },
          ]}
          render={(e) => ({
            title: e.text,
            sub: (
              <span className="mt-1 block">
                <Meter value={e.value ?? 0} max={Number(e.data.target) || 1} label={`${e.value ?? 0} / ${String(e.data.target ?? "—")}`} />
              </span>
            ),
          })}
          extra={(e) => (
            <input
              type="number"
              defaultValue={e.value ?? 0}
              aria-label={m_.update}
              disabled={pending}
              onBlur={(ev) => Number(ev.target.value) !== e.value && update(e.id, { value: Number(ev.target.value) })}
              className={`${field} w-20`}
            />
          )}
          empty={m_.goalsEmpty}
        />
        {kpis.length > 0 && <p className="mt-2 text-xs text-[var(--ink-faint)]">{m_.goalsTip}</p>}
      </Block>
    </>
  );
}

// =========================================================================== Apprentissage

export function Lectures({ module, today, entries }: ModuleProps) {
  const { update, pending } = useEntries(module);
  const { t } = useModuleText();
  const l = t.modulesB.learning;
  const books = entries.filter((e) => e.kind === "book");
  const year = today.slice(0, 4);
  const finished = books.filter((b) => b.done && String(b.data.finished ?? "").startsWith(year)).length;
  return (
    <>
      <Block title={l.library} hint={l.libraryHint} wide>
        <Stats
          items={[
            { label: l.reading, value: `${books.filter((b) => !b.done).length}` },
            { label: fmt(l.readIn, { year }), value: `${finished}`, tone: "gold" },
          ]}
        />
        <div className="mt-4">
          <EntryList
            module={module}
            kind="book"
            entries={entries}
            today={today}
            checkable={false}
            fields={[
              { key: "text", label: l.bookTitle, type: "text", to: "text", required: true },
              { key: "author", label: l.author, type: "text", width: "w-36" },
              { key: "pages", label: l.pages, type: "number", width: "w-24" },
            ]}
            sort={(a, b) => Number(a.done) - Number(b.done)}
            render={(e) => {
              const pages = Number(e.data.pages) || 0;
              const at = Number(e.data.at) || 0;
              return {
                title: e.text,
                sub: (
                  <span className="mt-1 block">
                    {e.data.author ? `${e.data.author} · ` : ""}
                    {e.done ? l.finished : pages ? fmt(l.pageOf, { at, pages }) : l.inProgress}
                    {pages > 0 && !e.done && (
                      <span className="mt-1.5 block">
                        <Meter value={at} max={pages} />
                      </span>
                    )}
                  </span>
                ),
              };
            }}
            extra={(e) =>
              e.done ? null : (
                <span className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder={l.page}
                    aria-label={l.pageReached}
                    disabled={pending}
                    onBlur={(ev) => ev.target.value && update(e.id, { data: { at: Number(ev.target.value) } })}
                    className={`${field} w-20`}
                  />
                  <button type="button" disabled={pending} onClick={() => update(e.id, { done: true, data: { finished: today, at: Number(e.data.pages) || 0 } })} className="mod-chip focus-ring">
                    {l.finish}
                  </button>
                </span>
              )
            }
            empty={l.booksEmpty}
          />
        </div>
      </Block>
    </>
  );
}

export function Formations({ module, today, entries }: ModuleProps) {
  const { update, pending } = useEntries(module);
  const { t } = useModuleText();
  const l = t.modulesB.learning;
  return (
    <Block title={l.courses} hint={l.coursesHint} wide>
      <EntryList
        module={module}
        kind="course"
        entries={entries}
        today={today}
        fields={[
          { key: "text", label: l.course, type: "text", to: "text", required: true },
          { key: "platform", label: l.platform, type: "text", width: "w-36", placeholder: "Coursera, edX…" },
          { key: "hours", label: l.hours, type: "number", width: "w-24" },
        ]}
        sort={(a, b) => Number(a.done) - Number(b.done)}
        render={(e) => ({
          title: e.text,
          sub: (
            <span className="mt-1 block">
              {[e.data.platform, e.data.hours ? `${e.data.hours} h` : null].filter(Boolean).join(" · ")}
              <span className="mt-1.5 block">
                <Meter value={e.value ?? 0} max={100} label={e.done ? l.certified : l.progress} />
              </span>
            </span>
          ),
        })}
        extra={(e) =>
          e.done ? null : (
            <button type="button" disabled={pending} onClick={() => update(e.id, { value: Math.min(100, (e.value ?? 0) + 10), done: (e.value ?? 0) + 10 >= 100 })} className="mod-chip focus-ring">
              +10 %
            </button>
          )
        }
        empty={l.coursesEmpty}
      />
    </Block>
  );
}

export function Competences({ module, today, entries }: ModuleProps) {
  const { add, update, remove, pending } = useEntries(module);
  const { t } = useModuleText();
  const l = t.modulesB.learning;
  const [name, setName] = useState("");
  const skills = entries.filter((e) => e.kind === "skill");
  const practice = entries.filter((e) => e.kind === "practice");
  const minutesOn = (d: string) => practice.filter((p) => p.day === d).reduce((a, p) => a + (p.value ?? 0), 0);

  return (
    <>
      <Block title={l.skills} hint={l.skillsHint} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            add("skill", { text: name, value: 1, data: { target: 4 } });
            setName("");
          }}
          className="mb-3 flex items-center gap-2"
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={l.skillPlaceholder} aria-label={l.skill} className={`${field} flex-1`} />
          <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
            <Plus size={13} /> {t.modulesB.kit.add}
          </button>
        </form>
        {skills.length === 0 ? (
          <Empty>{l.skillsEmpty}</Empty>
        ) : (
          <ul className="space-y-2">
            {skills.map((s) => {
              const mins = practice.filter((p) => p.data.skill === s.id).reduce((a, p) => a + (p.value ?? 0), 0);
              return (
                <li key={s.id} className="tile flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--ink)]">{s.text}</p>
                    <p className="text-xs text-[var(--ink-dim)]">{fmt(l.practiceHours, { n: Math.round(mins / 6) / 10 })}</p>
                  </div>
                  <div className="flex gap-1" role="radiogroup" aria-label={fmt(l.level, { skill: s.text ?? "" })}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={(s.value ?? 1) === n}
                        disabled={pending}
                        onClick={() => update(s.id, { value: n })}
                        className={`h-2.5 w-6 rounded-full transition-colors ${n <= (s.value ?? 1) ? "bg-[#f0cd79]" : "bg-[rgba(255,220,148,0.15)]"}`}
                      />
                    ))}
                  </div>
                  {[15, 30, 60].map((m) => (
                    <button key={m} type="button" disabled={pending} onClick={() => add("practice", { day: today, value: m, data: { skill: s.id } })} className="mod-chip px-2.5 py-1 focus-ring">
                      +{m} min
                    </button>
                  ))}
                  <IconButton label={t.common.delete} onClick={() => remove(s.id)} disabled={pending}>
                    <Trash2 size={13} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </Block>
      <Block title={l.week} wide>
        <DayBars days={lastDays(today, 7)} value={minutesOn} target={60} unit="min" />
        <p className="mt-2 text-xs text-[var(--ink-dim)]">{fmt(l.weekTotal, { n: lastDays(today, 7).reduce((a, d) => a + minutesOn(d), 0) })}</p>
      </Block>
    </>
  );
}

export function GeneralProjets({ module, today, entries }: ModuleProps) {
  const { t, value: valueLabel } = useModuleText();
  const i_ = t.modulesB.ideas;
  return (
    <Block title={i_.title} hint={i_.hint} wide>
      <EntryList
        module={module}
        kind="idea"
        entries={entries}
        today={today}
        fields={[
          { key: "text", label: i_.idea, type: "text", to: "text", required: true },
          { key: "horizon", label: i_.horizon, type: "select", options: ["Ce mois-ci", "Ce trimestre", "Cette année", "Un jour"], width: "w-40" },
        ]}
        render={(e) => ({ title: e.text, sub: e.data.horizon ? valueLabel(e.data.horizon) : undefined })}
        empty={i_.empty}
      />
    </Block>
  );
}
