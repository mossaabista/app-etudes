import type { Integration } from "@/server/integrations";

const STATE: Record<Integration["state"], { label: string; tone: string }> = {
  connected: { label: "Connecté", tone: "text-[#86d6a4] border-[rgba(134,214,164,0.35)]" },
  available: { label: "Prêt à activer", tone: "text-[#f0cd79] border-[rgba(240,205,121,0.35)]" },
  device: { label: "Selon l'appareil", tone: "text-[var(--ink-dim)] border-[rgba(255,220,148,0.2)]" },
  failed: { label: "En échec", tone: "text-[#ffb3a3] border-[rgba(255,179,163,0.4)]" },
  not_configured: { label: "Non configuré", tone: "text-[var(--ink-faint)] border-[rgba(255,220,148,0.14)]" },
};

export function Integrations({ items }: { items: Integration[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-sm font-medium text-[var(--ink)]">{i.name}</p>
            <p className="text-xs leading-5 text-[var(--ink-dim)]">{i.detail}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${STATE[i.state].tone}`}>{STATE[i.state].label}</span>
        </li>
      ))}
    </ul>
  );
}
