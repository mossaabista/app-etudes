"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Block, Meter, Stats, dayLabel } from "@/components/modules/kit";

export interface ProjectInfo {
  id: string;
  title: string;
  description: string | null;
  progress: number;
  dueDate: string | null;
  status: string;
}

const STATUS: Record<string, string> = { NotStarted: "Pas commencé", InProgress: "En cours", Completed: "Terminé" };

/** A project's section: where it stands, and the way into its full page. */
export function ProjectModule({ project }: { project: ProjectInfo }) {
  return (
    <Block
      title="Avancement"
      action={
        <Link href={`/projects/${project.id}`} className="mod-chip focus-ring">
          Ouvrir le projet <ArrowRight size={13} />
        </Link>
      }
      wide
    >
      <Stats
        items={[
          { label: "Progression", value: `${project.progress} %`, tone: "gold" },
          { label: "Statut", value: STATUS[project.status] ?? project.status },
          { label: "Échéance", value: project.dueDate ? dayLabel(project.dueDate, { day: "numeric", month: "long" }) : "—" },
        ]}
      />
      <div className="mt-4">
        <Meter value={project.progress} max={100} />
      </div>
    </Block>
  );
}
