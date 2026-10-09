"use client";

import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";

/** Ask the global assistant from anywhere: open it with a sentence, and run it. */
export function ask(text: string, run = true) {
  window.dispatchEvent(new CustomEvent("aurum:ask", { detail: { text, run } }));
}

// What people ask for in each section — tapping one runs it.
const SUGGESTIONS: Record<string, string[]> = {
  "travail:taches": ["Planifie mes tâches de la journée", "Ajoute « préparer la présentation » pour jeudi, priorité haute", "Qu'est-ce qui est le plus urgent ?"],
  "travail:reunions": ["Planifie une réunion d'équipe mardi à 10h pendant 45 min", "Décale ma prochaine réunion d'une heure", "Quelles réunions ai-je cette semaine ?"],
  "travail:livrables": ["Ajoute le livrable « rapport final » à rendre vendredi 17h", "Qu'est-ce que je dois livrer cette semaine ?"],
  "travail:suivis": ["Rappelle-moi de relancer Marc jeudi", "Qui dois-je relancer ?"],
  "equipe:delegue": ["Rappelle-moi de vérifier ce que Sarah a fait vendredi"],
  "equipe:reunions": ["Planifie un point individuel avec Sarah lundi 9h"],
  "sante:sport": ["J'ai couru 30 minutes", "Ajoute une séance de muscu demain à 18h", "Planifie 3 séances cette semaine"],
  "sante:nutrition": ["J'ai mangé un bol de riz au poulet", "J'ai bu deux verres d'eau", "Ajoute les ingrédients du menu aux courses"],
  "sante:sommeil": ["J'ai dormi 7 heures", "À quelle heure me coucher ce soir ?"],
  "sante:corps": ["Je pèse 72 kilos", "Rendez-vous chez le médecin mardi à 9h"],
  "sante:hygiene": ["Rendez-vous chez le dentiste le 20 à 14h"],
  "quotidien:courses": ["Ajoute lait, œufs et pommes aux courses", "Courses samedi matin"],
  "quotidien:finances": ["J'ai dépensé 14 $ au resto", "J'ai reçu ma bourse de 800 $", "Rappelle-moi de payer le loyer le 1er"],
  "quotidien:maison": ["Ménage samedi à 10h", "Rappelle-moi de changer le filtre ce mois-ci"],
  "quotidien:rendezvous": ["Rendez-vous chez le dentiste mardi à 14h", "Quels rendez-vous ai-je cette semaine ?"],
  "social:famille": ["Appeler maman dimanche à 18h", "Rappelle-moi l'anniversaire de papa"],
  "social:amis": ["Café avec Karim samedi à 15h"],
  "social:evenements": ["Mariage de Sami le 14 novembre"],
  "esprit:priere": ["Ajoute la prière du vendredi à 13h"],
  "esprit:meditation": ["Méditation demain à 7h pendant 10 min"],
  "apprentissage:lectures": ["Lecture 20 minutes ce soir", "Ajoute un livre à lire"],
  "apprentissage:formations": ["Planifie 2 heures de formation samedi"],
};

/**
 * The assistant, at the top of a section: ask in words, or tap a suggestion. It knows
 * which section it is in, so "ajoute une séance demain 18h" lands here.
 */
export function SectionAssistant({ section, label }: { section: string; label: string }) {
  const [text, setText] = useState("");
  const chips = SUGGESTIONS[section] ?? [`Ajoute une tâche dans ${label} pour demain`, `Qu'est-ce que j'ai à faire dans ${label} ?`];
  return (
    <section className="section-ask glass-card mb-4 p-3.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          ask(text.trim());
          setText("");
        }}
        className="flex items-center gap-2.5"
      >
        <Sparkles size={16} className="ml-1 shrink-0 text-[#f0cd79]" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Demande à l'assistant, pour ${label}…`}
          aria-label={`Demander à l'assistant pour ${label}`}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("aurum:listen"))} aria-label="Dicter" className="qc-mic-inline focus-ring h-8 w-8">
          <Mic size={15} />
        </button>
      </form>
      <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => ask(c)} className="mod-chip focus-ring shrink-0 text-xs">
            {c}
          </button>
        ))}
      </div>
    </section>
  );
}
