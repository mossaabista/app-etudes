import { prisma } from "@/lib/db";

/** Links a form or a client call may attach to a row. Each one is a claim to check, not a fact. */
export interface Refs {
  courseId?: string | null;
  projectId?: string | null;
  assessmentId?: string | null;
  parentId?: string | null;
}

/**
 * Check that every id the client handed us points at one of the user's own rows. Without
 * this, a task or an assessment could be filed under someone else's course, which would
 * then show it on their page and show us their course. Returns an error message, or null
 * when every link given is the user's (missing links are fine).
 */
export async function checkRefs(userId: string, refs: Refs): Promise<string | null> {
  const checks: Promise<boolean>[] = [];
  const own = (n: number) => n === 1;
  if (refs.courseId) checks.push(prisma.course.count({ where: { id: refs.courseId, userId } }).then(own));
  if (refs.projectId) checks.push(prisma.project.count({ where: { id: refs.projectId, userId } }).then(own));
  if (refs.assessmentId) checks.push(prisma.assessment.count({ where: { id: refs.assessmentId, userId } }).then(own));
  if (refs.parentId) checks.push(prisma.task.count({ where: { id: refs.parentId, userId } }).then(own));
  const results = await Promise.all(checks);
  return results.every(Boolean) ? null : "Élément lié introuvable.";
}
