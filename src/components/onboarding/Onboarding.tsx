"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { RenderImage } from "@/components/tasks/RenderImage";
import { BRAND } from "@/lib/brand";
import { CARDS, PROFILES, profileOf, type Profile, type ProfileType, type TodayCard } from "@/lib/profile";
import { saveProfileAction } from "@/server/actions/profile.actions";

/** First run: pick who the app is for, then (optionally) the Today cards. */
export function Onboarding({ name, current }: { name: string; current: Profile | null }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [type, setType] = useState<ProfileType>(current?.type ?? "etudiant");
  const [cards, setCards] = useState<TodayCard[]>(current?.cards ?? profileOf("etudiant").cards);
  const [pending, start] = useTransition();

  const pick = (t: ProfileType) => {
    setType(t);
    setCards(profileOf(t).cards);
  };
  const toggle = (c: TodayCard) => setCards((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : cs.length >= 5 ? cs : [...cs, c]));
  const finish = () =>
    start(async () => {
      await saveProfileAction({ type, cards });
      router.push("/today");
      router.refresh();
    });

  return (
    <div className="relative min-h-dvh px-4 py-10 sm:py-14">
      <div className="glass-backdrop" aria-hidden />
      <div className="area-enter mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={48} />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ink)] drop-shadow-[0_1px_2px_rgba(40,22,2,0.5)] sm:text-4xl">
            {step === 1 ? `Bienvenue${name ? `, ${name}` : ""}.` : "Ton écran du jour"}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--ink-dim)]">
            {step === 1
              ? `${BRAND.promise} Dis-nous pour qui on le règle.`
              : "Choisis jusqu'à cinq cartes pour l'écran Aujourd'hui. Tu pourras les changer dans les réglages."}
          </p>
        </div>

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {PROFILES.map((p, i) => {
              const on = p.type === type;
              return (
                <button
                  key={p.type}
                  type="button"
                  onClick={() => pick(p.type)}
                  aria-pressed={on}
                  className={`ob-card glass-card focus-ring text-left ${on ? "ob-card-on" : ""}`}
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <span className="relative h-24 w-24 shrink-0">
                    <RenderImage src={p.image} className="mod-hero-img" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                      {p.label}
                      {on && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f0cd79] text-[#2a1a05]">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--ink-dim)]">{p.pitch}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((c) => {
              const on = cards.includes(c.key);
              return (
                <button key={c.key} type="button" onClick={() => toggle(c.key)} aria-pressed={on} className={`tile focus-ring flex items-start gap-3 px-4 py-3.5 text-left ${on ? "ring-1 ring-[#f0cd79]" : "opacity-75"}`}>
                  <span className="check mt-0.5" data-checked={on || undefined}>
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[var(--ink)]">
                      {c.label}
                      {on && <span className="ml-1.5 text-xs font-normal text-[#f0cd79]">#{cards.indexOf(c.key) + 1}</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--ink-dim)]">{c.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          {step === 2 && (
            <button type="button" onClick={() => setStep(1)} className="mod-chip focus-ring">
              Retour
            </button>
          )}
          <button
            type="button"
            disabled={pending || (step === 2 && cards.length === 0)}
            onClick={() => (step === 1 ? setStep(2) : finish())}
            className="mod-chip mod-chip-gold focus-ring px-6 py-3 text-sm"
          >
            {step === 1 ? "Continuer" : pending ? "Préparation…" : "Commencer"} <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
