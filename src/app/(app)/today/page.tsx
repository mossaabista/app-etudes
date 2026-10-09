import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { getProfile } from "@/server/profile";
import { DateNav } from "@/components/today/DateNav";
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
import { type TodayCard } from "@/lib/profile";
import { labelIn } from "@/lib/labels";
import { addDays, currentZone, dayName, fromISODate, startOfDay, toISODate, wallTimeToUtc } from "@/lib/dates";
import { getLocale, getMessages } from "@/i18n/server";
import { fmt, INTL, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

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

/** Sections whose rows are life, not school or work: they go to Perso, never to "Due". */
const LIFE = new Set(["sante", "esprit", "social", "quotidien"]);

// en-GB rather than fr-CA: the French locale renders "16 h 00", which would not line up
// with the "16:00" the timetable stores as plain strings.
const hhmm = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: currentZone(), hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/** "Santé · Sport" for an "area:sub" category or an "Area:area:sub" event type. */
const sectionLabel = (tag: string | null | undefined) => {
  const a = areaOfTag(tag);
  return a ? `${a.area.front}${a.sub ? ` · ${a.sub.label}` : ""}` : null;
};

const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PRAYER_NAMES: Record<string, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const HYGIENE: Record<Locale, Record<string, string>> = {
  fr: { "brush-am": "Brossage du matin", "brush-pm": "Brossage du soir", floss: "Fil dentaire", shower: "Douche", skin: "Soin et écran solaire", hands: "Mains avant les repas" },
  en: { "brush-am": "Morning brushing", "brush-pm": "Evening brushing", floss: "Floss", shower: "Shower", skin: "Skincare and sunscreen", hands: "Hands before meals" },
};

export async function generateMetadata() {
  return { title: (await getMessages()).nav.today };
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ d?: string; bienvenue?: string; importes?: string; import?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const [profile, planningPrefs, radar, t] = await Promise.all([getProfile(user.id), getPlanningPrefs(user.id), riskRadar(user.id, new Date(), locale), getMessages()]);
  // A brand-new account sets itself up first.
  if (!profile) redirect("/onboarding");
  const params = await searchParams;

  // Today shows one day — the chosen one — and nothing beyond it.
  const anchor = startOfDay((params.d ? fromISODate(params.d) : null) ?? new Date());
  const from = anchor;
  const to = addDays(from, 1);
  const window = { gte: from, lt: to };
  const shown = profile.cards;
  const wants = (c: TodayCard) => shown.includes(c);
  const dayLabel = (d: Date) => new Intl.DateTimeFormat(INTL[locale], { timeZone: currentZone(), weekday: "long", day: "numeric", month: "long" }).format(d);

  const [assessments, labs, tasks, events, schedules, entries] = await Promise.all([
    prisma.assessment.findMany({
      where: { userId: user.id, status: { not: "Completed" }, dueDate: window },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.labSession.findMany({
      where: { userId: user.id, status: { notIn: ["Completed", "Submitted"] }, dueDate: window },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: user.id, parentId: null, status: { not: "Done" }, dueDate: window },
      include: { course: { select: { code: true, color: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.calendarEvent.findMany({ where: { userId: user.id, date: window }, orderBy: { date: "asc" } }),
    prisma.courseSchedule.findMany({
      where: { course: { userId: user.id }, day: dayName(anchor) },
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

  // A sentence captured before the fix could leave a task and an event with the same
  // name on the same day: the event wins, the task is not shown twice.
  const eventKeys = new Set(events.map((e) => `${e.title.toLowerCase()}|${toISODate(e.date)}`));
  const visibleTasks = tasks.filter((x) => !x.dueDate || !eventKeys.has(`${x.title.toLowerCase()}|${toISODate(x.dueDate)}`));
  // Something to hand in: a course task, an old uncategorised one, a deliverable or a project.
  const deliverable = (x: (typeof tasks)[number]) => !!x.course || !x.category || x.category === "travail:livrables" || x.category.startsWith("projets:");
  const dueTime = (d: Date | null) => (d ? (hhmm(d) === "23:59" ? "—" : hhmm(d)) : "—");

  const taskItem = (x: (typeof tasks)[number]): Item => ({
    key: `t${x.id}`,
    kind: "deadline",
    at: x.dueDate,
    time: dueTime(x.dueDate),
    title: x.title,
    sub: x.course ? `${x.course.code} · ${t.today.task}` : (sectionLabel(x.category) ?? t.today.task),
    color: x.course?.color ?? areaOfTag(x.category)?.area.color,
    taskId: x.id,
  });

  const deadlines: Item[] = [
    ...assessments.map((a) => ({
      key: `a${a.id}`,
      kind: "deadline" as const,
      at: a.dueDate,
      time: a.dueDate ? hhmm(a.dueDate) : "—",
      title: a.title,
      sub: `${a.course.code} · ${labelIn(a.type, locale)}${a.weight != null ? ` · ${locale === "fr" ? String(a.weight).replace(".", ",") : a.weight} %` : ""}`,
      color: a.course.color,
    })),
    ...labs.map((l) => ({ key: `l${l.id}`, kind: "deadline" as const, at: l.dueDate, time: l.dueDate ? hhmm(l.dueDate) : "—", title: l.title, sub: `${l.course.code} · ${t.today.lab}`, color: l.course.color })),
    ...visibleTasks.filter(deliverable).map(taskItem),
  ].sort(byTime);

  // Tasks that are not hand-ins: work and school ones are "To do", life ones (sport,
  // family, errands) go to "Personal" when that card is shown.
  const isLifeTask = (x: (typeof tasks)[number]) => LIFE.has(x.category?.split(":")[0] ?? "");
  const todos = visibleTasks.filter((x) => !deliverable(x));
  const workTasks = todos.filter((x) => !isLifeTask(x)).map(taskItem);
  const lifeTasks = todos.filter(isLifeTask).map(taskItem);

  // Timetable rows store wall-clock strings: they become instants once pinned to the day.
  const isoDay = toISODate(anchor);
  const [y, m, d] = isoDay.split("-").map(Number);
  const courseItems: Item[] = schedules
    .map((s) => {
      const [h, mi] = s.startTime.split(":").map(Number);
      return {
        key: `s${s.id}`,
        kind: "course" as const,
        at: wallTimeToUtc([y, m, d, h, mi, 0]),
        time: s.startTime,
        end: s.endTime,
        title: s.course.code,
        sub: `${labelIn(s.type, locale)}${s.room ? ` · ${s.room}` : ""}`,
        color: s.course.color,
      };
    })
    .sort(byTime);

  // Events: anything planned from a section carries that section's colour.
  const eventItem = (e: (typeof events)[number]): Item => {
    const tagged = areaOfTag(e.type);
    const [h, mi] = (e.startTime ?? "00:00").split(":").map(Number);
    return {
      key: `e${e.id}`,
      kind: tagged ? "section" : "perso",
      at: e.startTime ? wallTimeToUtc([y, m, d, h, mi, 0]) : e.date,
      time: e.startTime ?? "—",
      end: e.endTime ?? undefined,
      title: e.title,
      sub: [sectionLabel(e.type), e.notes === PILOT_NOTE ? t.today.pilot : e.notes].filter(Boolean).join(" · ") || undefined,
      color: tagged?.area.color,
      eventId: e.id,
    };
  };
  const kindOf = (e: (typeof events)[number]): "pilot" | "meeting" | "sport" | "life" | "work" => {
    if (e.notes === PILOT_NOTE) return "pilot";
    const tag = areaOfTag(e.type);
    if (!tag) return e.type === "Meeting" ? "meeting" : "life";
    if (tag.sub?.key === "reunions") return "meeting";
    if (e.type === "Area:sante:sport") return "sport";
    return LIFE.has(tag.area.key) ? "life" : "work";
  };
  // Each card holds its own kind of thing only; the overview holds the whole day.
  const meetingItems = events.filter((e) => kindOf(e) === "meeting").map(eventItem).sort(byTime);
  const personalItems = [...events.filter((e) => kindOf(e) === "life").map(eventItem), ...lifeTasks].sort(byTime);
  const taskItems = [...workTasks, ...(wants("perso") ? [] : lifeTasks)].sort(byTime);
  const pilotBlocks = events.filter((e) => e.notes === PILOT_NOTE).length;

  const trainingItems: Item[] = [
    ...events.filter((e) => kindOf(e) === "sport").map(eventItem),
    ...entries
      .filter((e) => e.module === "sante:sport" && e.kind === "workout")
      .map((w) => ({ key: `w${w.id}`, kind: "section" as const, at: w.date, time: "✓", title: w.text ?? t.today.workout, sub: fmt(t.today.done, { n: w.value ?? 0 }), color: "#ef4444" })),
  ].sort(byTime);

  const teamItems: Item[] = entries
    .filter((e) => e.module === "equipe:delegue")
    .map((dl) => {
      const data = (dl.data ?? {}) as { to?: string };
      return {
        key: `d${dl.id}`,
        kind: "section" as const,
        at: dl.date,
        time: dl.date < from ? t.today.late : hhmm(dl.date) === "12:00" ? "—" : hhmm(dl.date),
        title: dl.text ?? t.today.task,
        sub: `${data.to ?? "—"} · ${fmt(t.today.forDay, { day: dayLabel(dl.date) })}`,
        color: "#14b8a6",
      };
    })
    .sort(byTime);

  const water = entries.find((e) => e.module === "sante:nutrition" && e.kind === "water" && toISODate(e.date) === isoDay)?.value ?? 0;
  const meals = entries.filter((e) => e.module === "sante:nutrition" && e.kind === "meal" && toISODate(e.date) === isoDay);
  const plan = entries.find((e) => e.module === "sante:nutrition" && e.kind === "plan");
  const target = (plan?.data as { kcal?: number } | null)?.kcal;
  const checks = entries.filter((e) => e.kind === "check" && toISODate(e.date) === isoDay);
  const ticked = (module: string, key: string) => checks.some((c) => c.module === module && (c.data as { item?: string } | null)?.item === key);

  // The overview: everything of the day in one list — classes, hand-ins, to-dos, life.
  const isTodayView = isoDay === toISODate(new Date());
  const now = new Date();
  const timeline = [...deadlines, ...courseItems, ...events.map(eventItem), ...workTasks, ...lifeTasks]
    .sort(byTime)
    .map((i) => (isTodayView && i.at && endsAt(i) < now && i.kind !== "deadline" ? { ...i, past: true } : i));
  const nextUp = isTodayView ? timeline.find((i) => !i.past && i.at && i.at >= now && i.time !== "—") : undefined;
  const untilLabel = (at: Date) => {
    const mins = Math.max(0, Math.round((at.getTime() - now.getTime()) / 60000));
    if (mins < 1) return t.today.nowWord;
    if (mins < 60) return fmt(t.today.inMin, { n: mins });
    return fmt(t.today.atTime, { time: hhmm(at) });
  };
  const add = <AddEvent isoDate={isoDay} />;
  const list = (items: Item[], empty: string) => (items.length === 0 ? <Empty>{empty}</Empty> : items.map((i) => <Row key={i.key} item={i} t={t} />));

  const nodes: Record<TodayCard, React.ReactNode> = {
    journee: (
      <Panel title={t.cards.journee} count={timeline.length} action={add}>
        {nextUp && (
          <div className="next-up">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#f0cd79]">{fmt(t.today.nextUp, { when: untilLabel(nextUp.at!) })}</span>
            <span className="truncate text-sm font-semibold text-[var(--ink)]">{nextUp.title}</span>
          </div>
        )}
        {timeline.length === 0 ? (
          <Empty>{t.today.emptyDay}</Empty>
        ) : (
          timeline.map((i, n) => (
            <div key={i.key}>
              {isTodayView && !i.past && n > 0 && timeline[n - 1].past && (
                <div className="now-line" role="separator" aria-label={t.today.now}>
                  <span>{fmt(t.today.nowAt, { time: hhmm(now) })}</span>
                </div>
              )}
              <Row item={i} t={t} />
            </div>
          ))
        )}
      </Panel>
    ),
    courses: <Panel title={t.cards.courses} count={courseItems.length}>{list(courseItems, t.today.emptyCourses)}</Panel>,
    deadlines: <Panel title={t.cards.deadlines} count={deadlines.length}>{list(deadlines, t.today.emptyDeadlines)}</Panel>,
    reunions: <Panel title={t.cards.reunions} count={meetingItems.length} action={add}>{list(meetingItems, t.today.emptyMeetings)}</Panel>,
    afaire: <Panel title={t.cards.afaire} count={taskItems.length}>{list(taskItems, t.today.emptyTasks)}</Panel>,
    perso: <Panel title={t.cards.perso} count={personalItems.length} action={add}>{list(personalItems, t.today.emptyPerso)}</Panel>,
    team: <Panel title={t.cards.team} count={teamItems.length}>{list(teamItems, t.today.emptyTeam)}</Panel>,
    training: <Panel title={t.cards.training} count={trainingItems.length}>{list(trainingItems, t.today.emptyTraining)}</Panel>,
    nutrition: (
      <Panel title={t.cards.nutrition} count={meals.length}>
        <Stat label={t.today.water} value={`${((water * 250) / 1000).toFixed(2).replace(".", locale === "fr" ? "," : ".")} L`} sub={t.today.waterGoal} />
        {target && <Stat label={t.today.target} value={`${target.toLocaleString(INTL[locale])} kcal`} sub={t.today.targetSub} />}
        {meals.length === 0 ? (
          <Empty>{t.today.emptyMeals}</Empty>
        ) : (
          meals.map((meal) => (
            <div key={meal.id} className="tile px-3.5 py-2.5">
              <p className="text-xs uppercase tracking-wide text-[var(--ink-faint)]">{String((meal.data as { slot?: string } | null)?.slot ?? "")}</p>
              <p className="text-sm text-[var(--ink)]">{meal.text}</p>
            </div>
          ))
        )}
      </Panel>
    ),
    routines: (
      <Panel title={t.cards.routines} count={checks.length}>
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{t.today.prayers}</p>
        <div className="flex flex-wrap gap-1.5">
          {PRAYER_KEYS.map((k) => (
            <span key={k} className={`mod-chip ${ticked("esprit:priere", k) ? "" : "opacity-45"}`}>
              {ticked("esprit:priere", k) ? "✓ " : ""}
              {PRAYER_NAMES[k]}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{t.today.hygiene}</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(HYGIENE[locale]).map(([k, l]) => (
            <span key={k} className={`mod-chip ${ticked("sante:hygiene", k) ? "" : "opacity-45"}`}>
              {ticked("sante:hygiene", k) ? "✓ " : ""}
              {l}
            </span>
          ))}
        </div>
      </Panel>
    ),
  };

  const cards = shown.map((c) => ({ key: c, label: t.cards[c] ?? c, node: nodes[c] }));
  const label = dayLabel(anchor);

  return (
    <>
      <div className="glass-backdrop" aria-hidden />

      <DateNav prev={toISODate(addDays(anchor, -1))} next={toISODate(addDays(anchor, 1))} isToday={isTodayView} label={label.charAt(0).toUpperCase() + label.slice(1)} />

      <div className="mx-auto mb-5 max-w-3xl space-y-4">
        {params.bienvenue && (
          <section className="glass-card p-5" aria-labelledby="welcome-title">
            <h2 id="welcome-title" className="text-base font-semibold text-[var(--ink)]">
              {fmt(t.today.welcomeTitle, { name: user.name.split(" ")[0] })}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-dim)]">{t.today.welcomeText}</p>
            {params.importes && <p className="mt-2 text-sm text-[#86d6a4]">{fmt(t.onboarding.imported, { n: Number(params.importes) || 0 })}</p>}
            {params.import === "echec" && <p className="mt-2 text-sm text-[#ffd9a8]">{t.onboarding.importFailed}</p>}
            <p className="mt-3 text-xs text-[var(--ink-faint)]">
              {t.today.welcomeTry} <span className="text-[#f0cd79]">{t.today.welcomeIdeas}</span>
            </p>
          </section>
        )}
        <PilotPanel day={isoDay} planned={pilotBlocks} prefs={planningPrefs} isToday={isTodayView} />
        <RadarPanel alerts={radar} />
      </div>

      {/* The overview opens in front, its specialised cards on either side. */}
      <CardDeck initial={Math.max(0, shown.indexOf("journee")) || (cards.length >= 3 ? 1 : 0)} cards={cards} />

      {!wants("journee") && (
        <div className="mt-4">
          <Panel title={t.cards.journee} count={timeline.length} wide>
            {timeline.length === 0 ? (
              <Empty>{t.today.emptyDay}</Empty>
            ) : (
              <ol className="space-y-1.5">
                {timeline.map((i) => (
                  <TimelineRow key={i.key} item={i} />
                ))}
              </ol>
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

function byTime(a: Item, b: Item) {
  if (!a.at) return 1;
  if (!b.at) return -1;
  return a.at.getTime() - b.at.getTime();
}

// Fallback hues for rows with no course or section behind them. The capsule tints its
// cap from whichever colour lands in --c.
const KIND_COLOR: Record<Kind, string> = { deadline: "#f43f5e", course: "#0ea5e9", perso: "#8b5cf6", section: "#e8bf63" };

function TimePill({ item }: { item: Item }) {
  return (
    <span className="pill shrink-0" style={{ "--c": item.color ?? KIND_COLOR[item.kind] } as React.CSSProperties}>
      <span className="pill-time">{item.time}</span>
      <span className="pill-cap" aria-hidden />
    </span>
  );
}

function Panel({ title, count, action, wide, children }: { title: string; count: number; action?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
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
  return <p className="py-6 text-center text-xs leading-5 text-[var(--ink-faint)]">{children}</p>;
}

// Time first in a fixed column so the title keeps the rest of the width. Titles wrap to
// two lines rather than truncating — a clipped course code tells the reader nothing.
function Row({ item, t }: { item: Item; t: Messages }) {
  return (
    <div data-land={item.key} className={`tile flex items-start gap-2.5 px-3.5 py-3 ${item.past ? "opacity-50" : ""}`}>
      {item.taskId && <TaskCheck id={item.taskId} done={false} label={item.title} />}
      <TimePill item={item} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-5 text-[var(--ink)]">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[var(--ink-dim)]">
          {item.sub}
          {item.end && (
            <span className="text-[var(--ink-faint)]">
              {item.sub ? " · " : ""}
              {fmt(t.today.until, { time: item.end })}
            </span>
          )}
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
