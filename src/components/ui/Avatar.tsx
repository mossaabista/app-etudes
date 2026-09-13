export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const dims = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-11 w-11 text-sm" }[size];

  return (
    <span
      className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-white`}
      title={name}
    >
      {initials}
    </span>
  );
}
