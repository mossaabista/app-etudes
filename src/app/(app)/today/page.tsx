import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export default function TodayPage() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <PageHeader title="Today" description={today} />

      <div className="space-y-6">
        <Card>
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Priority</h3>
          </div>
          <CardBody>
            <EmptyState
              title="No urgent tasks"
              description="Tasks marked as High or Critical priority will appear here."
            />
          </CardBody>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Today&apos;s Schedule</h3>
          </div>
          <CardBody>
            <EmptyState
              title="No classes or events today"
              description="Add your courses to see your daily schedule."
            />
          </CardBody>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
            <Button size="sm" variant="secondary">+ Add Task</Button>
          </div>
          <CardBody>
            <EmptyState
              title="No tasks for today"
              description="Create tasks or import them from your syllabus."
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
