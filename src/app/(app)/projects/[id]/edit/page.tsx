import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { ProjectForm } from "@/components/projects/ProjectForm";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [project, courses] = await Promise.all([
    prisma.project.findFirst({ where: { id, userId: user.id } }),
    prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  if (!project) notFound();

  return (
    <>
      <PageHeader title={`Edit: ${project.title}`} />
      <Card>
        <CardBody>
          <ProjectForm courses={courses} project={project} />
        </CardBody>
      </Card>
    </>
  );
}
