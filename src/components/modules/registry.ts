import type { ComponentType } from "react";
import type { ModuleProps } from "@/components/modules/kit";
import type { Locale } from "@/i18n/config";
import { Corps, Hygiene, SANTE_SOURCES, Sommeil, Sport } from "@/components/modules/sections/sante";
import { NUTRITION_SOURCES, Nutrition } from "@/components/modules/sections/nutrition";
import { ESPRIT_SOURCES, Gratitude, Lecture, Meditation, Priere } from "@/components/modules/sections/esprit";
import { Courses, Finances, Maison, RendezVous } from "@/components/modules/sections/quotidien";
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
} from "@/components/modules/sections/work";
import { Taches } from "@/components/modules/sections/tasks";

/** The line under each title (its intro) and this app's own references live in the modulesB translations, keyed like below. */
export interface ModuleDef {
  Component: ComponentType<ModuleProps>;
  /** References under the page: one list, or one per language. */
  sources?: readonly string[] | Record<Locale, readonly string[]>;
  /** Health content carries the "not medical advice" note. */
  health?: boolean;
  /** The section is itself a task list: no separate task box underneath. */
  ownsTasks?: boolean;
}

/** Every section page, keyed "area:sub" like Task.category. */
export const MODULES: Record<string, ModuleDef> = {
  "travail:taches": { Component: Taches, ownsTasks: true },
  "travail:reunions": { Component: Reunions },
  "travail:livrables": { Component: Livrables },
  "travail:suivis": { Component: Suivis },

  "equipe:membres": { Component: Membres },
  "equipe:delegue": { Component: Delegue },
  "equipe:reunions": { Component: ReunionsEquipe },
  "equipe:suivi": { Component: SuiviEquipe },

  "projets:general": { Component: GeneralProjets },

  "apprentissage:lectures": { Component: Lectures },
  "apprentissage:formations": { Component: Formations },
  "apprentissage:competences": { Component: Competences },

  "sante:corps": { Component: Corps, sources: SANTE_SOURCES.corps, health: true },
  "sante:sport": { Component: Sport, sources: SANTE_SOURCES.sport, health: true },
  "sante:nutrition": { Component: Nutrition, sources: NUTRITION_SOURCES, health: true },
  "sante:sommeil": { Component: Sommeil, sources: SANTE_SOURCES.sommeil, health: true },
  "sante:hygiene": { Component: Hygiene, sources: SANTE_SOURCES.hygiene, health: true },

  "esprit:priere": { Component: Priere, sources: ESPRIT_SOURCES.priere },
  "esprit:lecture": { Component: Lecture, sources: ESPRIT_SOURCES.lecture },
  "esprit:meditation": { Component: Meditation, sources: ESPRIT_SOURCES.meditation },
  "esprit:gratitude": { Component: Gratitude, sources: ESPRIT_SOURCES.gratitude },

  "social:famille": { Component: Famille },
  "social:amis": { Component: Amis },
  "social:evenements": { Component: Evenements },

  "quotidien:courses": { Component: Courses },
  "quotidien:maison": { Component: Maison },
  "quotidien:finances": { Component: Finances },
  "quotidien:rendezvous": { Component: RendezVous },
};
