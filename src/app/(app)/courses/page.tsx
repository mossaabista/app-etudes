import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export default function CoursesPage() {
  return (
    <>
      <PageHeader
        title="Courses"
        description="Manage your courses for this semester."
        action={<ButtonLink href="/courses" size="sm">+ Add Course</ButtonLink>}
      />
      <EmptyState
        title="No courses yet"
        description="Add your courses to start organizing your semester."
      />
    </>
  );
}
