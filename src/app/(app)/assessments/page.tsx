import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AssessmentsPage() {
  return (
    <>
      <PageHeader title="Assessments" description="All assignments, quizzes, exams, and projects across your courses." />
      <EmptyState
        title="No assessments yet"
        description="Import a syllabus to automatically extract your evaluations."
      />
    </>
  );
}
