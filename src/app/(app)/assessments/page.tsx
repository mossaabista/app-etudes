import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { AssessmentRow } from "@/components/assessments/AssessmentRow";
import { getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getMessages()).academics.assessmentsTitle };
}

export default async function AssessmentsPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  const user = await requireUser();
  const { course: courseFilter } = await searchParams;
  const k = (await getMessages()).academics;

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
        title={k.assessmentsTitle}
        description={k.assessmentsDesc}
        action={<ButtonLink href="/assessments/new" size="sm">{k.addAssessment}</ButtonLink>}
      />
      {assessments.length === 0 ? (
        <EmptyState
          title={k.noAssessmentsTitle}
          description={k.noAssessmentsDesc}
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <ButtonLink href="/syllabus" size="sm" variant="secondary">{k.importSyllabusCta}</ButtonLink>
              <ButtonLink href="/assessments/new" size="sm">{k.addAssessment}</ButtonLink>
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-on-gold">{fmt(k.upcomingN, { n: upcoming.length })}</h3>
              <div className="space-y-2">
                {upcoming.map((a) => <AssessmentRow key={a.id} a={a} />)}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-on-gold">{fmt(k.completedN, { n: completed.length })}</h3>
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
