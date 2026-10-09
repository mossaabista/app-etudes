"use client";

import { labelIn } from "@/lib/labels";
import { currentZone } from "@/lib/dates";
import { toggleAssessmentStatusAction, deleteAssessmentAction } from "@/server/actions/assessment.actions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useI18n } from "@/i18n/client";
import { INTL, fmt, type Locale } from "@/i18n/config";
import { Check, X } from "lucide-react";
import Link from "next/link";

type Assessment = {
  id: string; courseId: string; title: string; type: string;
  weight: number | null; dueDate: Date | null; status: string;
  grade: number | null; course: { code: string; color: string };
};

const TONE: Record<string, BadgeTone> = { Upcoming: "blue", Completed: "green", Overdue: "red" };
const percent = (n: number, locale: Locale) => `${new Intl.NumberFormat(INTL[locale], { maximumFractionDigits: 2 }).format(n)}${locale === "fr" ? " %" : "%"}`;

export function AssessmentRow({ a }: { a: Assessment }) {
  const { t, locale } = useI18n();
  const k = t.academics;
  const due = a.dueDate ? new Date(a.dueDate) : null;
  const isPast = due && due < new Date() && a.status !== "Completed";
  const done = a.status === "Completed";

  return (
    <div className="tile flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={fmt(done ? k.reopen : k.markDone, { title: a.title })}
        onClick={() => toggleAssessmentStatusAction(a.id)}
        className="check focus-ring"
        data-checked={done || undefined}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/assessments/${a.id}/edit`} className="truncate text-sm font-medium text-[var(--ink)] hover:text-[#f0cd79]">
            {a.title}
          </Link>
          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: a.course.color }}>
            {a.course.code}
          </span>
        </div>
        <div className="mt-0.5 flex gap-3 text-xs text-[var(--ink-dim)]">
          <span>{labelIn(a.type, locale)}</span>
          {a.weight != null && <span>{percent(a.weight, locale)}</span>}
          {due && (
            <span className={isPast ? "font-medium text-[#ffb3a3]" : ""}>
              {new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "short", year: "numeric" }).format(due)}
            </span>
          )}
          {a.grade != null && <span className="font-medium text-[#f0cd79]">{percent(a.grade, locale)}</span>}
        </div>
      </div>

      <Badge tone={TONE[a.status] ?? "neutral"}>{labelIn(a.status, locale)}</Badge>

      <button
        type="button"
        onClick={() => deleteAssessmentAction(a.id)}
        aria-label={fmt(k.deleteAria, { title: a.title })}
        className="focus-ring text-[var(--ink-faint)] hover:text-[#ffb3a3]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
