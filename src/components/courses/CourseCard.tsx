import Link from "next/link";

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

export function CourseCard({ course }: { course: CourseWithCounts }) {
  return (
    <Link
      href={`/courses/${course.id}`}
      className="group block rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="h-2 rounded-t-lg" style={{ backgroundColor: course.color }} />
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <span
              className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: course.color }}
            >
              {course.code}
            </span>
            <h3 className="mt-2 text-sm font-semibold text-slate-900 group-hover:text-slate-700">
              {course.name}
            </h3>
          </div>
        </div>

        {course.professor && (
          <p className="mt-1.5 text-xs text-slate-500">{course.professor}</p>
        )}

        <div className="mt-3 flex gap-3 text-xs text-slate-400">
          <span>{course._count.assessments} assessments</span>
          <span>{course._count.tasks} tasks</span>
        </div>
      </div>
    </Link>
  );
}
