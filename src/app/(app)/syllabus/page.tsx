import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SyllabusPage() {
  return (
    <>
      <PageHeader title="Syllabus" description="Upload and manage your course syllabi." />
      <EmptyState
        title="No syllabi uploaded"
        description="Upload your course syllabi (PDF) to automatically extract assessments, deadlines, and schedules."
      />
    </>
  );
}
