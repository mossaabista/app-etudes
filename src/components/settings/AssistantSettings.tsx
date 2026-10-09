"use client";

import { Mic } from "lucide-react";
import { VoiceSettings } from "@/components/settings/VoiceSettings";

const EXAMPLES = [
  "Qu'est-ce que j'ai aujourd'hui ?",
  "Ajoute du sport samedi à 10h et décale le dentiste à mardi",
  "Crée un projet Déménagement et découpe-le en étapes",
  "Organise ma semaine autour de mes cours",
  "J'ai couru 30 minutes et bu deux verres d'eau",
  "Fais-moi un plan de révision pour mon examen de chimie",
  "Retiens que je préfère les réunions courtes le matin",
];

/** The assistant: whether it is on, how it speaks, and what it can do. */
export function AssistantSettings({ enabled }: { enabled: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-[#7fe0b0] shadow-[0_0_8px_#7fe0b0]" : "bg-[#9d8455]"}`} aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-[var(--ink)]">
          {enabled
            ? "Assistant intelligent actif : OROM comprend les phrases libres et fait travailler ses agents spécialisés (études, planification, projets, sport, nutrition…)."
            : "Mode simple : clé d'IA non configurée sur ce serveur. Les commandes courantes (ajouter, déplacer, supprimer, planifier, espaces, mémoire, radar) restent comprises sans IA."}
        </p>
      </div>
      <VoiceSettings />
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
