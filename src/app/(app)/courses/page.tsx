import Link from "next/link";
import { ClipboardCheck, FlaskConical, Plus, RefreshCw, Upload } from "lucide-react";
import { StudyPlanner } from "@/components/courses/StudyPlanner";
import { addDays, toISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { LiquidLayers } from "@/components/ui/LiquidMetal";
import { CardDeck } from "@/components/today/CardDeck";
import { ChromeFolder } from "@/components/courses/ChromeFolder";

export default async function CoursesPage() {
  const user = await requireUser();

  const now = new Date();
  const [courses, upcoming, sync] = await Promise.all([
    prisma.course.findMany({
      where: { userId: user.id },
      include: { _count: { select: { assessments: true, tasks: true, schedules: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.assessment.findMany({
      where: { userId: user.id, status: { not: "Completed" }, dueDate: { gt: now, lt: addDays(now, 21) } },
      include: { course: { select: { code: true } } },
      orderBy: { dueDate: "asc" },
      take: 12,
    }),
    prisma.syncSource.findUnique({ where: { userId_provider: { userId: user.id, provider: "brightspace" } }, select: { lastSyncedAt: true, lastStatus: true } }),
  ]);

  return (
    <>
      <div className="glass-backdrop" aria-hidden />

      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-on-gold">
          Cours
          {courses.length > 0 && <span className="ml-2 text-sm font-normal text-on-gold">{courses.length}</span>}
        </h1>
        <Link href="/courses/new" aria-label="Ajouter un cours" className="lm focus-ring h-11 w-11 shrink-0">
          <LiquidLayers>
            <Plus size={18} />
          </LiquidLayers>
        </Link>
      </div>

      {/* Everything that used to be its own page, one tap away. */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tool href="/syllabus" icon={<Upload size={16} />} title="Syllabus" sub="Tout importer d'un coup" />
        <Tool
          href="/sync"
          icon={<RefreshCw size={16} />}
          title="Brightspace"
          sub={sync?.lastSyncedAt ? `Synchronisé le ${new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short" }).format(sync.lastSyncedAt)}` : "Relier ton calendrier"}
        />
        <Tool href="/assessments" icon={<ClipboardCheck size={16} />} title="Évaluations" sub={`${upcoming.length} dans les 3 semaines`} />
        <Tool href="/labs" icon={<FlaskConical size={16} />} title="Labos" sub="Séances et rapports" />
      </div>

      {courses.length === 0 ? (
        <div className="glass-card mx-auto max-w-md p-8 text-center">
          <p className="text-sm font-medium text-[var(--ink)]">Aucun cours pour l&apos;instant</p>
          <p className="mt-1 text-xs text-[var(--ink-dim)]">Ajoute tes cours avec le bouton + pour organiser ta session.</p>
        </div>
      ) : (
        <CardDeck
          initial={0}
          cards={courses.map((c) => ({
            key: c.id,
            label: c.name,
            node: (
              <Link
                href={`/courses/${c.id}`}
                draggable={false}
                className="folder-link focus-ring flex flex-col justify-center rounded-3xl"
              >
                <div className="folder-stage">
                  <ChromeFolder id={c.id} code={c.code} name={c.name} color={c.color} />
                </div>
                <div className="folder-shadow" aria-hidden />

                <div className="glass-pill mx-auto mt-4 flex max-w-full items-center gap-2 px-4 py-2 text-xs">
                  {c.professor && <span className="truncate text-[var(--ink)]">{c.professor}</span>}
                  {c.professor && <span className="text-[var(--ink-faint)]">·</span>}
                  <span className="shrink-0">{c._count.assessments} évaluations</span>
                  {c._count.tasks > 0 && (
                    <>
                      <span className="text-[var(--ink-faint)]">·</span>
                      <span className="shrink-0">{c._count.tasks} tâches</span>
                    </>
                  )}
                </div>
              </Link>
            ),
          }))}
        />
      )}

      {upcoming.length > 0 && (
        <div className="mx-auto mt-8 max-w-3xl">
          <StudyPlanner
            all
            title="Plan de révision global"
            targets={upcoming.map((a) => ({ id: a.id, title: a.title, type: a.type, due: toISODate(a.dueDate!), weight: a.weight, code: a.course.code }))}
          />
        </div>
      )}
    </>
  );
}

function Tool({ href, icon, title, sub }: { href: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Link href={href} className="glass-card focus-ring flex items-start gap-3 p-3.5 transition-transform hover:-translate-y-0.5">
      <span className="mt-0.5 text-[#f0cd79]">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--ink)]">{title}</span>
        <span className="block truncate text-xs text-[var(--ink-dim)]">{sub}</span>
      </span>
    </Link>
  );
}
