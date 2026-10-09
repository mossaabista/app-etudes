"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { RenderImage } from "@/components/tasks/RenderImage";
import { CARDS, PROFILES, profileOf, type Profile, type ProfileType, type TodayCard } from "@/lib/profile";
import { saveProfileAction } from "@/server/actions/profile.actions";

/**
 * Pick the roles you hold, the one that is active, and (for it) the Today cards. Nothing
 * is saved until "Enregistrer"; nothing filed anywhere is ever deleted by a change here.
 */
export function ProfileSettings({ current }: { current: Profile | null }) {
  const router = useRouter();
  const initial: Pick<Profile, "type" | "roles" | "cards" | "cardsByRole"> = current ?? { type: "etudiant", roles: ["etudiant"], cards: profileOf("etudiant").cards, cardsByRole: {} };
  const [type, setType] = useState<ProfileType>(initial.type);
  const [roles, setRoles] = useState<ProfileType[]>(initial.roles);
  const [cards, setCards] = useState<TodayCard[]>(initial.cards);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = type !== initial.type || cards.join() !== initial.cards.join() || [...roles].sort().join() !== [...initial.roles].sort().join();

  // A tile adds or removes a role; removing the active one hands over to another.
  const pick = (t: ProfileType) => {
    setSaved(false);
    if (!roles.includes(t)) {
      setRoles([...roles, t]);
      return;
    }
    if (roles.length === 1) return;
    const rest = roles.filter((r) => r !== t);
    setRoles(rest);
    if (t === type) activate(rest[0]);
  };
  const activate = (t: ProfileType) => {
    setType(t);
    setCards(initial.cardsByRole[t] ?? profileOf(t).cards);
    setSaved(false);
  };
  const toggle = (c: TodayCard) => {
    setSaved(false);
    setCards((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length >= 5 ? cs : [...cs, c]));
  };
  const move = (c: TodayCard, by: -1 | 1) => {
    setSaved(false);
    setCards((cs) => {
      const i = cs.indexOf(c);
      const j = i + by;
      if (i < 0 || j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const save = () =>
    start(async () => {
      await saveProfileAction({ type, cards, roles });
      setSaved(true);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-faint)]">Je suis · un ou plusieurs rôles</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {PROFILES.map((p) => {
            const on = roles.includes(p.type);
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => pick(p.type)}
                aria-pressed={on}
                className={`tile focus-ring flex flex-col items-center gap-1 px-3 pb-3 pt-2 text-center ${on ? "ring-1 ring-[#f0cd79]" : "opacity-70 hover:opacity-100"}`}
              >
                <span className="relative h-16 w-16">
                  <RenderImage src={p.image} className="mod-hero-img" />
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-[var(--ink)]">
                  {on && <Check size={13} className="text-[#f0cd79]" aria-hidden />}
                  {p.label}
                </span>
                {p.type === type && <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#f0cd79]">Actif</span>}
              </button>
            );
          })}
        </div>
        {roles.length > 1 && (
          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-dim)]">
            Contexte actif
            <select value={type} onChange={(e) => activate(e.target.value as ProfileType)} className="focus-ring cursor-pointer rounded-md border border-[rgba(255,220,148,0.18)] bg-[rgba(255,220,148,0.06)] px-2.5 py-1.5 text-xs text-[var(--ink)]">
              {roles.map((r) => (
                <option key={r} value={r}>
                  {profileOf(r).label}
                </option>
              ))}
            </select>
            <span>— tu peux aussi en changer depuis le menu.</span>
          </label>
        )}
        <p className="mt-2.5 text-xs leading-5 text-[var(--ink-dim)]">{profileOf(type).pitch}</p>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-faint)]">Cartes de l&apos;écran Aujourd&apos;hui · {cards.length}/5</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => {
            const on = cards.includes(c.key);
            const i = cards.indexOf(c.key);
            return (
              <div key={c.key} className={`tile flex items-center gap-3 px-3.5 py-3 ${on ? "ring-1 ring-[#f0cd79]" : "opacity-70"}`}>
                <button type="button" onClick={() => toggle(c.key)} aria-pressed={on} className="focus-ring flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left">
                  <span className="check mt-0.5" data-checked={on || undefined}>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[var(--ink)]">
                      {c.label}
                      {on && <span className="ml-1.5 text-xs font-normal text-[#f0cd79]">#{i + 1}</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--ink-dim)]">{c.desc}</span>
                  </span>
                </button>
                {on && cards.length > 1 && (
                  <span className="flex shrink-0 flex-col">
                    <button type="button" disabled={i === 0} onClick={() => move(c.key, -1)} aria-label={`Monter ${c.label}`} className="focus-ring rounded p-0.5 text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-25">
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" disabled={i === cards.length - 1} onClick={() => move(c.key, 1)} aria-label={`Descendre ${c.label}`} className="focus-ring rounded p-0.5 text-[var(--ink-dim)] hover:text-[var(--ink)] disabled:opacity-25">
                      <ArrowDown size={13} />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <p className="mr-auto text-xs text-[var(--ink-faint)]">Changer de rôle change seulement ce qui est affiché : tes cours, tâches et secteurs restent intacts et accessibles.</p>
        {saved && !dirty && (
          <span className="flex items-center gap-1.5 text-xs text-[#f0cd79]">
            <Check size={13} /> Enregistré
          </span>
        )}
        <button type="button" disabled={!dirty || pending || cards.length === 0} onClick={save} className="mod-chip mod-chip-gold focus-ring px-5 py-2.5 text-sm">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
