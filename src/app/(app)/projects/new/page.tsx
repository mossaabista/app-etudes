import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { getMessages } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getMessages()).workspace.projects.newTitle };
}

export default async function NewProjectPage() {
  const user = await requireUser();
  const w = (await getMessages()).workspace.projects;
  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <PageHeader title={w.newTitle} description={w.newIntro} />
      <Card>
        <CardBody>
          <ProjectForm courses={courses} />
        </CardBody>
      </Card>
    </>
  );
}
