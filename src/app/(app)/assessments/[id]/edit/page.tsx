import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { AssessmentForm } from "@/components/assessments/AssessmentForm";
import { getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getMessages()).academics.editAssessmentMeta };
}

export default async function EditAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [assessment, courses] = await Promise.all([
    prisma.assessment.findFirst({ where: { id, userId: user.id } }),
    prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  if (!assessment) notFound();
  const k = (await getMessages()).academics;

  return (
    <>
      <PageHeader title={fmt(k.editAssessmentTitle, { title: assessment.title })} description={k.editAssessmentDesc} />
      <Card>
        <CardBody>
          <AssessmentForm courses={courses} assessment={assessment} />
        </CardBody>
      </Card>
    </>
  );
}
