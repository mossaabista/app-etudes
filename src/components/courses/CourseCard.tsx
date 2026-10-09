import Link from "next/link";
import { getMessages } from "@/i18n/server";
import { fmt } from "@/i18n/config";

type CourseWithCounts = {
  id: string;
  code: string;
  name: string;
  professor: string | null;
  room: string | null;
  color: string;
  term: string | null;
  _count: { assessments: number; tasks: number; schedules: number };
};

export async function CourseCard({ course }: { course: CourseWithCounts }) {
  const a = (await getMessages()).academics;
  const n = course._count;
  return (
    <Link href={`/courses/${course.id}`} className="glass-card focus-ring group block overflow-hidden transition-transform hover:-translate-y-0.5">
      <div className="h-1.5" style={{ backgroundColor: course.color }} />
      <div className="p-4">
        <span className="inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: course.color }}>
          {course.code}
        </span>
        <h3 className="mt-2 text-sm font-semibold text-[var(--ink)]">{course.name}</h3>

        {course.professor && <p className="mt-1.5 text-xs text-[var(--ink-dim)]">{course.professor}</p>}

        <div className="mt-3 flex gap-3 text-xs text-[var(--ink-faint)]">
          <span>{fmt(n.assessments === 1 ? a.assessmentsOne : a.assessmentsMany, { n: n.assessments })}</span>
          <span>{fmt(n.tasks === 1 ? a.tasksOne : a.tasksMany, { n: n.tasks })}</span>
        </div>
      </div>
    </Link>
  );
}
