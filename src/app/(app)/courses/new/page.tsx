import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { CourseForm } from "@/components/courses/CourseForm";

export default function NewCoursePage() {
  return (
    <>
      <PageHeader title="Add Course" description="Create a new course for this semester." />
      <Card>
        <CardBody>
          <CourseForm />
        </CardBody>
      </Card>
    </>
  );
}
