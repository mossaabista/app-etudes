import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { CourseForm } from "@/components/courses/CourseForm";
import { getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getMessages()).academics.editCourseMeta };
}

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const course = await prisma.course.findFirst({
    where: { id, userId: user.id },
  });

  if (!course) notFound();
  const a = (await getMessages()).academics;

  return (
    <>
      <PageHeader title={fmt(a.editCourseTitle, { code: course.code })} description={a.editCourseDesc} />
      <Card>
        <CardBody>
          <CourseForm course={course} />
        </CardBody>
      </Card>
    </>
  );
}
