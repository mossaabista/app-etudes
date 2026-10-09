import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { CardDeck } from "@/components/today/CardDeck";
import { ChromeFolder } from "@/components/courses/ChromeFolder";
import { OpeningFolder } from "@/components/tasks/OpeningFolder";
import { FolderBurst } from "@/components/tasks/FolderBurst";
import { InboxPanel, type CategoryGroup } from "@/components/tasks/InboxPanel";
import { getLayout } from "@/server/layout";
import { imageSrc } from "@/lib/layout";
import { LayoutEditor } from "@/components/tasks/LayoutEditor";
import { BalanceWheel, type BalanceArea } from "@/components/tasks/BalanceWheel";
import { startOfWeek } from "@/lib/dates";

// What to suggest when an area has had little attention this week.
const NUDGES: Record<string, string> = {
  travail: "Bloque un créneau de concentration : le Pilote le place pour toi.",
  equipe: "Un point rapide avec l'équipe, ou une tâche à déléguer ?",
  projets: "Avance d'une étape sur un projet, même petite.",
  apprentissage: "20 minutes de lecture ou d'une formation.",
  sante: "Une séance, une nuit notée ou un verre d'eau de plus.",
  esprit: "Quelques minutes de respiration ou de gratitude.",
  social: "Appelle un proche : c'est le moment.",
  quotidien: "Une course, une facture ou une tâche de maison à régler.",
};

export default async function TasksPage() {
  const user = await requireUser();
  const layout = await getLayout(user.id);
  const AREAS = layout.areas;
  const keys = new Set(AREAS.map((a) => a.key));
  // A category names its sector by key; one that is no longer in the layout is unfiled.
  const splitCategory = (c: string | null) => {
    const [area, sub] = (c ?? "").split(":");
    return area && sub && keys.has(area) ? { area, sub } : null;
  };

  const weekStart = startOfWeek(new Date());
  const [tasks, projects, doneThisWeek, entriesThisWeek, eventsThisWeek] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, parentId: null, status: { not: "Done" } },
      select: { id: true, title: true, category: true, projectId: true, dueDate: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.project.findMany({ where: { userId: user.id }, select: { id: true, title: true }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ where: { userId: user.id, status: "Done", updatedAt: { gte: weekStart } }, select: { category: true, projectId: true } }),
    prisma.trackerEntry.groupBy({ by: ["module"], where: { userId: user.id, createdAt: { gte: weekStart }, NOT: { module: { startsWith: "app:" } } }, _count: true }),
    prisma.calendarEvent.findMany({ where: { userId: user.id, date: { gte: weekStart }, type: { startsWith: "Area:" } }, select: { type: true } }),
  ]);

  // Attention per area this week: finished tasks, recorded entries, planned blocks.
  const activity = new Map<string, number>();
  const bump = (area: string | undefined, n = 1) => area && activity.set(area, (activity.get(area) ?? 0) + n);
  for (const t of doneThisWeek) bump(splitCategory(t.category)?.area ?? (t.projectId ? "projets" : undefined));
  for (const e of entriesThisWeek) bump(e.module.split(":")[0], e._count);
  for (const e of eventsThisWeek) bump(e.type.split(":")[1]);
  // Diminishing returns: the first few actions matter most; ~10 in a week fills a spoke.
  const balance: BalanceArea[] = AREAS.map((a) => {
    const n = activity.get(a.key) ?? 0;
    return { key: a.key, label: a.label, front: a.front, color: a.color, count: n, score: Math.min(1, Math.log1p(n) / Math.log1p(10)), hint: n ? `${n} action${n > 1 ? "s" : ""} cette semaine · ${NUDGES[a.key] ?? "Continue sur ta lancée."}` : (NUDGES[a.key] ?? `Un petit pas dans ${a.label} cette semaine ?`) };
  });

  // A task belongs to an area by its category; one attached to a project but never
  // filed counts under Projets, since that is where it would be looked for.
  const areaOf = (t: (typeof tasks)[number]) => splitCategory(t.category)?.area ?? (t.projectId ? "projets" : null);
  const open = new Map<string, number>();
  const unsorted = [];
  for (const t of tasks) {
    const area = areaOf(t);
    if (area) open.set(area, (open.get(area) ?? 0) + 1);
    else unsorted.push({ id: t.id, title: t.title });
  }

  const groups: CategoryGroup[] = AREAS.map((a) => ({
    label: a.label,
    options:
      a.key === "projets" && projects.length > 0
        ? [...projects.map((p) => ({ value: `projets:${p.id}`, label: p.title })), { value: "projets:general", label: "Général" }]
        : a.subs.map((s) => ({ value: `${a.key}:${s.key}`, label: s.label })),
  }));

  return (
    <>
      <div className="glass-backdrop" aria-hidden />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--ink)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.5)]">
            Secteurs
            {tasks.length > 0 && <span className="ml-2 text-sm font-normal text-[rgba(255,246,227,0.85)]">{tasks.length} à faire</span>}
          </h1>
          <p className="text-xs text-[rgba(255,246,227,0.8)]">Les domaines de ta vie. Ajoute, retire ou crée les tiens — à la main ou au micro.</p>
        </div>
        <LayoutEditor layout={layout} />
      </div>

      {AREAS.length >= 3 && <BalanceWheel areas={balance} />}

      <CardDeck
        initial={0}
        cards={AREAS.map((a) => {
          const sections = a.key === "projets" && projects.length > 0 ? projects.length : a.subs.length;
          const count = open.get(a.key) ?? 0;
          return {
            key: a.key,
            label: a.label,
            node: (
              <OpeningFolder href={`/tasks/${a.key}`} className="folder-link focus-ring flex flex-col justify-center rounded-3xl">
                <div className="folder-stage">
                  <ChromeFolder
                    id={a.key}
                    code={a.front}
                    name={a.label !== a.front ? a.label : a.blurb}
                    color={a.color}
                    inside={<FolderBurst images={a.subs.map((s) => imageSrc(s.image))} />}
                  />
                </div>
                <div className="folder-shadow" aria-hidden />

                <div className="folder-meta glass-pill mx-auto mt-4 flex max-w-full items-center gap-2 px-4 py-2 text-xs">
                  <span className={count ? "text-[var(--ink)]" : ""}>{count ? `${count} à faire` : "Rien à faire"}</span>
                  <span className="text-[var(--ink-faint)]">·</span>
                  <span className="shrink-0">
                    {sections} {a.key === "projets" && projects.length > 0 ? "projets" : "sections"}
                  </span>
                </div>
              </OpeningFolder>
            ),
          };
        })}
      />

      {unsorted.length > 0 && (
        <div className="mx-auto mt-8 max-w-2xl">
          <InboxPanel tasks={unsorted} groups={groups} />
        </div>
      )}
    </>
  );
}
