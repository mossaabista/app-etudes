"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { RenderImage } from "@/components/tasks/RenderImage";
import { CARDS, PROFILES, profileOf, type Profile, type ProfileType, type TodayCard } from "@/lib/profile";
import { saveProfileAction } from "@/server/actions/profile.actions";

/** Switch profile and pick (and order) the Today cards. Nothing is saved until "Enregistrer". */
export function ProfileSettings({ current }: { current: Profile | null }) {
  const router = useRouter();
  const initial = current ?? { type: "etudiant" as ProfileType, cards: profileOf("etudiant").cards };
  const [type, setType] = useState<ProfileType>(initial.type);
  const [cards, setCards] = useState<TodayCard[]>(initial.cards);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = type !== initial.type || cards.join() !== initial.cards.join();

  const pick = (t: ProfileType) => {
    setType(t);
    setCards(profileOf(t).cards);
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
      await saveProfileAction({ type, cards });
      setSaved(true);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-faint)]">Je suis</p>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {PROFILES.map((p) => {
            const on = p.type === type;
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
                <span className="text-sm font-semibold text-[var(--ink)]">{p.label}</span>
              </button>
            );
          })}
        </div>
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
        {type !== "etudiant" && <p className="mr-auto text-xs text-[var(--ink-faint)]">Les sections Cours, Évaluations, Labos, Syllabus et Sync seront masquées du menu. Tes données restent intactes.</p>}
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
