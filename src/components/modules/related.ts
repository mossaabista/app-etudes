/**
 * Sections whose page also reads another section's rows: Sport turns minutes into
 * calories with the weight logged under Corps, Nutrition fills the Courses list.
 */
export const relatedModules: Record<string, string[]> = {
  "sante:sport": ["sante:corps"],
  "sante:corps": ["sante:sport", "sante:sommeil", "sante:nutrition", "sante:hygiene"],
  "sante:nutrition": ["quotidien:courses", "sante:corps"],
  "equipe:suivi": ["equipe:delegue", "equipe:membres"],
  "equipe:delegue": ["equipe:membres"],
};
