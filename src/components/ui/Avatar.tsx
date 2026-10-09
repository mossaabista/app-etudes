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
      className={`inline-flex ${dims} shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#ffe9a0] to-[#c9952f] font-semibold text-[#2a1a05]`}
      title={name}
    >
      {initials}
    </span>
  );
}
