import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { CourseForm } from "@/components/courses/CourseForm";

export default function NewCoursePage() {
  return (
    <>
      <PageHeader title="Nouveau cours" description="Ajoute un cours à ta session." />
      <Card>
        <CardBody>
          <CourseForm />
        </CardBody>
      </Card>
    </>
  );
}
