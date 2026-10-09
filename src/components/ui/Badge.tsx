const TONE_CLASSES = {
  neutral: "bg-[rgba(255,220,148,0.1)] text-[var(--ink-dim)]",
  blue: "bg-[rgba(96,165,250,0.16)] text-[#bcd8ff]",
  green: "bg-[rgba(52,211,153,0.16)] text-[#a7f0cf]",
  amber: "bg-[rgba(251,191,36,0.18)] text-[#ffe08a]",
  red: "bg-[rgba(248,113,113,0.18)] text-[#ffc2b8]",
  violet: "bg-[rgba(167,139,250,0.18)] text-[#d9ccff]",
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

const LABEL: Record<string, string> = {
  ToDo: "À faire",
  InProgress: "En cours",
  Done: "Fait",
  Deferred: "Reporté",
  Upcoming: "À venir",
  Completed: "Terminé",
  Submitted: "Remis",
  Overdue: "En retard",
  NotStarted: "Pas commencé",
  Pending: "En attente",
  Low: "Basse",
  Medium: "Moyenne",
  High: "Haute",
  Critical: "Critique",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{LABEL[status] ?? humanize(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={STATUS_TONE[priority] ?? "neutral"}>{LABEL[priority] ?? priority}</Badge>;
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}
