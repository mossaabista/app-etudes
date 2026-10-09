import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { getProfile } from "@/server/profile";
import { DateNav, type Range } from "@/components/today/DateNav";
import { AddEvent } from "@/components/today/AddEvent";
import { CardDeck } from "@/components/today/CardDeck";
import { DeleteEvent } from "@/components/today/DeleteEvent";
import { TaskCheck } from "@/components/today/TaskCheck";
import { PilotPanel } from "@/components/today/PilotPanel";
import { getPlanningPrefs } from "@/server/planning-prefs";
import { RadarPanel } from "@/components/today/RadarPanel";
import { riskRadar } from "@/server/radar";
import { PILOT_NOTE } from "@/server/pilot";
import { areaOfTag } from "@/lib/task-areas";
import { CARDS, type TodayCard } from "@/lib/profile";
import { label as frLabel } from "@/lib/labels";
import {
  APP_TIMEZONE,
  addDays,
  addMonths,
  dayName,
  fromISODate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toISODate,
  wallTimeToUtc,
} from "@/lib/dates";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Kind = "deadline" | "course" | "perso" | "section";

interface Item {
  key: string;
  kind: Kind;
  at: Date | null;
  time: string;
  end?: string;
  title: string;
  sub?: string;
  color?: string;
  eventId?: string;
  taskId?: string;
  /** Before "now" on today's timeline. */
  past?: boolean;
}

/** Sections whose rows are life, not school or work: they go to Perso, never to "À rendre". */
const LIFE = new Set(["sante", "esprit", "social", "quotidien"]);

// en-GB rather than fr-CA: the French locale renders "16 h 00", which would not line up
// with the "16:00" the timetable stores as plain strings.
const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(d);

/** "Santé · Sport" for an "area:sub" category or an "Area:area:sub" event type. */
const sectionLabel = (tag: string | null | undefined) => {
  const a = areaOfTag(tag);
  return a ? `${a.area.front}${a.sub ? ` · ${a.sub.label}` : ""}` : null;
};

const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PRAYER_NAMES: Record<string, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const HYGIENE: Record<string, string> = { "brush-am": "Brossage du matin", "brush-pm": "Brossage du soir", floss: "Fil dentaire", shower: "Douche", skin: "Soin et écran solaire", hands: "Mains avant les repas" };

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; r?: string; cartes?: string }>;
}) {
  const user = await requireUser();
  const [profile, planningPrefs, radar] = await Promise.all([getProfile(user.id), getPlanningPrefs(user.id), riskRadar(user.id)]);
  // A brand-new account sets itself up first.
  if (!profile) redirect("/onboarding");
  const params = await searchParams;

  const range: Range = params.r === "week" || params.r === "month" ? params.r : "day";
  const anchor = (params.d ? fromISODate(params.d) : null) ?? startOfDay(new Date());

  const from = range === "day" ? startOfDay(anchor) : range === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
  const to = range === "day" ? addDays(from, 1) : range === "week" ? addDays(from, 7) : addMonths(from, 1);

  const window = { gte: from, lt: to };
  const scheduleDays = range === "day" ? [dayName(anchor)] : WEEKDAYS;
  // Development only: ?cartes=team,training previews other cards without saving anything.
  const preview =
    process.env.NODE_ENV !== "production" && params.cartes
      ? params.cartes.split(",").filter((c): c is TodayCard => CARDS.some((x) => x.key === c))
      : [];
  const shown = preview.length ? preview : profile.cards;
  const wants = (c: TodayCard) => shown.includes(c);
  // Today shows the chosen day (or week, or month) and nothing beyond it.
  const dueWindow = window;

  const [assessments, labs, tasks, events, schedules, entries] = await Promise.all([
    prisma.assessment.findMany({
      where: { userId: user.id, status: { not: "Completed" }, dueDate: dueWindow },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.labSession.findMany({
      where: { userId: user.id, status: { notIn: ["Completed", "Submitted"] }, dueDate: dueWindow },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: user.id, parentId: null, status: { not: "Done" }, dueDate: dueWindow },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { userId: user.id, date: window },
      orderBy: { date: "asc" },
    }),
    prisma.courseSchedule.findMany({
      where: { course: { userId: user.id }, day: { in: scheduleDays } },
      include: { course: { select: { code: true, color: true, name: true } } },
      orderBy: { startTime: "asc" },
    }),
    // Only the section rows the chosen cards read.
    wants("team") || wants("training") || wants("nutrition") || wants("routines")
      ? prisma.trackerEntry.findMany({
          where: {
            userId: user.id,
            OR: [
              { module: "equipe:delegue", kind: "delegated", done: false },
              { module: "sante:sport", kind: "workout", date: window },
              { module: { in: ["sante:nutrition", "esprit:priere", "sante:hygiene"] }, date: window },
              { module: "sante:nutrition", kind: "plan" },
            ],
          },
          orderBy: { date: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const inDay = (d: Date | null) => !!d && d >= from && d < to;
  // A sentence captured before the fix could leave a task and an event with the same
  // name on the same day: the event wins, the task is not shown twice.
  const eventKeys = new Set(events.map((e) => `${e.title.toLowerCase()}|${toISODate(e.date)}`));
  const visibleTasks = tasks.filter((t) => !t.dueDate || !eventKeys.has(`${t.title.toLowerCase()}|${toISODate(t.dueDate)}`));
  // Something to hand in: a course task, an old uncategorised one, a deliverable or a project.
  const deliverable = (t: (typeof tasks)[number]) =>
    !!t.course || !t.category || t.category === "travail:livrables" || t.category.startsWith("projets:");

  const dueTime = (d: Date | null) => (d ? (hhmm(d) === "23:59" ? "—" : hhmm(d)) : "—");

  const taskItem = (t: (typeof tasks)[number]): Item => {
    const section = sectionLabel(t.category);
    return {
      key: `t${t.id}`,
      kind: "deadline",
      at: t.dueDate,
      time: dueTime(t.dueDate),
      title: t.title,
      sub: t.course ? `${t.course.code} · Tâche` : section ?? "Tâche",
      color: t.course?.color ?? areaOfTag(t.category)?.area.color,
      taskId: t.id,
    };
  };

  const deadlines: Item[] = [
    ...assessments.map((a) => ({
      key: `a${a.id}`, kind: "deadline" as const, at: a.dueDate, time: a.dueDate ? hhmm(a.dueDate) : "—",
      title: a.title, sub: `${a.course.code} · ${frLabel(a.type)}${a.weight != null ? ` · ${String(a.weight).replace(".", ",")} %` : ""}`,
      color: a.course.color,
    })),
    ...labs.map((l) => ({
      key: `l${l.id}`, kind: "deadline" as const, at: l.dueDate, time: l.dueDate ? hhmm(l.dueDate) : "—",
      title: l.title, sub: `${l.course.code} · Laboratoire`, color: l.course.color,
    })),
    ...visibleTasks.filter(deliverable).map(taskItem),
  ]
    .sort(byTime);
  // To-dos of the period that are not hand-ins: work and school ones go to "À faire",
  // life ones (sport, family, errands) to "Perso".
  const isLifeTask = (t: (typeof tasks)[number]) => LIFE.has(t.category?.split(":")[0] ?? "");
  const todos = visibleTasks.filter((t) => !deliverable(t) && (inDay(t.dueDate) || !t.dueDate));
  const workTasks = todos.filter((t) => !isLifeTask(t)).map(taskItem);
  const lifeTasks = todos.filter(isLifeTask).map(taskItem);

  // Schedule rows store wall-clock strings, so they only become instants once pinned
  // to a date. In day view that is the anchor; in week view, the matching weekday.
  const courseItems: Item[] = schedules
    .map((s) => {
      const base = range === "day" ? anchor : addDays(from, Math.max(WEEKDAYS.indexOf(s.day), 0));
      const [h, m] = s.startTime.split(":").map(Number);
      const p = toISODate(base).split("-").map(Number);
      return {
        key: `s${s.id}`,
        kind: "course" as const,
        at: range === "month" ? null : wallTimeToUtc([p[0], p[1], p[2], h, m, 0]),
        time: s.startTime,
        end: s.endTime,
        title: s.course.code,
        sub: `${frLabel(s.type)}${s.room ? ` · ${s.room}` : ""}${range !== "day" ? ` · ${frenchDay(s.day)}` : ""}`,
        color: s.course.color,
      };
    })
    .sort(byTime);

  // Events: anything planned from a section carries that section's colour.
  const eventItem = (e: (typeof events)[number]): Item => {
    const tagged = areaOfTag(e.type);
    const [h, m] = (e.startTime ?? "00:00").split(":").map(Number);
    const p = toISODate(e.date).split("-").map(Number);
    return {
      key: `e${e.id}`,
      kind: tagged ? "section" : "perso",
      at: e.startTime ? wallTimeToUtc([p[0], p[1], p[2], h, m, 0]) : e.date,
      time: e.startTime ?? "—",
      end: e.endTime ?? undefined,
      title: e.title,
      sub: [sectionLabel(e.type), e.notes === PILOT_NOTE ? "Pilote" : e.notes].filter(Boolean).join(" · ") || undefined,
      color: tagged?.area.color,
      eventId: e.id,
    };
  };
  const agendaItems = events.map(eventItem).sort(byTime);
  // "À faire" holds everything there is to do that day: tasks, sport, calls, appointments
  // and the Pilot's blocks. A thing only leaves it when the deck has a card of its own for
  // it (Réunions, Entraînement, or a separate Perso).
  const kindOf = (e: (typeof events)[number]): "pilot" | "meeting" | "sport" | "life" | "work" => {
    if (e.notes === PILOT_NOTE) return "pilot";
    const tag = areaOfTag(e.type);
    if (!tag) return e.type === "Meeting" ? "meeting" : "life";
    if (tag.sub?.key === "reunions") return "meeting";
    if (e.type === "Area:sante:sport") return "sport";
    return LIFE.has(tag.area.key) ? "life" : "work";
  };
  const ownCard = (k: ReturnType<typeof kindOf>) =>
    (k === "meeting" && shown.includes("reunions")) || (k === "sport" && shown.includes("training")) || ((k === "life" || k === "sport") && shown.includes("perso"));
  const meetingItems = events.filter((e) => kindOf(e) === "meeting").map(eventItem).sort(byTime);
  const personalItems = [...events.filter((e) => ["life", "sport"].includes(kindOf(e))).map(eventItem), ...lifeTasks].sort(byTime);
  const taskItems = [
    ...workTasks,
    ...(shown.includes("perso") ? [] : lifeTasks),
    ...events.filter((e) => !ownCard(kindOf(e))).map(eventItem),
  ].sort(byTime);
  const pilotBlocks = events.filter((e) => e.notes === PILOT_NOTE).length;

  const trainingItems: Item[] = [
    ...events.filter((e) => e.type === "Area:sante:sport").map(eventItem),
    ...entries
      .filter((e) => e.module === "sante:sport" && e.kind === "workout")
      .map((w) => ({ key: `w${w.id}`, kind: "section" as const, at: w.date, time: "✓", title: w.text ?? "Séance", sub: `Fait · ${w.value ?? 0} min`, color: "#ef4444" })),
  ].sort(byTime);

  const teamItems: Item[] = entries
    .filter((e) => e.module === "equipe:delegue")
    .map((d) => {
      const data = (d.data ?? {}) as { to?: string };
      return { key: `d${d.id}`, kind: "section" as const, at: d.date, time: d.date < from ? "Retard" : hhmm(d.date) === "12:00" ? "—" : hhmm(d.date), title: d.text ?? "Tâche", sub: `${data.to ?? "—"} · pour le ${dayLabel(d.date)}`, color: "#14b8a6" };
    })
    .sort(byTime);

  const todayIso = toISODate(range === "day" ? anchor : new Date());
  const water = entries.find((e) => e.module === "sante:nutrition" && e.kind === "water" && toISODate(e.date) === todayIso)?.value ?? 0;
  const meals = entries.filter((e) => e.module === "sante:nutrition" && e.kind === "meal" && toISODate(e.date) === todayIso);
  const plan = entries.find((e) => e.module === "sante:nutrition" && e.kind === "plan");
  const target = (plan?.data as { kcal?: number } | null)?.kcal;
  const checks = entries.filter((e) => e.kind === "check" && toISODate(e.date) === todayIso);
  const ticked = (module: string, key: string) => checks.some((c) => c.module === module && (c.data as { item?: string } | null)?.item === key);

  // The overview: everything of the day in one list — classes, hand-ins, to-dos, life.
  const isTodayView = range === "day" && toISODate(anchor) === toISODate(new Date());
  const now = new Date();
  const timeline = [...deadlines.filter((d) => inDay(d.at)), ...courseItems, ...agendaItems, ...workTasks, ...lifeTasks]
    .sort(byTime)
    .map((i) => (isTodayView && i.at && endsAt(i) < now && i.kind !== "deadline" ? { ...i, past: true } : i));
  const nextUp = isTodayView ? timeline.find((i) => !i.past && i.at && i.at >= now && i.time !== "—") : undefined;
  const isoAnchor = toISODate(range === "day" ? anchor : from);

  const label =
    range === "day"
      ? capitalise(dayLabel(anchor))
      : range === "week"
        ? `Semaine du ${dayLabel(from)}`
        : capitalise(new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, month: "long", year: "numeric" }).format(from));
  const when = range === "day" ? "ce jour-là" : "sur cette période";

  const nodes: Record<TodayCard, React.ReactNode> = {
    journee: (
      <Panel title="Vue d'ensemble" count={timeline.length} action={<AddEvent isoDate={isoAnchor} />}>
        {nextUp && (
          <div className="next-up">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#f0cd79]">Ensuite · {untilLabel(nextUp.at!, now)}</span>
            <span className="truncate text-sm font-semibold text-[var(--ink)]">{nextUp.title}</span>
          </div>
        )}
        {timeline.length === 0 ? (
          <Empty>Journée libre. Touche « Planifier ma journée » pour que le Pilote la remplisse.</Empty>
        ) : range === "day" ? (
          timeline.map((i, n) => (
            <div key={i.key}>
              {isTodayView && !i.past && (n === 0 || timeline[n - 1].past) && n > 0 && <NowLine at={now} />}
              <Row item={i} />
            </div>
          ))
        ) : (
          groupByDay(timeline).map(([iso, items]) => (
            <div key={iso} className="space-y-2">
              <p className="pt-1 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{capitalise(dayLabel(fromISODate(iso) ?? from))}</p>
              {items.map((i) => <Row key={i.key} item={i} />)}
            </div>
          ))
        )}
      </Panel>
    ),
    courses: (
      <Panel title="Cours" count={courseItems.length}>
        {courseItems.length === 0 ? <Empty>Aucun cours {range === "day" ? "ce jour-là" : "enregistré"}.</Empty> : courseItems.map((i) => <Row key={i.key} item={i} />)}
      </Panel>
    ),
    deadlines: (
      <Panel title="À rendre" count={deadlines.length}>
        {deadlines.length === 0 ? <Empty>Rien à rendre {when}.</Empty> : deadlines.map((i) => <Row key={i.key} item={i} />)}
      </Panel>
    ),
    reunions: (
      <Panel title="Réunions" count={meetingItems.length} action={<AddEvent isoDate={isoAnchor} />}>
        {meetingItems.length === 0 ? <Empty>Aucune réunion {when}.</Empty> : meetingItems.map((i) => <Row key={i.key} item={i} />)}
      </Panel>
    ),
    afaire: (
      <Panel title="À faire" count={taskItems.length}>
        {taskItems.length === 0 ? <Empty>Rien à faire {when}. Le Pilote peut y placer tes révisions.</Empty> : taskItems.map((i) => <Row key={i.key} item={i} />)}
      </Panel>
    ),
    perso: (
      <Panel title="Perso" count={personalItems.length} action={<AddEvent isoDate={isoAnchor} />}>
        {personalItems.length === 0 ? <Empty>Rien de personnel {when}. Dis « vélo demain 18h » au micro.</Empty> : personalItems.map((i) => <Row key={i.key} item={i} />)}
      </Panel>
    ),
    team: (
      <Panel title="Équipe" count={teamItems.length}>
        {teamItems.length === 0 ? <Empty>Rien de délégué en cours.</Empty> : teamItems.map((i) => <Row key={i.key} item={i} />)}
      </Panel>
    ),
    training: (
      <Panel title="Entraînement" count={trainingItems.length}>
        {trainingItems.length === 0 ? <Empty>Aucune séance prévue. Planifie-en une depuis Santé · Sport.</Empty> : trainingItems.map((i) => <Row key={i.key} item={i} />)}
      </Panel>
    ),
    nutrition: (
      <Panel title="Nutrition" count={meals.length}>
        <Stat label="Eau" value={`${((water * 250) / 1000).toFixed(2).replace(".", ",")} L`} sub="objectif 2 L" />
        {target && <Stat label="Objectif du jour" value={`${target.toLocaleString("fr-CA")} kcal`} sub="calculé dans Nutrition" />}
        {meals.length === 0 ? (
          <Empty>Aucun repas noté aujourd&apos;hui.</Empty>
        ) : (
          meals.map((m) => (
            <div key={m.id} className="tile px-3.5 py-2.5">
              <p className="text-xs uppercase tracking-wide text-[var(--ink-faint)]">{String((m.data as { slot?: string } | null)?.slot ?? "")}</p>
              <p className="text-sm text-[var(--ink)]">{m.text}</p>
            </div>
          ))
        )}
      </Panel>
    ),
    routines: (
      <Panel title="Routines" count={checks.length}>
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Prières</p>
        <div className="flex flex-wrap gap-1.5">
          {PRAYER_KEYS.map((k) => (
            <span key={k} className={`mod-chip ${ticked("esprit:priere", k) ? "" : "opacity-45"}`}>
              {ticked("esprit:priere", k) ? "✓ " : ""}
              {PRAYER_NAMES[k]}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">Hygiène</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(HYGIENE).map(([k, l]) => (
            <span key={k} className={`mod-chip ${ticked("sante:hygiene", k) ? "" : "opacity-45"}`}>
              {ticked("sante:hygiene", k) ? "✓ " : ""}
              {l}
            </span>
          ))}
        </div>
      </Panel>
    ),
  };

  const cards = shown.map((c) => ({ key: c, label: CARDS.find((x) => x.key === c)?.label ?? c, node: nodes[c] }));

  return (
    <>
      <div className="glass-backdrop" aria-hidden />

      <DateNav anchor={anchor} range={range} label={label} />

      {range === "day" && (
        <div className="mx-auto mb-5 max-w-3xl space-y-4">
          <PilotPanel day={isoAnchor} planned={pilotBlocks} prefs={planningPrefs} />
          <RadarPanel alerts={radar} />
        </div>
      )}

      {/* The overview opens in front, its specialised cards on either side. */}
      <CardDeck initial={Math.max(0, shown.indexOf("journee")) || (cards.length >= 3 ? 1 : 0)} cards={cards} />

      {!shown.includes("journee") && (
      <div className="mt-4">
        <Panel title="La journée" count={timeline.length} wide>
          {timeline.length === 0 ? (
            <Empty>Journée vide.</Empty>
          ) : range === "day" ? (
            <ol className="space-y-1.5">
              {timeline.map((i) => <TimelineRow key={i.key} item={i} />)}
            </ol>
          ) : (
            groupByDay(timeline).map(([iso, items]) => (
              <div key={iso} className="mb-4 last:mb-0">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ink-dim)]">
                  {capitalise(dayLabel(fromISODate(iso) ?? from))}
                </p>
                <ol className="space-y-1.5">
                  {items.map((i) => <TimelineRow key={i.key} item={i} />)}
                </ol>
              </div>
            ))
          )}
        </Panel>
      </div>
      )}
    </>
  );
}

/** When an item ends, for dimming what is over on today's timeline. */
function endsAt(i: Item) {
  if (!i.at || !i.end || !/^\d\d:\d\d$/.test(i.time)) return i.at ?? new Date(0);
  const [sh, sm] = i.time.split(":").map(Number);
  const [eh, em] = i.end.split(":").map(Number);
  return new Date(i.at.getTime() + (eh * 60 + em - (sh * 60 + sm)) * 60000);
}

function untilLabel(at: Date, now: Date) {
  const m = Math.max(0, Math.round((at.getTime() - now.getTime()) / 60000));
  if (m < 1) return "maintenant";
  if (m < 60) return `dans ${m} min`;
  return `à ${hhmm(at).replace(":", " h ")}`;
}

function NowLine({ at }: { at: Date }) {
  return (
    <div className="now-line" role="separator" aria-label="Maintenant">
      <span>Maintenant · {hhmm(at)}</span>
    </div>
  );
}

function byTime(a: Item, b: Item) {
  if (!a.at) return 1;
  if (!b.at) return -1;
  return a.at.getTime() - b.at.getTime();
}

function groupByDay(items: Item[]): [string, Item[]][] {
  const map = new Map<string, Item[]>();
  for (const i of items) {
    const key = i.at ? toISODate(i.at) : "zzzz";
    (map.get(key) ?? map.set(key, []).get(key)!).push(i);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const FRENCH_DAY: Record<string, string> = {
  Monday: "lun", Tuesday: "mar", Wednesday: "mer", Thursday: "jeu",
  Friday: "ven", Saturday: "sam", Sunday: "dim",
};
const frenchDay = (d: string) => FRENCH_DAY[d] ?? d;
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Fallback hues for rows with no course or section behind them. The capsule tints its
// cap from whichever colour lands in --c.
const KIND_COLOR: Record<Kind, string> = {
  deadline: "#f43f5e",
  course: "#0ea5e9",
  perso: "#8b5cf6",
  section: "#e8bf63",
};

function TimePill({ item }: { item: Item }) {
  return (
    <span
      className="pill shrink-0"
      style={{ "--c": item.color ?? KIND_COLOR[item.kind] } as React.CSSProperties}
    >
      <span className="pill-time">{item.time}</span>
      <span className="pill-cap" aria-hidden />
    </span>
  );
}

function Panel({
  title, count, action, wide, children,
}: {
  title: string; count: number; action?: React.ReactNode; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <section className={`glass-card p-5 ${wide ? "" : "flex h-full flex-col"}`}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--ink)]">
          {title}
          {count > 0 && <span className="ml-2 text-xs font-normal text-[var(--ink-dim)]">{count}</span>}
        </h2>
        {action}
      </header>
      {/* Inside the deck every card is the same height, so the list scrolls within its
          card rather than stretching it. */}
      <div className={wide ? "" : "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"}>{children}</div>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="mod-stat">
      <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--ink-faint)]">{label}</span>
      <span className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--ink)]">{value}</span>
      {sub && <span className="text-[0.7rem] text-[var(--ink-dim)]">{sub}</span>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs text-[var(--ink-faint)]">{children}</p>;
}

// Time first in a fixed column so the title keeps the rest of the width. Titles wrap to
// two lines rather than truncating — a clipped course code tells the reader nothing.
function Row({ item }: { item: Item }) {
  return (
    <div data-land={item.key} className={`tile flex items-start gap-2.5 px-3.5 py-3 ${item.past ? "opacity-50" : ""}`}>
      {item.taskId && <TaskCheck id={item.taskId} done={false} label={item.title} />}
      <TimePill item={item} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-5 text-[var(--ink)]">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--ink-dim)]">
          {item.sub}
          {item.end && <span className="text-[var(--ink-faint)]">{item.sub ? " · " : ""}jusqu&apos;à {item.end}</span>}
        </p>
      </div>
      {item.eventId && <DeleteEvent id={item.eventId} />}
    </div>
  );
}

function TimelineRow({ item }: { item: Item }) {
  return (
    <li data-land={item.key} className="tile flex items-center gap-3 px-3.5 py-2.5">
      <TimePill item={item} />
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{item.title}</span>
      {item.sub && <span className="hidden shrink-0 truncate text-xs text-[var(--ink-dim)] sm:block">{item.sub}</span>}
      {item.eventId && <DeleteEvent id={item.eventId} />}
    </li>
  );
}
