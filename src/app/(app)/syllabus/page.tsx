import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { SyllabusImporter } from "@/components/syllabus/SyllabusImporter";
import { currentZone, toISODate } from "@/lib/dates";
import { getLocale, getMessages } from "@/i18n/server";
import { INTL } from "@/i18n/config";

export async function generateMetadata() {
  return { title: (await getMessages()).academics.syllabus };
}

export default async function SyllabusPage() {
  const user = await requireUser();
  const k = (await getMessages()).academics;
  const locale = await getLocale();

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
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-on-gold">{k.syllabus}</h1>
        <p className="mb-6 text-sm text-on-gold">{k.syllabusIntro}</p>

        <SyllabusImporter courses={known} />

        {syllabi.length > 0 && (
          <section className="glass-card mt-6 p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--ink)]">{k.alreadyImported}</h2>
            <ul className="space-y-2">
              {syllabi.map((s) => (
                <li key={s.id} className="tile flex items-center gap-3 px-3.5 py-2.5">
                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: s.course.color }}>
                    {s.course.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{s.fileName}</span>
                  <span className="shrink-0 text-xs text-[var(--ink-dim)]">
                    {s.parsed ? k.parsed : k.uploaded} · {new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), day: "numeric", month: "short" }).format(s.createdAt)}
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
