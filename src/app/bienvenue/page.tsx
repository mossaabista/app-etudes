import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { ArrowRight, Check, FileText, Lock, Wand2 } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { HeroOrbit } from "@/components/landing/HeroOrbit";
import { CaptureDemo } from "@/components/landing/CaptureDemo";
import { AREAS } from "@/lib/task-areas";
import { PROFILES } from "@/lib/profile";
import { BRAND } from "@/lib/brand";
import "./landing.css";

const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display" });

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.promise,
};

/** The fixed parts of the demo day, then what the Pilot slots around them. */
const FIXED = [
  { title: "MCG 2530 — Cours", from: 9, to: 10.33 },
  { title: "GNG 1503 — Labo", from: 13, to: 16 },
  { title: "Souper en famille", from: 18.5, to: 19.5 },
];
const PLACED = [
  { title: "Devoir 3 — thermo", from: 10.5, to: 12, color: "#3b82f6" },
  { title: "Muscu — haut du corps", from: 16.25, to: 17.25, color: "#ef4444" },
  { title: "Réviser le quiz 2", from: 19.75, to: 21, color: "#8b5cf6" },
  { title: "Lecture — 20 pages", from: 21.25, to: 22, color: "#10b981" },
];
const DAY_START = 8;
const DAY_END = 22.5;
const pos = (h: number) => `${((h - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
const hhmm = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

const FOUND = [
  { title: "Quiz 1", type: "Quiz", date: "2 oct.", weight: "5 %" },
  { title: "Examen de mi-session", type: "Examen", date: "23 oct.", weight: "25 %" },
  { title: "Rapport de labo 3", type: "Labo", date: "6 nov.", weight: "10 %" },
  { title: "Projet de conception", type: "Projet", date: "27 nov.", weight: "20 %" },
  { title: "Examen final", type: "Examen", date: "12 déc.", weight: "40 %" },
];

const DEPTH = [
  { area: "sante", title: "Un nutritionniste dans la poche", text: "Tes besoins calculés (Mifflin–St Jeor), un menu du jour à tes portions, et le pourquoi de chaque chiffre." },
  { area: "sante", title: "Ta santé d'un coup d'œil", text: "Activité, sommeil, hydratation et poids comparés à la semaine dernière, comme sur ton téléphone." },
  { area: "esprit", title: "Prière et Qibla", text: "Horaires calculés pour ta position, méthode au choix, boussole vers la Qibla et suivi des cinq prières." },
  { area: "quotidien", title: "Budget 50/30/20", text: "Dépenses classées, liste de courses rangée par rayon, rendez-vous qui reviennent tout seuls." },
];

export default function LandingPage() {
  return (
    <div className={`ld ${display.variable}`}>
      <div className="ld-bg" aria-hidden />

      <header className="ld-nav">
        <Link href="/bienvenue" className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="text-sm font-semibold tracking-[0.28em] text-[var(--ink)]">AURUM</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-[var(--ink-dim)] md:flex">
          <a href="#capture">Saisie</a>
          <a href="#pilote">Le Pilote</a>
          <a href="#syllabus">Syllabus</a>
          <a href="#sections">Sections</a>
          <a href="#profils">Profils</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="ld-btn ld-btn-ghost">
            Connexion
          </Link>
          <Link href="/register" className="ld-btn ld-btn-gold">
            Commencer
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="ld-hero">
          <div className="ld-hero-copy">
            <p className="ld-eyebrow ld-rise" style={{ "--d": "0ms" } as React.CSSProperties}>
              L&apos;agenda qui s&apos;organise tout seul
            </p>
            <h1 className="ld-title ld-rise" style={{ "--d": "120ms" } as React.CSSProperties}>
              Le temps
              <br />
              est <em className="ld-gold">d&apos;or.</em>
            </h1>
            <p className="ld-lead ld-rise" style={{ "--d": "260ms" } as React.CSSProperties}>
              Tu écris une phrase. Aurum trouve le créneau, la bonne case et la bonne couleur — puis il planifie le reste de ta journée autour.
            </p>
            <div className="ld-rise flex flex-wrap items-center gap-3" style={{ "--d": "380ms" } as React.CSSProperties}>
              <Link href="/register" className="ld-btn ld-btn-gold ld-btn-lg">
                Commencer gratuitement <ArrowRight size={16} />
              </Link>
              <a href="#pilote" className="ld-btn ld-btn-ghost ld-btn-lg">
                Voir le Pilote
              </a>
            </div>
            <ul className="ld-trust ld-rise" style={{ "--d": "500ms" } as React.CSSProperties}>
              <li>
                <Check size={13} /> Gratuit pendant la bêta
              </li>
              <li>
                <Check size={13} /> Aucune publicité
              </li>
              <li>
                <Check size={13} /> Tes données exportables
              </li>
            </ul>
          </div>
          <HeroOrbit />
        </section>

        {/* Quick capture */}
        <section id="capture" className="ld-section ld-split">
          <div>
            <p className="ld-kicker">01 · Saisie</p>
            <h2 className="ld-h2">
              Une phrase,
              <br />
              <em>c&apos;est rangé.</em>
            </h2>
            <p className="ld-p">
              « Muscu demain 18 h pendant 1 h. » Aurum comprend le jour, l&apos;heure, la durée et la section. La tâche part dans Sport, le créneau dans ton calendrier,
              avec sa couleur. Partout dans l&apos;app : touche <kbd className="ld-kbd">N</kbd>.
            </p>
          </div>
          <CaptureDemo />
        </section>

        {/* The Pilot */}
        <section id="pilote" className="ld-section ld-split ld-split-rev">
          <div>
            <p className="ld-kicker">02 · Le Pilote</p>
            <h2 className="ld-h2">
              Ta journée,
              <br />
              <em>planifiée pour toi.</em>
            </h2>
            <p className="ld-p">
              Le Pilote lit tes cours, tes rendez-vous et tes échéances, puis place le travail dans les trous — le plus urgent d&apos;abord, dix minutes de battement
              entre deux blocs, une pause après une heure et demie d&apos;affilée. Un geste pour accepter, un geste pour tout annuler.
            </p>
            <ul className="ld-bullets">
              <li>Priorise par échéance et par poids de l&apos;évaluation</li>
              <li>Respecte tes cours, tes labos et ta vie</li>
              <li>Chaque bloc garde la couleur de sa section</li>
            </ul>
          </div>
          <div className="ld-day glass-card">
            <div className="ld-day-head">
              <span className="text-sm font-semibold text-[var(--ink)]">Mardi</span>
              <span className="ld-pilot-tag">
                <Wand2 size={12} /> Le Pilote planifie…
              </span>
            </div>
            <div className="ld-day-body">
              {[8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                <span key={h} className="ld-hour" style={{ top: pos(h) }}>
                  {h} h
                </span>
              ))}
              {FIXED.map((b) => (
                <div key={b.title} className="ld-block ld-block-fixed" style={{ top: pos(b.from), height: `calc(${pos(b.to)} - ${pos(b.from)})` }}>
                  <b>{b.title}</b>
                  <span>
                    {hhmm(b.from)} – {hhmm(b.to)}
                  </span>
                </div>
              ))}
              {PLACED.map((b, i) => (
                <div
                  key={b.title}
                  className="ld-block ld-block-pilot"
                  style={{ top: pos(b.from), height: `calc(${pos(b.to)} - ${pos(b.from)})`, "--c": b.color, "--i": i } as React.CSSProperties}
                >
                  <b>{b.title}</b>
                  <span>
                    {hhmm(b.from)} – {hhmm(b.to)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Syllabus */}
        <section id="syllabus" className="ld-section ld-split">
          <div>
            <p className="ld-kicker">03 · Syllabus</p>
            <h2 className="ld-h2">
              Dépose le PDF.
              <br />
              <em>Ta session est prête.</em>
            </h2>
            <p className="ld-p">
              Le cours, le professeur, chaque examen, devoir et labo avec sa date et sa pondération, et l&apos;horaire de la semaine : tout est lu, tu vérifies, tu
              importes. Les rappels arrivent avant les remises, pas après.
            </p>
          </div>
          <div className="ld-syl">
            <div className="ld-pdf">
              <FileText size={22} className="text-[#f0cd79]" />
              <span className="ld-pdf-name">MCG2530_plan_de_cours.pdf</span>
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i} className="ld-pdf-line" style={{ width: `${55 + ((i * 37) % 40)}%` }} />
              ))}
              <span className="ld-scan" />
            </div>
            <ul className="ld-found">
              {FOUND.map((f, i) => (
                <li key={f.title} style={{ "--i": i } as React.CSSProperties}>
                  <span className="ld-found-type">{f.type}</span>
                  <span className="min-w-0 flex-1 truncate">{f.title}</span>
                  <span className="text-[var(--ink-dim)]">{f.date}</span>
                  <span className="ld-found-w">{f.weight}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Sections */}
        <section id="sections" className="ld-section">
          <p className="ld-kicker text-center">04 · Toute ta vie, huit dossiers</p>
          <h2 className="ld-h2 text-center">
            Pas seulement tes cours.
            <br />
            <em>Tout ce qui compte.</em>
          </h2>
          <div className="ld-areas">
            {AREAS.map((a, i) => (
              <div key={a.key} className="ld-area" style={{ "--c": a.color, "--i": i } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.subs[0].visual.src} alt="" loading="lazy" />
                <b>{a.front}</b>
                <span>{a.blurb}</span>
              </div>
            ))}
          </div>
          <div className="ld-depth">
            {DEPTH.map((d) => (
              <div key={d.title} className="glass-card ld-depth-card">
                <i style={{ background: AREAS.find((a) => a.key === d.area)?.color }} />
                <b>{d.title}</b>
                <p>{d.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Profiles */}
        <section id="profils" className="ld-section">
          <p className="ld-kicker text-center">05 · Réglé pour toi</p>
          <h2 className="ld-h2 text-center">
            Étudiant, pro, entrepreneur
            <br />
            <em>ou sportif.</em>
          </h2>
          <div className="ld-profiles">
            {PROFILES.map((p) => (
              <div key={p.type} className="glass-card ld-profile">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt="" loading="lazy" />
                <b>{p.label}</b>
                <p>{p.pitch}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Closing */}
        <section className="ld-section ld-cta">
          <BrandMark size={56} />
          <h2 className="ld-h2 text-center">
            Reprends ton temps.
            <br />
            <em className="ld-gold">Il vaut de l&apos;or.</em>
          </h2>
          <Link href="/register" className="ld-btn ld-btn-gold ld-btn-lg">
            Créer mon compte <ArrowRight size={16} />
          </Link>
          <p className="ld-fine">
            <Lock size={12} /> Gratuit pendant la bêta · Sans carte bancaire · Export complet de tes données à tout moment
          </p>
        </section>
      </main>

      <footer className="ld-foot">
        <span>© {new Date().getFullYear()} Aurum</span>
        <span>{BRAND.tagline}</span>
        <Link href="/login">Connexion</Link>
      </footer>
    </div>
  );
}
