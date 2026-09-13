import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { CourseForm } from "@/components/courses/CourseForm";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const course = await prisma.course.findFirst({
    where: { id, userId: user.id },
  });

  if (!course) notFound();

  return (
    <>
      <PageHeader title={`Edit ${course.code}`} description="Update course details." />
      <Card>
        <CardBody>
          <CourseForm course={course} />
        </CardBody>
      </Card>
    </>
  );
}
