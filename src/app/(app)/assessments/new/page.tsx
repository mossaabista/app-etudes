import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { AssessmentForm } from "@/components/assessments/AssessmentForm";

export default async function NewAssessmentPage() {
  const user = await requireUser();
  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <PageHeader title="Add Assessment" description="Create a new assignment, quiz, or exam." />
      <Card>
        <CardBody>
          <AssessmentForm courses={courses} />
        </CardBody>
      </Card>
    </>
  );
}
