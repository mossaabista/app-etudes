import { prisma } from "@/lib/db";
import { buildWorkspace, planSize, templateOf, type TemplateId, type WorkspaceFacts, type WorkspacePlan } from "@/lib/workspaces";
import { getLayout, saveLayout } from "@/server/layout";
import type { Layout } from "@/lib/layout";
import type { Undo } from "@/server/actions/capture.actions";

/** Everything a template needs to know about the user, read under their id only. */
export async function workspaceFacts(userId: string): Promise<WorkspaceFacts> {
  const [courses, projects, layout, open] = await Promise.all([
    prisma.course.findMany({
      where: { userId },
      select: { id: true, code: true, name: true, _count: { select: { syllabi: true, schedules: true } }, assessments: { where: { status: { not: "Completed" }, dueDate: { gte: new Date() } }, select: { id: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.project.findMany({ where: { userId }, select: { id: true, title: true } }),
    getLayout(userId),
    prisma.task.findMany({ where: { userId, status: { not: "Done" } }, select: { title: true } }),
  ]);
  return {
    courses: courses.map((c) => ({ id: c.id, code: c.code, name: c.name, hasSyllabus: c._count.syllabi > 0, hasSchedule: c._count.schedules > 0, upcoming: c.assessments.length })),
    projects,
    layout,
    openTasks: open.map((t) => t.title),
  };
}

export async function planWorkspace(userId: string, template: TemplateId, name: string) {
  return buildWorkspace(template, name, await workspaceFacts(userId));
}

export interface WorkspaceResult {
  plan: WorkspacePlan;
  message: string;
  undos: Undo[];
  partial: boolean;
  /** Where to look at the result. */
  href: string;
}

/**
 * Build and save a workspace, then read every created row back before reporting it. The
 * project, its milestones and its tasks are written in one transaction: all or nothing.
 * The sectors are saved after; if that fails the rows stay, and the message says so.
 */
export async function applyWorkspace(userId: string, template: TemplateId, name: string): Promise<WorkspaceResult | { error: string }> {
  const facts = await workspaceFacts(userId);
  const plan = buildWorkspace(template, name, facts);
  if ("error" in plan) return plan;
  if (!planSize(plan)) return { error: `Ton espace ${plan.title} est déjà en place : ${[...plan.reused, ...plan.skipped].join(", ")}.` };

  const courseIds = new Set(facts.courses.map((c) => c.id));
  let created: { projectId: string | null; taskIds: string[] };
  try {
    created = await prisma.$transaction(async (tx) => {
      let projectId = plan.projectId;
      if (plan.project) {
        const p = await tx.project.create({
          data: { userId, title: plan.project.title, description: plan.project.description, status: "NotStarted", milestones: { create: plan.project.milestones.map((title, i) => ({ title, sortOrder: i })) } },
        });
        projectId = p.id;
      }
      const taskIds: string[] = [];
      for (const t of plan.tasks) {
        const row = await tx.task.create({
          data: {
            userId,
            title: t.title.slice(0, 200),
            status: "ToDo",
            priority: "Medium",
            category: t.category === "project" ? (projectId ? `projets:${projectId}` : "projets:general") : t.category,
            projectId: t.category === "project" ? projectId : null,
            courseId: t.courseId && courseIds.has(t.courseId) ? t.courseId : null,
          },
        });
        taskIds.push(row.id);
      }
      return { projectId: plan.project ? projectId : null, taskIds };
    });
  } catch {
    return { error: "Je n'ai pas pu créer cet espace : rien n'a été enregistré." };
  }

  const undos: Undo[] = created.taskIds.map((id) => ({ t: "delete-task", id }));
  if (created.projectId) undos.push({ t: "delete-project", id: created.projectId });

  let layoutSaved = true;
  if (plan.areas.length) {
    const before = facts.layout;
    const next: Layout = JSON.parse(JSON.stringify(before));
    for (const { area, isNew } of plan.areas) {
      if (isNew) next.areas.push(area);
      else next.areas.find((a) => a.key === area.key)?.subs.push(...area.subs);
    }
    try {
      await saveLayout(userId, next);
      undos.push({ t: "layout-was", data: before });
    } catch {
      layoutSaved = false;
    }
  }

  // Verify: what was written must read back.
  const [tasksFound, projectFound] = await Promise.all([
    prisma.task.count({ where: { userId, id: { in: created.taskIds } } }),
    created.projectId ? prisma.project.count({ where: { userId, id: created.projectId } }) : Promise.resolve(1),
  ]);
  const verified = tasksFound === created.taskIds.length && projectFound === 1;

  const parts: string[] = [];
  if (created.projectId) parts.push(`le projet « ${plan.project!.title} » et ses ${plan.project!.milestones.length} jalons`);
  for (const { area, isNew } of plan.areas) if (layoutSaved) parts.push(isNew ? `le secteur ${area.label} (${area.subs.map((s) => s.label).join(", ")})` : `${area.subs.map((s) => s.label).join(", ")} dans ${area.label}`);
  if (created.taskIds.length) parts.push(`${created.taskIds.length} tâche${created.taskIds.length > 1 ? "s" : ""} pour démarrer`);
  const failures: string[] = [];
  if (!layoutSaved) failures.push("je n'ai pas pu enregistrer les secteurs");
  if (!verified) failures.push("certains éléments créés ne se relisent pas");

  const firstArea = plan.areas[0]?.area.key;
  const href = created.projectId || plan.projectId ? `/tasks/projets/${created.projectId ?? plan.projectId}` : firstArea ? `/tasks/${firstArea}` : "/tasks";
  const message =
    `Espace ${plan.title} prêt (modèle ${templateOf(template)!.label} v${plan.version}) : ${parts.join(", ") || "rien de nouveau"}.` +
    (plan.reused.length ? ` Repris tel quel : ${plan.reused.join(", ")}.` : "") +
    (plan.notes.length ? ` ${plan.notes.join(" ")}` : "") +
    (failures.length ? ` Attention : ${failures.join(" ; ")}.` : "");
  return { plan, message, undos, partial: failures.length > 0, href };
}
