const TONE_CLASSES = {
  neutral: "bg-slate-100 text-slate-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  ToDo: "neutral",
  InProgress: "blue",
  Done: "green",
  Deferred: "amber",
  Upcoming: "blue",
  Completed: "green",
  Overdue: "red",
  NotStarted: "neutral",
  Pending: "neutral",
  Low: "neutral",
  Medium: "blue",
  High: "amber",
  Critical: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{humanize(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={STATUS_TONE[priority] ?? "neutral"}>{priority}</Badge>;
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
