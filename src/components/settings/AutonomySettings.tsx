"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { saveAutonomyAction } from "@/server/actions/autonomy.actions";
import { GRANTS, MODES, type Autonomy, type Grant } from "@/lib/risk";

/** How much the assistant may do on its own: one of three modes, plus explicit grants. */
export function AutonomySettings({ current }: { current: Autonomy }) {
  const [value, setValue] = useState(current);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const save = (next: Autonomy) => {
    const before = value;
    setValue(next);
    setStatus(null);
    start(async () => {
      const r = await saveAutonomyAction(next);
      if ("error" in r) {
        setValue(before);
        setStatus({ text: r.error ?? "Erreur.", error: true });
      } else {
        setValue(r.saved);
        setStatus({ text: "Enregistré." });
      }
    });
  };
  const toggleGrant = (g: Grant) =>
    save({ ...value, grants: value.grants.includes(g) ? value.grants.filter((x) => x !== g) : [...value.grants, g] });

  return (
    <fieldset className="space-y-3" disabled={pending}>
      <legend className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-dim)]">
        <ShieldCheck size={13} className="text-[#f0cd79]" /> Ce que l&apos;assistant peut faire sans te demander
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <label key={m.mode} className="tile flex cursor-pointer flex-col gap-1 px-4 py-3 has-[:checked]:ring-2 has-[:checked]:ring-[#e8bf63]">
            <span className="flex items-center gap-2">
              <input type="radio" name="autonomy-mode" checked={value.mode === m.mode} onChange={() => save({ ...value, mode: m.mode })} className="h-4 w-4 accent-[#e8bf63]" />
              <span className="text-sm font-semibold text-[var(--ink)]">{m.label}</span>
            </span>
            <span className="text-xs leading-5 text-[var(--ink-dim)]">{m.desc}</span>
          </label>
        ))}
      </div>
      {value.mode === "autonome" && (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--ink-dim)]">Autorisé sans demander :</p>
          {GRANTS.map((g) => (
            <label key={g.grant} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink)]">
              <input type="checkbox" checked={value.grants.includes(g.grant)} onChange={() => toggleGrant(g.grant)} className="h-4 w-4 accent-[#e8bf63]" />
              {g.label}
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-[var(--ink-faint)]">Plusieurs suppressions d&apos;un coup demandent toujours ton accord, quel que soit le mode.</p>
      <p role="status" aria-live="polite" className={`min-h-[1rem] text-xs ${status?.error ? "text-[#ffb3a3]" : "text-[var(--ink-dim)]"}`}>
        {pending ? "Enregistrement…" : status?.text}
      </p>
    </fieldset>
  );
}
