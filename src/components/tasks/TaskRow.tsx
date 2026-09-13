"use client";

import { toggleTaskStatusAction, deleteTaskAction } from "@/server/actions/task.actions";
import { PriorityBadge } from "@/components/ui/Badge";

type Task = {
  id: string; title: string; priority: string; status: string;
  dueDate: Date | null; estimatedTime: number | null;
  course: { code: string; color: string } | null;
};

export function TaskRow({ task }: { task: Task }) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isPast = due && due < new Date() && task.status !== "Done";

  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-100 bg-white px-4 py-3">
      <button
        onClick={() => toggleTaskStatusAction(task.id)}
        className={`h-5 w-5 shrink-0 rounded border-2 transition-colors ${
          task.status === "Done"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        {task.status === "Done" && <span className="flex items-center justify-center text-xs">✓</span>}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${task.status === "Done" ? "line-through text-slate-400" : "text-slate-900"}`}>
            {task.title}
          </span>
          {task.course && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: task.course.color }}>
              {task.course.code}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex gap-3 text-xs text-slate-500">
          {due && <span className={isPast ? "text-red-500 font-medium" : ""}>{due.toLocaleDateString("en-CA")}</span>}
          {task.estimatedTime && <span>{task.estimatedTime}min</span>}
        </div>
      </div>

      <PriorityBadge priority={task.priority} />

      <button
        onClick={() => deleteTaskAction(task.id)}
        className="text-xs text-slate-400 hover:text-red-500"
      >
        ✕
      </button>
    </div>
  );
}
