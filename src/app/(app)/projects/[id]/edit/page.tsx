import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [t, project] = await Promise.all([getMessages(), prisma.project.findFirst({ where: { id, userId: user.id }, select: { title: true } })]);
  return { title: project ? fmt(t.workspace.projects.editTitle, { title: project.title }) : t.nav.projects };
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [t, project, courses] = await Promise.all([
    getMessages(),
    prisma.project.findFirst({ where: { id, userId: user.id } }),
    prisma.course.findMany({ where: { userId: user.id }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
  ]);

  if (!project) notFound();

  return (
    <>
      <PageHeader title={fmt(t.workspace.projects.editTitle, { title: project.title })} />
      <Card>
        <CardBody>
          <ProjectForm courses={courses} project={project} />
        </CardBody>
      </Card>
    </>
  );
}
