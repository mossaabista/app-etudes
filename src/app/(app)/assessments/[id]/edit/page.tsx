import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { AssessmentForm } from "@/components/assessments/AssessmentForm";

export default async function EditAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [assessment, courses] = await Promise.all([
    prisma.assessment.findFirst({ where: { id, userId: user.id } }),
    prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  if (!assessment) notFound();

  return (
    <>
      <PageHeader title={`Edit: ${assessment.title}`} description="Update assessment details and grade." />
      <Card>
        <CardBody>
          <AssessmentForm courses={courses} assessment={assessment} />
        </CardBody>
      </Card>
    </>
  );
}
