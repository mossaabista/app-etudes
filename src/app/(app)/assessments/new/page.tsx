import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { AssessmentForm } from "@/components/assessments/AssessmentForm";
import { getMessages } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).academics.newAssessmentTitle };
}

export default async function NewAssessmentPage() {
  const user = await requireUser();
  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  const k = (await getMessages()).academics;

  return (
    <>
      <PageHeader title={k.newAssessmentTitle} description={k.newAssessmentDesc} />
      <Card>
        <CardBody>
          <AssessmentForm courses={courses} />
        </CardBody>
      </Card>
    </>
  );
}
