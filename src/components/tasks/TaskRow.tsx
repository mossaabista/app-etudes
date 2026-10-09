"use client";

import { Check, X } from "lucide-react";
import { toggleTaskStatusAction, deleteTaskAction } from "@/server/actions/task.actions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { labelIn } from "@/lib/labels";
import { currentZone } from "@/lib/dates";
import { useI18n } from "@/i18n/client";
import { fmt, INTL } from "@/i18n/config";

type Task = {
  id: string; title: string; priority: string; status: string;
  dueDate: Date | null; estimatedTime: number | null;
  course: { code: string; color: string } | null;
};

const PRIORITY_TONE: Record<string, BadgeTone> = { Low: "neutral", Medium: "blue", High: "amber", Critical: "red" };

export function TaskRow({ task }: { task: Task }) {
  const { t, locale } = useI18n();
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isPast = due && due < new Date() && task.status !== "Done";
  const done = task.status === "Done";

  return (
    <div className={`tile flex items-center gap-3 px-3.5 py-2.5 ${done ? "opacity-55" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={fmt(done ? t.today.reopenTask : t.today.completeTask, { title: task.title })}
        onClick={() => toggleTaskStatusAction(task.id)}
        className="check focus-ring"
        data-checked={done || undefined}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium text-[var(--ink)] ${done ? "line-through" : ""}`}>
            {task.title}
          </span>
          {task.course && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: task.course.color }}>
              {task.course.code}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex gap-3 text-xs text-[var(--ink-dim)]">
          {due && (
            <span className={isPast ? "font-semibold text-[#ffb3a3]" : ""}>
              {new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "short", year: "numeric" }).format(due)}
            </span>
          )}
          {task.estimatedTime ? <span>{fmt(t.workspace.task.minutes, { n: task.estimatedTime })}</span> : null}
        </div>
      </div>

      <Badge tone={PRIORITY_TONE[task.priority] ?? "neutral"}>{labelIn(task.priority, locale)}</Badge>

      <button
        type="button"
        onClick={() => deleteTaskAction(task.id)}
        aria-label={fmt(t.workspace.task.deleteNamed, { title: task.title })}
        className="focus-ring rounded-full p-1 text-[var(--ink-faint)] hover:text-[#ffb3a3]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
