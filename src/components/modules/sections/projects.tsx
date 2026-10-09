"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Block, Meter, Stats, useModuleText } from "@/components/modules/kit";
import { labelIn } from "@/lib/labels";

export interface ProjectInfo {
  id: string;
  title: string;
  description: string | null;
  progress: number;
  dueDate: string | null;
  status: string;
}

/** A project's section: where it stands, and the way into its full page. */
export function ProjectModule({ project }: { project: ProjectInfo }) {
  const { t, locale, day, pct } = useModuleText();
  const p = t.modulesB.project;
  return (
    <Block
      title={p.progressTitle}
      action={
        <Link href={`/projects/${project.id}`} className="mod-chip focus-ring">
          {p.open} <ArrowRight size={13} />
        </Link>
      }
      wide
    >
      <Stats
        items={[
          { label: p.progress, value: pct(project.progress), tone: "gold" },
          { label: p.status, value: labelIn(project.status, locale) },
          { label: p.due, value: project.dueDate ? day(project.dueDate, { day: "numeric", month: "long" }) : "—" },
        ]}
      />
      <div className="mt-4">
        <Meter value={project.progress} max={100} />
      </div>
    </Block>
  );
}
