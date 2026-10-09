import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { SyllabusImporter } from "@/components/syllabus/SyllabusImporter";
import { toISODate } from "@/lib/dates";

export default async function SyllabusPage() {
  const user = await requireUser();

  const [syllabi, courses] = await Promise.all([
    prisma.syllabus.findMany({
      where: { userId: user.id },
      include: { course: { select: { code: true, name: true, color: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({
      where: { userId: user.id },
      select: { id: true, code: true, name: true, assessments: { select: { title: true, dueDate: true } } },
      orderBy: { code: "asc" },
    }),
  ]);
  // What each course already has, so the review can point out what would be a duplicate.
  const known = courses.map((c) => ({ id: c.id, code: c.code, name: c.name, assessments: c.assessments.map((a) => ({ title: a.title, date: a.dueDate ? toISODate(a.dueDate) : null })) }));

  return (
    <>
      <div className="glass-backdrop" aria-hidden />
      <div className="area-enter mx-auto max-w-4xl">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[var(--ink)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.5)]">Syllabus</h1>
        <p className="mb-6 text-sm text-[rgba(255,246,227,0.88)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.6)]">Un PDF, un document Word ou une photo du plan de cours : tu vérifies, puis toute ta session est planifiée.</p>

        <SyllabusImporter courses={known} />

        {syllabi.length > 0 && (
          <section className="glass-card mt-6 p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">Déjà importés</h2>
            <ul className="space-y-2">
              {syllabi.map((s) => (
                <li key={s.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: s.course.color }}>
                    {s.course.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{s.fileName}</span>
                  <span className="shrink-0 text-xs text-[var(--ink-dim)]">
                    {s.parsed ? "Analysé" : "Déposé"} · {new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
