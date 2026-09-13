import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { CourseCard } from "@/components/courses/CourseCard";

export default async function CoursesPage() {
  const user = await requireUser();

  const courses = await prisma.course.findMany({
    where: { userId: user.id },
    include: { _count: { select: { assessments: true, tasks: true, schedules: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Courses"
        description="Manage your courses for this semester."
        action={<ButtonLink href="/courses/new" size="sm">+ Add Course</ButtonLink>}
      />
      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Add your courses to start organizing your semester."
          action={<ButtonLink href="/courses/new" size="sm">+ Add Course</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </>
  );
}
