"use client";

import { useEffect, useState } from "react";
import { Mic, Volume2 } from "lucide-react";

const EXAMPLES = [
  "Ajoute du sport samedi à 10h et décale le dentiste à mardi",
  "Je ne fais plus de sport aujourd'hui",
  "Crée trois dossiers pour MAT1320, PHY1121 et ITI1100",
  "Crée-moi un secteur Guitare avec un journal de pratique",
  "J'ai couru 30 minutes et bu deux verres d'eau",
  "Fais-moi un plan de révision pour mon examen de chimie",
  "Qu'est-ce que j'ai demain ?",
];

/** The assistant: whether it is on, whether it answers out loud, and what it can do. */
export function AssistantSettings({ enabled }: { enabled: boolean }) {
  const [voice, setVoice] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setVoice(localStorage.getItem("aurum-voice") === "on");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggle = () => {
    const next = !voice;
    setVoice(next);
    try {
      localStorage.setItem("aurum-voice", next ? "on" : "off");
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-[#7fe0b0] shadow-[0_0_8px_#7fe0b0]" : "bg-[#9d8455]"}`} aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-[var(--ink)]">
          {enabled ? "Assistant intelligent actif : il comprend les phrases libres, agit partout et répond à tes questions." : "Mode simple : les commandes courantes sont comprises sans intelligence artificielle."}
        </p>
      </div>
      <label className="tile flex cursor-pointer items-center gap-3 px-4 py-3">
        <Volume2 size={16} className="text-[#f0cd79]" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[var(--ink)]">Répondre à voix haute</span>
          <span className="block text-xs text-[var(--ink-dim)]">Quand tu parles au micro, il répond toujours à voix haute ; active ceci pour qu&apos;il le fasse aussi quand tu écris.</span>
        </span>
        <input type="checkbox" checked={voice} onChange={toggle} className="h-5 w-5 accent-[#e8bf63]" />
      </label>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-dim)]">
          <Mic size={13} className="text-[#f0cd79]" /> Essaie par exemple
        </p>
        <ul className="space-y-1">
          {EXAMPLES.map((e) => (
            <li key={e} className="text-xs text-[var(--ink-dim)]">
              « {e} »
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
