export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.5)]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[rgba(255,246,227,0.88)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.6)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
