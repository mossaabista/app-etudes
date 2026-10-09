"use client";

import { currentZone } from "@/lib/dates";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, PencilLine } from "lucide-react";
import { setAssessmentGradeAction, toggleAssessmentStatusAction } from "@/server/actions/assessment.actions";
import { labelIn } from "@/lib/labels";
import { useI18n } from "@/i18n/client";
import { INTL, fmt, type Locale } from "@/i18n/config";

export interface CourseAssessment {
  id: string;
  title: string;
  type: string;
  weight: number | null;
  due: string | null;
  done: boolean;
  grade: number | null;
}

const TYPE_COLOR: Record<string, string> = { Final: "#f07a6a", Exam: "#f07a6a", Midterm: "#f07a6a", Quiz: "#b994e8", Lab: "#e889b5", Project: "#f0a35e", Presentation: "#f0a35e", Report: "#f0a35e", Assignment: "#6cc98f" };
const when = (iso: string, locale: Locale) => {
  const d = new Date(iso);
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  const date = new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), hour: "2-digit", minute: "2-digit" }).format(d);
  return { label: `${date} · ${time}`, days };
};
const percent = (n: number, locale: Locale) => `${new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 2 }).format(n)}${locale === "fr" ? " %" : "%"}`;

/** Every assessment of the course on one timeline: tick it, give it its grade. */
export function CourseAssessments({ items }: { items: CourseAssessment[] }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const { t, locale } = useI18n();
  const k = t.academics;

  return (
    <ol className="relative space-y-2 pl-5 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-[rgba(255,220,148,0.18)]" aria-busy={pending}>
      {items.map((a) => {
        const w = a.due ? when(a.due, locale) : null;
        const soon = w && !a.done && w.days >= 0 && w.days <= 7;
        const late = w && !a.done && w.days < 0;
        return (
          <li key={a.id} className="relative">
            <span className="absolute -left-5 top-4 h-3.5 w-3.5 rounded-full ring-2 ring-[#1a1106]" style={{ background: TYPE_COLOR[a.type] ?? "#b8ad9c", opacity: a.done ? 0.45 : 1 }} aria-hidden />
            <div className={`tile flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-3 ${a.done ? "opacity-60" : ""}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked={a.done}
                aria-label={fmt(a.done ? k.reopen : k.markDone, { title: a.title })}
                onClick={() => start(() => toggleAssessmentStatusAction(a.id))}
                className="check focus-ring"
                data-checked={a.done || undefined}
              >
                {a.done && <Check size={12} strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1 basis-48">
                <p className={`text-sm font-medium text-[var(--ink)] ${a.done ? "line-through" : ""}`}>{a.title}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
                  {labelIn(a.type, locale)}
                  {a.weight != null && ` · ${percent(a.weight, locale)}`}
                  {w && ` · ${w.label}`}
                </p>
              </div>
              {soon && <span className="rounded-full bg-[rgba(240,205,121,0.16)] px-2 py-0.5 text-[11px] font-semibold text-[#f0cd79]">{w!.days === 0 ? k.today : w!.days === 1 ? k.tomorrow : fmt(k.inNDays, { n: w!.days })}</span>}
              {late && <span className="rounded-full bg-[rgba(248,113,113,0.16)] px-2 py-0.5 text-[11px] font-semibold text-[#ffb3a3]">{k.late}</span>}
              {editing === a.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const g = value.trim() === "" ? null : Number(value.replace(",", "."));
                    start(async () => {
                      await setAssessmentGradeAction(a.id, g);
                      setEditing(null);
                    });
                  }}
                  className="flex items-center gap-1"
                >
                  <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="%" aria-label={k.gradeAria} className="glass-pill w-16 px-2.5 py-1 text-xs text-[var(--ink)]" />
                  <button type="submit" className="mod-chip mod-chip-gold focus-ring">
                    {k.ok}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(a.id);
                    setValue(a.grade != null ? String(a.grade) : "");
                  }}
                  className={`mod-chip focus-ring ${a.grade != null ? "mod-chip-gold" : ""}`}
                  aria-label={a.grade != null ? fmt(k.gradeEditAria, { grade: percent(a.grade, locale) }) : k.addGrade}
                >
                  {a.grade != null ? percent(a.grade, locale) : <><PencilLine size={12} /> {k.grade}</>}
                </button>
              )}
              <Link href={`/assessments/${a.id}/edit`} className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink)]">
                {t.common.edit}
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
