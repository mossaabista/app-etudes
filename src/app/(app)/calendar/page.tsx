import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" description="View your schedule, deadlines, and events." />
      <EmptyState
        title="Calendar coming soon"
        description="The calendar view will display your courses, deadlines, and events."
      />
    </>
  );
}
