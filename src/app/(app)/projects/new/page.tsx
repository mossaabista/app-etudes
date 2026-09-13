import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { ProjectForm } from "@/components/projects/ProjectForm";

export default async function NewProjectPage() {
  const user = await requireUser();
  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <PageHeader title="New Project" description="Create a project to track work and milestones." />
      <Card>
        <CardBody>
          <ProjectForm courses={courses} />
        </CardBody>
      </Card>
    </>
  );
}
