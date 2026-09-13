import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { AssessmentRow } from "@/components/assessments/AssessmentRow";

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const user = await requireUser();
  const { course: courseFilter } = await searchParams;

  const where: Record<string, unknown> = { userId: user.id };
  if (courseFilter) where.courseId = courseFilter;

  const assessments = await prisma.assessment.findMany({
    where,
    include: { course: { select: { code: true, color: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const upcoming = assessments.filter((a) => a.status !== "Completed");
  const completed = assessments.filter((a) => a.status === "Completed");

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Track your assignments, quizzes, and exams."
        action={<ButtonLink href="/assessments/new" size="sm">+ Add Assessment</ButtonLink>}
      />
      {assessments.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="Add your assignments, quizzes, and exams to track deadlines and grades."
          action={<ButtonLink href="/assessments/new" size="sm">+ Add Assessment</ButtonLink>}
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Upcoming ({upcoming.length})</h3>
              <div className="space-y-2">
                {upcoming.map((a) => <AssessmentRow key={a.id} a={a} />)}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Completed ({completed.length})</h3>
              <div className="space-y-2">
                {completed.map((a) => <AssessmentRow key={a.id} a={a} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
