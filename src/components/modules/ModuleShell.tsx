"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { TaskDrawer, type AreaTask } from "@/components/tasks/AreaView";
import { MODULES } from "@/components/modules/registry";
import { Sources, type Entry, type SectionTask } from "@/components/modules/kit";
import { ProjectModule, type ProjectInfo } from "@/components/modules/sections/projects";
import { RenderImage } from "@/components/tasks/RenderImage";
import { CustomSection } from "@/components/modules/CustomSection";
import type { SubSpec } from "@/lib/layout";
import { SectionAssistant } from "@/components/modules/SectionAssistant";

/** The page behind a widget: its object, what it is for, its tools, and its tasks. */
export function ModuleShell({
  areaKey,
  areaLabel,
  subKey,
  section,
  custom,
  label,
  src,
  today,
  entries,
  related,
  tasks,
  richTasks,
  category,
  project,
}: {
  areaKey: string;
  areaLabel: string;
  subKey: string;
  /** Where the section's rows are stored ("sante:nutrition", or its own key if custom). */
  section: string;
  custom: SubSpec["custom"] | null;
  label: string;
  src: string;
  today: string;
  entries: Entry[];
  related: Record<string, Entry[]>;
  tasks: AreaTask[];
  richTasks: SectionTask[];
  category: string;
  project: ProjectInfo | null;
}) {
  const def = project || custom ? null : MODULES[section];
  const Body = def?.Component;
  const intro = project ? project.description || "Les étapes et les tâches de ce projet." : custom ? custom.intro : def?.intro;

  return (
    <>
      <div className="glass-backdrop" aria-hidden />
      <div className="area-enter mx-auto max-w-5xl">
        <div className="mb-4 flex items-center gap-3">
          <Link href={`/tasks/${areaKey}?s=${subKey}`} aria-label={`Retour à ${areaLabel}`} className="lm focus-ring h-11 w-11 shrink-0">
            <LiquidLayers>
              <ChevronLeft size={18} />
            </LiquidLayers>
          </Link>
          <p className="truncate text-xs font-medium uppercase tracking-wide text-[var(--ink-dim)]">{areaLabel}</p>
        </div>

        <header className="mb-6 flex items-center gap-4 sm:gap-6">
          <div className="relative h-28 w-28 shrink-0 sm:h-36 sm:w-36">
            <RenderImage src={src} className="mod-hero-img" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.5)] sm:text-3xl">{label}</h1>
            {intro && <p className="mt-1.5 max-w-xl text-sm leading-6 text-[var(--ink-dim)]">{intro}</p>}
          </div>
        </header>

        <SectionAssistant section={section} label={label} />

        <div className="grid gap-4 lg:grid-cols-2">
          {project ? (
            <ProjectModule project={project} />
          ) : custom ? (
            <CustomSection module={section} today={today} entries={entries} blocks={custom.blocks} />
          ) : Body ? (
            <Body module={section} today={today} entries={entries} related={related} tasks={richTasks} category={category} />
          ) : null}

          {!def?.ownsTasks && (
          <div className="lg:col-span-2">
            <TaskDrawer
              areaKey={areaKey}
              sub={{ key: subKey, label, visual: { src } }}
              isProject={!!project}
              tasks={tasks}
            />
          </div>
          )}
        </div>

        {def?.sources && <Sources items={def.sources} health={def.health} />}
      </div>
    </>
  );
}
