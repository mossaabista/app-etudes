"use client";

import { toggleAssessmentStatusAction, deleteAssessmentAction } from "@/server/actions/assessment.actions";
import { StatusBadge } from "@/components/ui/Badge";
import Link from "next/link";

type Assessment = {
  id: string; courseId: string; title: string; type: string;
  weight: number | null; dueDate: Date | null; status: string;
  grade: number | null; course: { code: string; color: string };
};

export function AssessmentRow({ a }: { a: Assessment }) {
  const due = a.dueDate ? new Date(a.dueDate) : null;
  const isPast = due && due < new Date() && a.status !== "Completed";

  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-100 bg-white px-4 py-3">
      <button
        onClick={() => toggleAssessmentStatusAction(a.id)}
        className={`h-5 w-5 shrink-0 rounded border-2 transition-colors ${
          a.status === "Completed"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {a.status === "Completed" && <span className="flex items-center justify-center text-xs">✓</span>}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/assessments/${a.id}/edit`} className="text-sm font-medium text-slate-900 hover:text-slate-600 truncate">
            {a.title}
          </Link>
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: a.course.color }}>
            {a.course.code}
          </span>
        </div>
        <div className="mt-0.5 flex gap-3 text-xs text-slate-500">
          <span>{a.type}</span>
          {a.weight != null && <span>{a.weight}%</span>}
          {due && <span className={isPast ? "text-red-500 font-medium" : ""}>{due.toLocaleDateString("en-CA")}</span>}
          {a.grade != null && <span className="text-emerald-600 font-medium">{a.grade}%</span>}
        </div>
      </div>

      <StatusBadge status={a.status} />

      <button
        onClick={() => deleteAssessmentAction(a.id)}
        className="text-xs text-slate-400 hover:text-red-500"
      >
        ✕
      </button>
    </div>
  );
}
