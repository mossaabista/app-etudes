export function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "amber" | "red" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = {
    blue: "bg-gradient-to-r from-[#c9952f] to-[#ffe08a]",
    green: "bg-gradient-to-r from-[#2f9e6e] to-[#7fe0b0]",
    amber: "bg-gradient-to-r from-[#d98a1f] to-[#ffcf6a]",
    red: "bg-gradient-to-r from-[#c2412d] to-[#ff8a70]",
  }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(12,8,2,0.5)]">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
