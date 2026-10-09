import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { CourseForm } from "@/components/courses/CourseForm";
import { getMessages } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).academics.newCourseTitle };
}

export default async function NewCoursePage() {
  const a = (await getMessages()).academics;
  return (
    <>
      <PageHeader title={a.newCourseTitle} description={a.newCourseDesc} />
      <Card>
        <CardBody>
          <CourseForm />
        </CardBody>
      </Card>
    </>
  );
}
