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
        <h1 className="text-2xl font-semibold tracking-tight text-on-gold">{title}</h1>
        {description && <p className="mt-1 text-sm text-on-gold">{description}</p>}
      </div>
      {action}
    </div>
  );
}
