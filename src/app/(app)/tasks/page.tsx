import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" description="All your tasks across courses and projects." />
      <EmptyState
        title="No tasks yet"
        description="Create tasks to track your work."
      />
    </>
  );
}
