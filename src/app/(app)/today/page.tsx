import { prisma } from "@/lib/db";
import { requireUser } from "@/server/auth/current-user";
import { DateNav, type Range } from "@/components/today/DateNav";
import { AddEvent } from "@/components/today/AddEvent";
import { CardDeck } from "@/components/today/CardDeck";
import { DeleteEvent } from "@/components/today/DeleteEvent";
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

type Kind = "deadline" | "course" | "perso";

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
}

// en-GB rather than fr-CA: the French locale renders "16 h 00", which would not line up
// with the "16:00" the timetable stores as plain strings.
const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(d);

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; r?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const range: Range = params.r === "week" || params.r === "month" ? params.r : "day";
  const anchor = (params.d ? fromISODate(params.d) : null) ?? startOfDay(new Date());

  const from = range === "day" ? startOfDay(anchor) : range === "week" ? startOfWeek(anchor) : startOfMonth(anchor);
  const to = range === "day" ? addDays(from, 1) : range === "week" ? addDays(from, 7) : addMonths(from, 1);

  const window = { gte: from, lt: to };
  const scheduleDays = range === "day" ? [dayName(anchor)] : WEEKDAYS;

  const [assessments, labs, tasks, personal, schedules] = await Promise.all([
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
    prisma.calendarEvent.findMany({
      where: { userId: user.id, date: window },
      orderBy: { date: "asc" },
    }),
    prisma.courseSchedule.findMany({
      where: { course: { userId: user.id }, day: { in: scheduleDays } },
      include: { course: { select: { code: true, color: true, name: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const deadlines: Item[] = [
    ...assessments.map((a) => ({
      key: `a${a.id}`, kind: "deadline" as const, at: a.dueDate, time: a.dueDate ? hhmm(a.dueDate) : "—",
      title: a.title, sub: `${a.course.code} · ${a.type}${a.weight != null ? ` · ${a.weight} %` : ""}`,
      color: a.course.color,
    })),
    ...labs.map((l) => ({
      key: `l${l.id}`, kind: "deadline" as const, at: l.dueDate, time: l.dueDate ? hhmm(l.dueDate) : "—",
      title: l.title, sub: `${l.course.code} · Laboratoire`, color: l.course.color,
    })),
    ...tasks.map((t) => ({
      key: `t${t.id}`, kind: "deadline" as const, at: t.dueDate, time: t.dueDate ? hhmm(t.dueDate) : "—",
      title: t.title, sub: t.course ? `${t.course.code} · Tâche` : "Tâche", color: t.course?.color,
    })),
  ].sort(byTime);

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
        sub: `${s.type}${s.room ? ` · ${s.room}` : ""}${range !== "day" ? ` · ${frenchDay(s.day)}` : ""}`,
        color: s.course.color,
      };
    })
    .sort(byTime);

  const personalItems: Item[] = personal
    .map((e) => ({
      key: `e${e.id}`,
      kind: "perso" as const,
      at: e.date,
      time: e.startTime ?? "—",
      end: e.endTime ?? undefined,
      title: e.title,
      sub: e.notes ?? undefined,
      eventId: e.id,
    }))
    .sort(byTime);

  const timeline = [...deadlines, ...courseItems, ...personalItems].sort(byTime);

  const label =
    range === "day"
      ? capitalise(dayLabel(anchor))
      : range === "week"
        ? `Semaine du ${dayLabel(from)}`
        : capitalise(new Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE, month: "long", year: "numeric" }).format(from));

  return (
    <>
      <div className="glass-backdrop" aria-hidden />

      <DateNav anchor={anchor} range={range} label={label} />

      {/* Personal on the left, deadlines facing the reader, courses on the right. */}
      <CardDeck
        initial={1}
        cards={[
          {
            key: "perso",
            label: "Calendrier perso",
            node: (
              <Panel
                title="Calendrier perso"
                count={personalItems.length}
                action={<AddEvent isoDate={toISODate(range === "day" ? anchor : from)} />}
              >
                {personalItems.length === 0 ? (
                  <Empty>Rien de personnel. Touche le + pour ajouter.</Empty>
                ) : (
                  personalItems.map((i) => <Row key={i.key} item={i} />)
                )}
              </Panel>
            ),
          },
          {
            key: "deadlines",
            label: "À rendre",
            node: (
              <Panel title="À rendre" count={deadlines.length}>
                {deadlines.length === 0 ? (
                  <Empty>Rien à rendre {range === "day" ? "ce jour-là" : "sur cette période"}.</Empty>
                ) : (
                  deadlines.map((i) => <Row key={i.key} item={i} />)
                )}
              </Panel>
            ),
          },
          {
            key: "courses",
            label: "Cours",
            node: (
              <Panel title="Cours" count={courseItems.length}>
                {courseItems.length === 0 ? (
                  <Empty>Aucun cours {range === "day" ? "ce jour-là" : "enregistré"}.</Empty>
                ) : (
                  courseItems.map((i) => <Row key={i.key} item={i} />)
                )}
              </Panel>
            ),
          },
        ]}
      />

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
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
    </>
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

// Fallback hues for rows with no course behind them. The dot tints its liquid from
// whichever colour lands in --c.
const KIND_COLOR: Record<Kind, string> = {
  deadline: "#f43f5e",
  course: "#0ea5e9",
  perso: "#8b5cf6",
};

function Dot({ item, className = "" }: { item: Item; className?: string }) {
  return (
    <span
      className={`lm-dot shrink-0 ${className}`}
      style={{ "--c": item.color ?? KIND_COLOR[item.kind] } as React.CSSProperties}
      aria-hidden
    />
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
        <h2 className="text-sm font-semibold text-slate-900">
          {title}
          {count > 0 && <span className="ml-2 text-xs font-normal text-slate-500">{count}</span>}
        </h2>
        {action}
      </header>
      {/* Inside the deck every card is the same height, so the list scrolls within its
          card rather than stretching it. */}
      <div className={wide ? "" : "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs text-slate-400">{children}</p>;
}

// Time first in a fixed column so the title keeps the rest of the width. Titles wrap to
// two lines rather than truncating — a clipped course code tells the reader nothing.
function Row({ item }: { item: Item }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-white/55 px-3 py-2.5">
      <span className="w-10 shrink-0 pt-0.5 text-right font-mono text-[11px] leading-[18px] tabular-nums">
        <span className="block text-slate-600">{item.time}</span>
        {item.end && <span className="block text-slate-400">{item.end}</span>}
      </span>
      <Dot item={item} className="mt-1 h-3.5 w-3.5" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-5 text-slate-900">{item.title}</p>
        {item.sub && <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-500">{item.sub}</p>}
      </div>
      {item.eventId && <DeleteEvent id={item.eventId} />}
    </div>
  );
}

function TimelineRow({ item }: { item: Item }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white/55 px-3 py-2">
      <span className="w-20 shrink-0 font-mono text-xs tabular-nums text-slate-500">
        {item.time}
        {item.end && <span className="text-slate-300">–{item.end}</span>}
      </span>
      <Dot item={item} className="h-3.5 w-3.5" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{item.title}</span>
      {item.sub && <span className="hidden shrink-0 truncate text-xs text-slate-500 sm:block">{item.sub}</span>}
      {item.eventId && <DeleteEvent id={item.eventId} />}
    </li>
  );
}
