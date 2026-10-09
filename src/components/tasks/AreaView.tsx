"use client";

import { currentZone } from "@/lib/dates";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Plus, X } from "lucide-react";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { WidgetCarousel } from "@/components/tasks/WidgetCarousel";
import { createTaskAction, deleteTaskAction, toggleTaskStatusAction } from "@/server/actions/task.actions";
import { PROJECT_VISUAL, type SubArea } from "@/lib/task-areas";
import { imageSrc, type AreaSpec } from "@/lib/layout";
import { useI18n } from "@/i18n/client";
import { fmt, INTL, type Locale } from "@/i18n/config";

export interface AreaTask {
  id: string;
  title: string;
  done: boolean;
  due: string | null;
  sub: string;
}

const dueLabel = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));

export function AreaView({
  area: spec,
  projects,
  tasks,
  initialSub,
}: {
  area: AreaSpec;
  projects: { id: string; title: string }[];
  tasks: AreaTask[];
  initialSub?: string;
}) {
  const { t } = useI18n();
  const area = useMemo(() => ({ ...spec, subs: spec.subs.map((s) => ({ key: s.key, label: s.label, visual: { src: imageSrc(s.image) } })) }), [spec]);

  // For Projets the keys are the user's projects, plus "Général" for anything filed there
  // without one (or when there are no projects at all).
  const subs: SubArea[] = useMemo(() => {
    if (area.key !== "projets") return area.subs;
    const own = projects.map((p) => ({ key: p.id, label: p.title, visual: PROJECT_VISUAL }));
    const needsGeneral = own.length === 0 || tasks.some((x) => x.sub === "general");
    return needsGeneral ? [...own, ...area.subs] : own;
  }, [area, projects, tasks]);

  const [active, setActive] = useState(() => Math.max(subs.findIndex((s) => s.key === initialSub), 0));
  const current = subs[Math.min(active, subs.length - 1)];

  const bySub = useMemo(() => {
    const map = new Map<string, AreaTask[]>();
    for (const x of tasks) (map.get(x.sub) ?? map.set(x.sub, []).get(x.sub)!).push(x);
    return map;
  }, [tasks]);

  // Keep the open section in the address so a reload, or a link, lands on the same key.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", current.key);
    window.history.replaceState(null, "", url);
  }, [current.key]);

  return (
    <>
      {/* Outside the animated wrapper: a transformed ancestor would pin this fixed layer
          to the wrapper's box instead of the viewport. */}
      <div className="glass-backdrop" aria-hidden />
      <div className="area-enter">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/tasks" aria-label={t.workspace.area.back} className="lm focus-ring h-11 w-11 shrink-0">
            <LiquidLayers>
              <ChevronLeft size={18} />
            </LiquidLayers>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-on-gold">
              {area.label}
            </h1>
            <p className="truncate text-xs text-on-gold">{area.blurb}</p>
          </div>
        </div>

        <WidgetCarousel
          active={active}
          onActiveChange={setActive}
          items={subs.map((s) => ({
            key: s.key,
            label: s.label,
            src: s.visual.src,
            count: (bySub.get(s.key) ?? []).filter((x) => !x.done).length,
            href: `/tasks/${area.key}/${s.key}`,
          }))}
        />

        <div className="mx-auto mt-6 max-w-2xl">
          <TaskDrawer
            key={current.key}
            areaKey={area.key}
            sub={current}
            isProject={area.key === "projets" && current.key !== "general"}
            tasks={bySub.get(current.key) ?? []}
          />
        </div>
      </div>
    </>
  );
}

/** The open drawer under the carousel: the tasks of the section on the key that is down. */
export function TaskDrawer({
  areaKey,
  sub,
  isProject,
  tasks,
}: {
  areaKey: string;
  sub: SubArea;
  isProject: boolean;
  tasks: AreaTask[];
}) {
  const { t, locale } = useI18n();
  const w = t.workspace.area;
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, adding] = useActionState(createTaskAction, null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state && "success" in state) formRef.current?.reset();
  }, [state]);

  const todo = tasks.filter((x) => !x.done);
  const done = tasks.filter((x) => x.done);

  return (
    <section className="glass-card p-5" aria-busy={pending || adding}>
      <header className="mb-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-[var(--ink)]">{fmt(w.drawerTitle, { name: sub.label })}</h2>
          <span className="text-xs text-[var(--ink-dim)]">{todo.length ? fmt(t.workspace.sectors.openCount, { n: todo.length }) : w.nothingInProgress}</span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
          {fmt(w.drawerIntro, { name: sub.label })}
        </p>
      </header>

      <form
        ref={formRef}
        // A bare date would land at UTC midnight, the evening before in Ottawa; pin it to
        // the end of the chosen day instead.
        action={(fd) => {
          const day = fd.get("day");
          if (day) fd.set("dueDate", `${day}T23:59:00`);
          return formAction(fd);
        }}
        className="mb-4 flex items-center gap-2"
      >
        <input type="hidden" name="category" value={`${areaKey}:${sub.key}`} />
        {isProject && <input type="hidden" name="projectId" value={sub.key} />}
        <input
          name="title"
          required
          placeholder={fmt(w.addIn, { name: sub.label })}
          className="glass-pill focus-ring min-w-0 flex-1 px-4 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
        />
        <input
          name="day"
          type="date"
          aria-label={w.dueOptional}
          className="glass-pill focus-ring hidden w-36 px-3 py-2.5 text-xs text-[var(--ink-dim)] [color-scheme:dark] sm:block"
        />
        <button type="submit" disabled={adding} aria-label={w.addTask} className="lm focus-ring h-10 w-10 shrink-0 disabled:opacity-50">
          <LiquidLayers>
            <Plus size={16} />
          </LiquidLayers>
        </button>
      </form>
      {state && "error" in state && <p role="alert" className="-mt-2 mb-3 rounded-xl bg-[rgba(220,60,40,0.18)] px-3 py-2 text-xs text-[#ffd9cf]">{state.error}</p>}

      {tasks.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--ink-faint)]">{fmt(w.empty, { name: sub.label })}</p>
      ) : (
        <ul className="space-y-2">
          {[...todo, ...done].map((task) => (
            <li key={task.id} className={`tile flex items-center gap-3 px-3.5 py-2.5 ${task.done ? "opacity-55" : ""}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked={task.done}
                aria-label={fmt(task.done ? t.today.reopenTask : t.today.completeTask, { title: task.title })}
                disabled={pending}
                onClick={() => startTransition(() => toggleTaskStatusAction(task.id))}
                className="check focus-ring"
                data-checked={task.done || undefined}
              >
                {task.done && <Check size={12} strokeWidth={3} />}
              </button>
              <span className={`min-w-0 flex-1 text-sm text-[var(--ink)] ${task.done ? "line-through" : ""}`}>{task.title}</span>
              {task.due && <span className="shrink-0 text-xs text-[var(--ink-dim)]">{dueLabel(task.due, locale)}</span>}
              <button
                type="button"
                aria-label={fmt(w.deleteNamed, { title: task.title })}
                disabled={pending}
                onClick={() => startTransition(() => deleteTaskAction(task.id))}
                className="focus-ring rounded-full p-1 text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
