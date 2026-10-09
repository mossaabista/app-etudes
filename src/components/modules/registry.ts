import type { ComponentType } from "react";
import type { ModuleProps } from "@/components/modules/kit";
import { Corps, Hygiene, SANTE_SOURCES, Sommeil, Sport } from "@/components/modules/sections/sante";
import { NUTRITION_SOURCES, Nutrition } from "@/components/modules/sections/nutrition";
import { ESPRIT_SOURCES, Gratitude, Lecture, Meditation, Priere } from "@/components/modules/sections/esprit";
import { Courses, Finances, Maison, QUOTIDIEN_SOURCES, RendezVous } from "@/components/modules/sections/quotidien";
import { Amis, Evenements, Famille } from "@/components/modules/sections/social";
import {
  Competences,
  Delegue,
  Formations,
  GeneralProjets,
  Lectures,
  Livrables,
  Membres,
  Reunions,
  ReunionsEquipe,
  SuiviEquipe,
  Suivis,
  WORK_SOURCES,
} from "@/components/modules/sections/work";
import { Taches } from "@/components/modules/sections/tasks";

export interface ModuleDef {
  /** One line under the title: what this page is for. */
  intro: string;
  Component: ComponentType<ModuleProps>;
  sources?: string[];
  /** Health content carries the "not medical advice" note. */
  health?: boolean;
  /** The section is itself a task list: no separate task box underneath. */
  ownsTasks?: boolean;
}

/** Every section page, keyed "area:sub" like Task.category. */
export const MODULES: Record<string, ModuleDef> = {
  "travail:taches": { intro: "Ton gestionnaire de tâches : aujourd'hui, à venir, priorités, sous-tâches découpées par l'assistant, et un minuteur de concentration lié à la tâche.", Component: Taches, sources: WORK_SOURCES.taches, ownsTasks: true },
  "travail:reunions": { intro: "Planifier les réunions, préparer l'ordre du jour, garder les notes et les actions.", Component: Reunions },
  "travail:livrables": { intro: "Chaque livrable, de « à faire » à « livré », avec sa date de remise.", Component: Livrables },
  "travail:suivis": { intro: "Ce que tu attends des autres, et quand relancer.", Component: Suivis },

  "equipe:membres": { intro: "Qui fait partie de l'équipe et comment le joindre.", Component: Membres },
  "equipe:delegue": { intro: "Les tâches confiées : à qui, pour quand, et où ça en est.", Component: Delegue },
  "equipe:reunions": { intro: "Réunions d'équipe et points individuels, avec leurs comptes rendus.", Component: ReunionsEquipe },
  "equipe:suivi": { intro: "L'état de l'équipe en un coup d'œil, et les objectifs chiffrés.", Component: SuiviEquipe },

  "projets:general": { intro: "Les idées de projets à lancer, et les tâches qui n'appartiennent à aucun projet.", Component: GeneralProjets },

  "apprentissage:lectures": { intro: "Les livres en cours, la page atteinte et ceux terminés cette année.", Component: Lectures },
  "apprentissage:formations": { intro: "Cours, certifications et MOOC, avec leur progression.", Component: Formations },
  "apprentissage:competences": { intro: "Les compétences à développer, ton niveau et ta pratique.", Component: Competences, sources: WORK_SOURCES.competences },

  "sante:corps": { intro: "Ton résumé santé de la semaine, puis poids, IMC, fréquence cardiaque au repos et tour de taille, suivis dans le temps.", Component: Corps, sources: SANTE_SOURCES.corps, health: true },
  "sante:sport": { intro: "Programmes, sports et exercices, à planifier dans ton calendrier, et ta semaine face aux recommandations de l'OMS.", Component: Sport, sources: SANTE_SOURCES.sport, health: true },
  "sante:nutrition": { intro: "Ton nutritionniste : tes besoins calculés, un menu du jour aux portions justes, ton bilan en temps réel et le pourquoi de chaque chiffre.", Component: Nutrition, sources: NUTRITION_SOURCES, health: true },
  "sante:sommeil": { intro: "Tes nuits, leur régularité, l'heure idéale du coucher et les bonnes habitudes.", Component: Sommeil, sources: SANTE_SOURCES.sommeil, health: true },
  "sante:hygiene": { intro: "La routine quotidienne et ce qu'il faut renouveler régulièrement.", Component: Hygiene, sources: SANTE_SOURCES.hygiene, health: true },

  "esprit:priere": { intro: "Les horaires de prière calculés pour ta ville, la Qibla et le suivi des cinq prières.", Component: Priere, sources: ESPRIT_SOURCES.priere },
  "esprit:lecture": { intro: "Ta progression dans le Coran, un plan de khatm et tes autres lectures.", Component: Lecture, sources: ESPRIT_SOURCES.lecture },
  "esprit:meditation": { intro: "Des exercices de respiration guidés et le suivi de ta pratique.", Component: Meditation, sources: ESPRIT_SOURCES.meditation },
  "esprit:gratitude": { intro: "Trois choses pour lesquelles tu es reconnaissant, chaque jour.", Component: Gratitude, sources: ESPRIT_SOURCES.gratitude },

  "social:famille": { intro: "Prendre des nouvelles de ta famille au bon rythme, et ne rater aucun anniversaire.", Component: Famille },
  "social:amis": { intro: "Garder le contact avec tes amis, et leurs anniversaires.", Component: Amis },
  "social:evenements": { intro: "Les événements à venir, leur compte à rebours et ce qu'il faut préparer.", Component: Evenements },

  "quotidien:courses": { intro: "Ta liste de courses, rangée par rayon.", Component: Courses },
  "quotidien:maison": { intro: "L'entretien qui revient régulièrement, et les petits travaux.", Component: Maison, sources: QUOTIDIEN_SOURCES.maison },
  "quotidien:finances": { intro: "Revenus, dépenses et épargne du mois, et la règle 50/30/20.", Component: Finances, sources: QUOTIDIEN_SOURCES.finances },
  "quotidien:rendezvous": { intro: "Tes rendez-vous, envoyés directement dans ton calendrier.", Component: RendezVous },
};
