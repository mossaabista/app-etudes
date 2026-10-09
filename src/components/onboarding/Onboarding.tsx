"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bell, Check, Loader2, Mic, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { RenderImage } from "@/components/tasks/RenderImage";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { useI18n } from "@/i18n/client";
import { timeZones } from "@/lib/time-zones";
import { fmt } from "@/i18n/config";
import { PROFILES, type ProfileType } from "@/lib/profile";
import type { About } from "@/lib/settings";
import { askMicrophone, enablePush, pushSupported } from "@/lib/push-client";
import { completeOnboardingAction } from "@/server/actions/onboarding.actions";
import { commandAction } from "@/server/actions/capture.actions";

const MAIN: ProfileType[] = ["etudiant", "pro", "entrepreneur", "sportif"];
const STEPS = 6;
const field = "glass-pill focus-ring mt-1.5 block w-full px-4 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)]";
const label = "block text-xs font-medium text-[var(--ink-dim)]";

type Perm = "idle" | "granted" | "denied" | "unsupported";

/** The user's zone, and a city and country guessed from it and from the browser language. */
function detectPlace(locale: string) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto";
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? "";
  const region = (navigator.language.split("-")[1] ?? "").toUpperCase();
  let country = "";
  try {
    country = region ? (new Intl.DisplayNames([locale], { type: "region" }).of(region) ?? "") : "";
  } catch {}
  return { tz, city, country };
}

/**
 * First run, under two minutes and skippable at every step: language, who you are, a few
 * details, where you are, permissions asked with their reason, then Jarvis. Saved once.
 */
export function Onboarding({ name, vapidPublicKey }: { name: string; vapidPublicKey: string }) {
  const { t, locale } = useI18n();
  const o = t.onboarding;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [roles, setRoles] = useState<ProfileType[]>([]);
  const [about, setAbout] = useState<Partial<About>>({});
  const [sportsText, setSportsText] = useState("");
  const [brightspace, setBrightspace] = useState("");
  const [place, setPlace] = useState({ tz: "", city: "", country: "" });
  const [notif, setNotif] = useState<Perm>("idle");
  const [mic, setMic] = useState<Perm>("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, startAsk] = useTransition();
  const [finishing, startFinish] = useTransition();
  const zones = timeZones();

  useEffect(() => {
    const id = setTimeout(() => setPlace(detectPlace(locale)), 0);
    return () => clearTimeout(id);
  }, [locale]);

  const has = (r: ProfileType) => roles.includes(r);
  const toggle = (r: ProfileType) => setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));
  const next = () => setStep((s) => Math.min(STEPS - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = () =>
    startFinish(async () => {
      const res = await completeOnboardingAction({
        locale,
        roles,
        about: { ...about, sports: sportsText.split(/[,;]/).map((x) => x.trim()).filter(Boolean) },
        timeZone: place.tz,
        city: place.city || null,
        country: place.country || null,
        brightspaceUrl: has("etudiant") && brightspace.trim() ? brightspace.trim() : null,
      });
      const q = new URLSearchParams({ bienvenue: "1" });
      if (res.imported) q.set("importes", String(res.imported));
      if (res.importFailed) q.set("import", "echec");
      router.push(`/today?${q}`);
      router.refresh();
    });

  const tryJarvis = () =>
    startAsk(async () => {
      const text = question.trim() || (locale === "fr" ? "qu'est-ce que j'ai aujourd'hui ?" : "what do I have today?");
      try {
        const res = await commandAction(text, { page: "/onboarding" });
        setAnswer("error" in res ? res.error : "confirm" in res ? res.confirm.items.join(" ; ") : "choose" in res ? res.question : res.message);
      } catch {
        setAnswer(t.common.serverDown);
      }
    });

  const footer = (primary: React.ReactNode) => (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
      {step > 0 ? (
        <button type="button" onClick={back} className="mod-chip focus-ring">
          <ArrowLeft size={13} /> {t.common.back}
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {step < STEPS - 1 && (
          <button type="button" onClick={next} className="mod-chip focus-ring text-[var(--ink-dim)]">
            {t.common.skip}
          </button>
        )}
        {primary}
      </div>
    </div>
  );

  const permRow = (icon: React.ReactNode, title: string, why: string, state: Perm, onAllow: () => void) => (
    <div className="tile flex flex-wrap items-center gap-3 px-4 py-3.5">
      <span className="pilot-orb h-10 w-10 shrink-0" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
        <p className="text-xs leading-5 text-[var(--ink-dim)]">{state === "denied" ? o.denied : state === "unsupported" ? o.unsupported : why}</p>
      </div>
      {state === "granted" ? (
        <span className="flex items-center gap-1 text-xs font-semibold text-[#86d6a4]">
          <Check size={13} /> {o.granted}
        </span>
      ) : state === "idle" ? (
        <button type="button" onClick={onAllow} className="mod-chip mod-chip-gold focus-ring">
          {o.allow}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="relative min-h-dvh px-4 py-8 sm:py-12">
      <div className="glass-backdrop" aria-hidden />
      <div className="area-enter mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-gold" aria-live="polite">
            {fmt(o.progress, { n: step + 1, total: STEPS })}
          </p>
          <button type="button" onClick={finish} disabled={finishing} className="text-xs text-on-gold underline-offset-4 hover:underline">
            {o.skipAll}
          </button>
        </div>
        <div className="mb-6 h-1 overflow-hidden rounded-full bg-[rgba(0,0,0,0.18)]" aria-hidden>
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#a6761f,#ffe9a0)] transition-[width] duration-500" style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
        </div>

        <section className="glass-card p-6 sm:p-8">
          {step === 0 && (
            <div className="text-center">
              <div className="flex justify-center">
                <BrandMark size={64} />
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
                {o.welcomeTitle}
                {name ? <span className="block text-xl font-medium text-[var(--ink-dim)] sm:text-2xl">{name}</span> : null}
              </h1>
              <p className="mt-2 text-lg font-medium text-[#f0cd79]">{o.welcomeTagline}</p>
              <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[var(--ink-dim)]">{o.welcomeText}</p>
              <div className="mt-6 flex flex-col items-center gap-2">
                <span className={label}>{o.language}</span>
                <LanguageToggle />
              </div>
              <button type="button" onClick={next} className="mod-chip mod-chip-gold focus-ring mx-auto mt-8 px-6 py-3 text-sm">
                {o.start} <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step === 1 && (
            <>
              <h1 className="text-2xl font-semibold text-[var(--ink)]">{o.whoTitle}</h1>
              <p className="mt-1 text-sm leading-6 text-[var(--ink-dim)]">{o.whoText}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {MAIN.map((r) => {
                  const p = PROFILES.find((x) => x.type === r)!;
                  const on = has(r);
                  const copy = o.profiles[r as keyof typeof o.profiles];
                  return (
                    <button key={r} type="button" onClick={() => toggle(r)} aria-pressed={on} className={`ob-card glass-card focus-ring text-left ${on ? "ob-card-on" : ""}`}>
                      <span className="relative h-16 w-16 shrink-0">
                        <RenderImage src={p.image} className="mod-hero-img" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-base font-semibold text-[var(--ink)]">
                          {copy.label}
                          {on && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f0cd79] text-[#2a1a05]">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--ink-dim)]">{copy.pitch}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {footer(
                <button type="button" onClick={next} disabled={!roles.length} className="mod-chip mod-chip-gold focus-ring">
                  {t.common.continue} <ArrowRight size={13} />
                </button>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-2xl font-semibold text-[var(--ink)]">{o.detailsTitle}</h1>
              <p className="mt-1 text-sm text-[var(--ink-dim)]">{o.detailsText}</p>
              <div className="mt-5 space-y-5">
                {(has("etudiant") || !roles.length) && (
                  <fieldset className="space-y-3">
                    <legend className="mb-1 text-sm font-semibold text-[#f0cd79]">{o.profiles.etudiant.label}</legend>
                    <label className={label}>
                      {o.university}
                      <input value={about.university ?? ""} onChange={(e) => setAbout({ ...about, university: e.target.value })} placeholder={o.universityPh} className={field} />
                    </label>
                    <label className={label}>
                      {o.program}
                      <input value={about.program ?? ""} onChange={(e) => setAbout({ ...about, program: e.target.value })} placeholder={o.programPh} className={field} />
                    </label>
                    <label className={label}>
                      {o.brightspace}
                      <input value={brightspace} onChange={(e) => setBrightspace(e.target.value)} type="url" inputMode="url" placeholder="https://…brightspace.com/…" className={field} />
                      <span className="mt-1 block text-[0.7rem] leading-4 text-[var(--ink-faint)]">{o.brightspaceHelp}</span>
                    </label>
                  </fieldset>
                )}
                {has("sportif") && (
                  <fieldset className="space-y-3">
                    <legend className="mb-1 text-sm font-semibold text-[#f0cd79]">{o.profiles.sportif.label}</legend>
                    <label className={label}>
                      {o.sports}
                      <input value={sportsText} onChange={(e) => setSportsText(e.target.value)} placeholder={o.sportsPh} className={field} />
                    </label>
                    <div>
                      <span className={label}>{o.level}</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                          <button key={l} type="button" aria-pressed={about.level === l} data-on={about.level === l || undefined} onClick={() => setAbout({ ...about, level: l })} className="mod-tab focus-ring">
                            {o.levels[l]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className={label}>
                      {o.goal}
                      <input value={about.goal ?? ""} onChange={(e) => setAbout({ ...about, goal: e.target.value })} placeholder={o.goalPh} className={field} />
                    </label>
                  </fieldset>
                )}
                {(has("pro") || has("entrepreneur")) && (
                  <fieldset className="space-y-3">
                    <legend className="mb-1 text-sm font-semibold text-[#f0cd79]">{has("pro") ? o.profiles.pro.label : o.profiles.entrepreneur.label}</legend>
                    <div className={label}>
                      {o.workHours}
                      <div className="mt-1.5 flex items-center gap-2 text-[var(--ink-dim)]">
                        <span>{o.from}</span>
                        <input type="time" value={about.workStart ?? ""} onChange={(e) => setAbout({ ...about, workStart: e.target.value })} aria-label={`${o.workHours} — ${o.from}`} className="glass-pill focus-ring px-3 py-2 text-sm text-[var(--ink)]" />
                        <span>{o.to}</span>
                        <input type="time" value={about.workEnd ?? ""} onChange={(e) => setAbout({ ...about, workEnd: e.target.value })} aria-label={`${o.workHours} — ${o.to}`} className="glass-pill focus-ring px-3 py-2 text-sm text-[var(--ink)]" />
                      </div>
                    </div>
                    <div>
                      <span className={label}>{o.team}</span>
                      <div className="mt-1.5 flex gap-1.5">
                        {[true, false].map((v) => (
                          <button key={String(v)} type="button" aria-pressed={about.team === v} data-on={about.team === v || undefined} onClick={() => setAbout({ ...about, team: v })} className="mod-tab focus-ring">
                            {v ? t.common.yes : t.common.no}
                          </button>
                        ))}
                      </div>
                    </div>
                  </fieldset>
                )}
              </div>
              {footer(
                <button type="button" onClick={next} className="mod-chip mod-chip-gold focus-ring">
                  {t.common.continue} <ArrowRight size={13} />
                </button>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-2xl font-semibold text-[var(--ink)]">{o.placeTitle}</h1>
              <p className="mt-1 text-sm leading-6 text-[var(--ink-dim)]">{o.placeText}</p>
              <div className="mt-5 space-y-3">
                <label className={label}>
                  {o.timeZone}
                  {zones.length ? (
                    <select value={place.tz} onChange={(e) => setPlace({ ...place, tz: e.target.value })} className={`${field} cursor-pointer`}>
                      {zones.map((z) => (
                        <option key={z} value={z}>
                          {z.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={place.tz} onChange={(e) => setPlace({ ...place, tz: e.target.value })} className={field} />
                  )}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    {o.city}
                    <input value={place.city} onChange={(e) => setPlace({ ...place, city: e.target.value })} autoComplete="address-level2" className={field} />
                  </label>
                  <label className={label}>
                    {o.country}
                    <input value={place.country} onChange={(e) => setPlace({ ...place, country: e.target.value })} autoComplete="country-name" className={field} />
                  </label>
                </div>
              </div>
              {footer(
                <button type="button" onClick={next} className="mod-chip mod-chip-gold focus-ring">
                  {t.common.continue} <ArrowRight size={13} />
                </button>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h1 className="text-2xl font-semibold text-[var(--ink)]">{o.permsTitle}</h1>
              <div className="mt-5 space-y-3">
                {permRow(<Bell size={16} />, o.notifTitle, o.notifWhy, pushSupported() && vapidPublicKey ? notif : "unsupported", async () => {
                  const r = await enablePush(vapidPublicKey);
                  setNotif(r === "enabled" ? "granted" : r === "unsupported" ? "unsupported" : r === "dismissed" ? "idle" : "denied");
                })}
                {permRow(<Mic size={16} />, o.micTitle, o.micWhy, mic, async () => {
                  const r = await askMicrophone();
                  setMic(r === "granted" ? "granted" : r === "unsupported" ? "unsupported" : "denied");
                })}
              </div>
              {footer(
                <button type="button" onClick={next} className="mod-chip mod-chip-gold focus-ring">
                  {t.common.continue} <ArrowRight size={13} />
                </button>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <div className="flex flex-col items-center text-center">
                <span className="orom-orb flex h-20 w-20 items-center justify-center" aria-hidden>
                  <Sparkles size={26} className="text-[#2a1a05]" />
                </span>
                <h1 className="mt-4 text-2xl font-semibold text-[var(--ink)]">{o.jarvisTitle}</h1>
                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--ink-dim)]">{o.jarvisIntro}</p>
                <p className="mt-3 text-xs font-semibold text-[#f0cd79]">{o.jarvisTry}</p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  tryJarvis();
                }}
                className="mt-4 flex gap-2"
              >
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={o.jarvisPh} aria-label={o.jarvisPh} className="glass-pill focus-ring min-w-0 flex-1 px-4 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)]" />
                <button type="submit" disabled={asking} className="mod-chip mod-chip-gold focus-ring">
                  {asking ? <Loader2 size={13} className="animate-spin" /> : null} {o.ask}
                </button>
              </form>
              {answer && (
                <p role="status" className="tile mt-3 px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                  {answer}
                </p>
              )}
              {footer(
                <button type="button" onClick={finish} disabled={finishing} className="mod-chip mod-chip-gold focus-ring px-5 py-2.5">
                  {finishing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> {o.finishing}
                    </>
                  ) : (
                    <>
                      {o.finish} <ArrowRight size={13} />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
