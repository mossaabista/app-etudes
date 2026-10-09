"use client";

import { useState } from "react";
import { Check, Lightbulb, Plus, Trash2 } from "lucide-react";
import { Block, CheckBox, DailyChecklist, DayBars, Empty, IconButton, RecurringList, Stats, addDays, field, lastDays, streak, useEntries, useModuleText, type Entry } from "@/components/modules/kit";
import { fmt } from "@/i18n/config";
import { slug, type BlockSpec } from "@/lib/layout";

/**
 * A section that exists nowhere in the library, assembled from blocks — usually by the
 * assistant ("crée-moi une section guitare"). Each block keeps its rows under its own kind
 * so two lists in one section never mix.
 */
export function CustomSection({ module, today, entries, blocks }: { module: string; today: string; entries: Entry[]; blocks: BlockSpec[] }) {
  const { t } = useModuleText();
  const c = t.modulesB.custom;
  if (!blocks.length)
    return (
      <Block title={c.emptyTitle} wide>
        <Empty>{c.emptyText}</Empty>
      </Block>
    );
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "checklist":
            return (
              <Block key={i} title={b.title} hint={c.checklistHint}>
                <DailyChecklist module={module} entries={entries} today={today} items={b.items.map((label) => ({ key: `${i}-${slug(label)}`, label }))} />
              </Block>
            );
          case "log":
            return <LogBlock key={i} index={i} spec={b} module={module} today={today} entries={entries} />;
          case "list":
            return <ListBlock key={i} index={i} spec={b} module={module} entries={entries} />;
          case "recurring":
            return (
              <Block key={i} title={b.title} hint={c.recurringHint}>
                <RecurringList module={module} entries={entries} today={today} suggestions={b.items.map((x) => ({ text: x.label, period: x.every }))} />
              </Block>
            );
          case "tips":
            return (
              <Block key={i} title={b.title}>
                <ul className="space-y-2">
                  {b.items.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm leading-6 text-[var(--ink-dim)]">
                      <Lightbulb size={15} className="mt-1 shrink-0 text-[#f0cd79]" />
                      {t}
                    </li>
                  ))}
                </ul>
              </Block>
            );
          case "notes":
            return <NotesBlock key={i} index={i} spec={b} module={module} today={today} entries={entries} />;
        }
      })}
    </>
  );
}

function LogBlock({ index, spec, module, today, entries }: { index: number; spec: Extract<BlockSpec, { type: "log" }>; module: string; today: string; entries: Entry[] }) {
  const kind = `log-${index}`;
  const { add, remove, pending } = useEntries(module);
  const { t, day: dayLabel } = useModuleText();
  const c = t.modulesB.custom;
  const k = t.modulesB.kit;
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const rows = entries.filter((e) => e.kind === kind);
  const on = (day: string) => rows.filter((r) => r.day === day).reduce((s, r) => s + (r.value ?? 0), 0);
  const week = lastDays(today, 7).reduce((s, d) => s + on(d), 0);
  const goal = spec.goal ?? 0;
  const run = streak(today, (d) => on(d) > 0);
  // Short units keep the figures on one line: "45 min", not "45 minutes".
  const short: Record<string, string> = { minutes: "min", minute: "min", heures: "h", heure: "h", kilomètres: "km", kilometres: "km", pages: "p." };
  const unit = spec.unit ? ` ${short[spec.unit.toLowerCase()] ?? spec.unit}` : "";

  return (
    <Block title={spec.title} hint={goal ? fmt(spec.period === "week" ? c.goalWeek : c.goalDay, { goal, unit }) : undefined}>
      <Stats
        items={[
          { label: k.today, value: `${on(today)}${unit}`, tone: "gold" },
          { label: c.days7, value: `${week}${unit}` },
          { label: c.streak, value: fmt(c.nDays, { n: run }) },
          { label: c.entries, value: String(rows.length) },
        ]}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(value.replace(",", "."));
          if (!Number.isFinite(v) || v <= 0) return;
          add(kind, { day: today, value: v, text: note.trim() || null });
          setValue("");
          setNote("");
        }}
        className="mt-4 flex flex-wrap gap-2"
      >
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={spec.unit || c.value} aria-label={c.value} className={`${field} w-28`} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.note} aria-label={c.noteAria} className={`${field} flex-1 basis-40`} />
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          <Plus size={13} /> {c.log}
        </button>
      </form>
      <div className="mt-4">
        <DayBars days={lastDays(today, 7)} value={on} target={spec.period === "week" ? goal / 7 : goal || Math.max(1, ...lastDays(today, 7).map(on))} unit={unit} />
      </div>
      {rows.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {rows.slice(0, 6).map((r) => (
            <li key={r.id} className="flex items-center gap-3 text-xs text-[var(--ink-dim)]">
              <span className="w-20 shrink-0">{r.day === today ? k.today : r.day === addDays(today, -1) ? k.yesterday : dayLabel(r.day, { day: "numeric", month: "short" })}</span>
              <span className="font-semibold text-[var(--ink)]">
                {r.value}
                {unit}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.text}</span>
              <IconButton label={t.common.delete} onClick={() => remove(r.id)} disabled={pending}>
                <Trash2 size={12} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function ListBlock({ index, spec, module, entries }: { index: number; spec: Extract<BlockSpec, { type: "list" }>; module: string; entries: Entry[] }) {
  const kind = `list-${index}`;
  const { add, update, remove, pending } = useEntries(module);
  const { t } = useModuleText();
  const c = t.modulesB.custom;
  const [text, setText] = useState("");
  const rows = entries.filter((e) => e.kind === kind).sort((a, b) => Number(a.done) - Number(b.done));
  const doneCount = rows.filter((r) => r.done).length;
  return (
    <Block title={spec.title} hint={fmt(doneCount > 1 ? c.listHintMany : c.listHintOne, { open: rows.length - doneCount, done: doneCount })}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          add(kind, { text: text.trim() });
          setText("");
        }}
        className="mb-3 flex gap-2"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={spec.placeholder ?? c.listPlaceholder} aria-label={c.newItem} className={`${field} flex-1`} />
        <button type="submit" disabled={pending} className="mod-chip mod-chip-gold focus-ring">
          <Plus size={13} />
        </button>
      </form>
      {rows.length === 0 ? (
        <Empty>{c.listEmpty}</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className={`tile flex items-center gap-3 px-3.5 py-2.5 ${r.done ? "opacity-55" : ""}`}>
              <CheckBox checked={r.done} label={r.text ?? ""} disabled={pending} onChange={() => update(r.id, { done: !r.done })} />
              <span className={`min-w-0 flex-1 text-sm text-[var(--ink)] ${r.done ? "line-through" : ""}`}>{r.text}</span>
              <IconButton label={t.common.delete} onClick={() => remove(r.id)} disabled={pending}>
                <Trash2 size={13} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function NotesBlock({ index, spec, module, today, entries }: { index: number; spec: Extract<BlockSpec, { type: "notes" }>; module: string; today: string; entries: Entry[] }) {
  const kind = `note-${index}`;
  const { add, update, pending } = useEntries(module);
  const { t } = useModuleText();
  const c = t.modulesB.custom;
  const row = entries.find((e) => e.kind === kind);
  const [text, setText] = useState(row?.text ?? "");
  const [saved, setSaved] = useState(false);
  return (
    <Block
      title={spec.title}
      action={
        saved ? (
          <span className="flex items-center gap-1 text-xs text-[#f0cd79]">
            <Check size={12} /> {c.saved}
          </span>
        ) : null
      }
    >
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          if ((row?.text ?? "") === text) return;
          if (row) update(row.id, { text });
          else add(kind, { day: today, text });
          setSaved(true);
        }}
        rows={6}
        disabled={pending && !row}
        placeholder={c.notesPlaceholder}
        aria-label={spec.title}
        className="glass-pill focus-ring w-full resize-y rounded-2xl px-4 py-3 text-sm leading-6 text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
      />
    </Block>
  );
}
