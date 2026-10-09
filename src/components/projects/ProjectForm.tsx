"use client";

import { label } from "@/lib/labels";
import { useActionState } from "react";
import { createProjectAction, updateProjectAction } from "@/server/actions/project.actions";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

const STATUSES = ["NotStarted", "InProgress", "Completed"];

type Course = { id: string; code: string; name: string };
type Project = {
  id: string; title: string; description: string | null; courseId: string | null;
  status: string; dueDate: Date | null; progress: number;
};

export function ProjectForm({ courses, project }: { courses: Course[]; project?: Project }) {
  const action = project ? updateProjectAction : createProjectAction;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {project && <input type="hidden" name="projectId" value={project.id} />}

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <Field label="Titre" htmlFor="projTitle">
        <Input id="projTitle" name="title" placeholder="Projet de fin d'études" defaultValue={project?.title ?? ""} required />
      </Field>

      <Field label="Description" htmlFor="projDesc">
        <Textarea id="projDesc" name="description" rows={2} placeholder="De quoi parle ce projet ?" defaultValue={project?.description ?? ""} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Cours" htmlFor="projCourse">
          <Select id="projCourse" name="courseId" defaultValue={project?.courseId ?? ""}>
            <option value="">Aucun cours</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </Select>
        </Field>
        <Field label="Échéance" htmlFor="projDue">
          <Input id="projDue" name="dueDate" type="date" defaultValue={project?.dueDate ? new Date(project.dueDate).toISOString().split("T")[0] : ""} />
        </Field>
      </div>

      {project && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Statut" htmlFor="projStatus">
            <Select id="projStatus" name="status" defaultValue={project.status}>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </Select>
          </Field>
          <Field label="Avancement (%)" htmlFor="projProgress">
            <Input id="projProgress" name="progress" type="number" min="0" max="100" defaultValue={project.progress} />
          </Field>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : project ? "Enregistrer" : "Créer le projet"}
        </Button>
      </div>
    </form>
  );
}
