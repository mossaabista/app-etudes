"use client";

import { currentZone } from "@/lib/dates";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, PencilLine } from "lucide-react";
import { setAssessmentGradeAction, toggleAssessmentStatusAction } from "@/server/actions/assessment.actions";
import { label } from "@/lib/labels";

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
const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  const date = new Intl.DateTimeFormat("fr-CA", { timeZone: currentZone(), weekday: "short", day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("fr-CA", { timeZone: currentZone(), hour: "2-digit", minute: "2-digit" }).format(d);
  return { label: `${date} · ${time}`, days };
};

/** Every assessment of the course on one timeline: tick it, give it its grade. */
export function CourseAssessments({ items }: { items: CourseAssessment[] }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");

  return (
    <ol className="relative space-y-2 pl-5 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-[rgba(255,220,148,0.18)]" aria-busy={pending}>
      {items.map((a) => {
        const w = a.due ? when(a.due) : null;
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
                aria-label={a.done ? `Rouvrir « ${a.title} »` : `Marquer « ${a.title} » comme fait`}
                onClick={() => start(() => toggleAssessmentStatusAction(a.id))}
                className="check focus-ring"
                data-checked={a.done || undefined}
              >
                {a.done && <Check size={12} strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1 basis-48">
                <p className={`text-sm font-medium text-[var(--ink)] ${a.done ? "line-through" : ""}`}>{a.title}</p>
                <p className="mt-0.5 text-xs text-[var(--ink-dim)]">
                  {label(a.type)}
                  {a.weight != null && ` · ${String(a.weight).replace(".", ",")} %`}
                  {w && ` · ${w.label}`}
                </p>
              </div>
              {soon && <span className="rounded-full bg-[rgba(240,205,121,0.16)] px-2 py-0.5 text-[11px] font-semibold text-[#f0cd79]">{w!.days === 0 ? "Aujourd'hui" : w!.days === 1 ? "Demain" : `Dans ${w!.days} j`}</span>}
              {late && <span className="rounded-full bg-[rgba(248,113,113,0.16)] px-2 py-0.5 text-[11px] font-semibold text-[#ffb3a3]">En retard</span>}
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
                  <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="%" aria-label="Note en %" className="glass-pill w-16 px-2.5 py-1 text-xs text-[var(--ink)]" />
                  <button type="submit" className="mod-chip mod-chip-gold focus-ring">
                    OK
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
                  aria-label={a.grade != null ? `Note : ${a.grade} %, modifier` : "Ajouter la note"}
                >
                  {a.grade != null ? `${String(a.grade).replace(".", ",")} %` : <><PencilLine size={12} /> Note</>}
                </button>
              )}
              <Link href={`/assessments/${a.id}/edit`} className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink)]">
                Modifier
              </Link>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
