import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProjectsPage() {
  return (
    <>
      <PageHeader title="Projects" description="Manage your group projects and individual work." />
      <EmptyState
        title="No projects yet"
        description="Create a project to start tracking deliverables, milestones, and team members."
      />
    </>
  );
}
