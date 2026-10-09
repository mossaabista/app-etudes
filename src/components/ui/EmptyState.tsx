export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[rgba(255,220,148,0.22)] bg-[rgba(12,8,2,0.2)] px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      {description && <p className="max-w-sm text-xs text-[var(--ink-dim)]">{description}</p>}
      {action}
    </div>
  );
}
