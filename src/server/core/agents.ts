/**
 * OROM's specialised agents. The user talks to one assistant, OROM; behind it, each
 * agent owns a domain: its instructions, the tools (server operations) it may call, the
 * slice of the user's data it needs to see, and limits. Agents are data, not processes:
 * the router picks the few a request needs, one model call receives the union of their
 * instructions and tools, and the server runs, checks and records every action. No agent
 * calls another, so there is no delegation loop and the cost of a request is bounded.
 *
 * Pure: no database, no network. Tested in tests/core-agents.test.ts.
 */

/** Every operation the server knows how to run (src/server/assistant-run.ts). */
export const OPS = [
  "create_event",
  "create_task",
  "move",
  "delete",
  "rename",
  "complete",
  "create_course",
  "add_area",
  "remove_area",
  "rename_area",
  "add_section",
  "remove_section",
  "rename_section",
  "log",
  "plan_revision",
  "plan_day",
  "plan_week",
  "navigate",
  "create_workspace",
  "create_project",
  "add_milestone",
  "plan_workouts",
] as const;
export type Op = (typeof OPS)[number];

/** Slices of the user's data an agent may need in front of it. */
/** "documents": the passages of the user's documents that best match the request. */
export type ContextNeed = "agenda" | "academic" | "sectors" | "projects" | "radar" | "documents" | "nutrition";

export interface AgentDef {
  id: string;
  name: string;
  /** Bumped when the instructions or tools change, so a logged run says what produced it. */
  version: number;
  domain: string;
  /** What makes a request this agent's business (accents folded, lower case). */
  triggers: RegExp;
  tools: Op[];
  needs: ContextNeed[];
  instructions: string[];
  /** Longest the model call may take when this agent is involved. */
  timeoutMs: number;
}

const BLOCKS_HELP =
  "blocks (section sur mesure) : liste d'objets parmi {type:'checklist', title, items:[...]} (cases à cocher chaque jour), {type:'log', title, unit, goal, period:'day'|'week'} (journal chiffré + graphique), {type:'list', title, placeholder} (liste à cocher), {type:'recurring', title, items:[{label, every (jours)}]}, {type:'tips', title, items:[conseils d'expert]}, {type:'notes', title}. 3 à 6 blocs utiles et concrets.";

const AGENDA_RULES = [
  "Agenda : avec une heure = create_event (durée par défaut : 1 h sport, 30 min appel/réunion, 1 h sinon) ; sans heure = create_task ; « rendre/remettre » = create_task deadline=true ; « rappelle-moi » = create_task. « annule… », « je ne fais plus de X aujourd'hui » = delete de tous les éléments concernés. Pour modifier ou supprimer, uniquement des id de l'agenda fourni.",
  "« Décale-la / mets-la à 11 h » parle de l'élément dont il vient d'être question dans la conversation : move sur son id, jamais un nouvel élément.",
];

export const AGENTS: AgentDef[] = [
  {
    id: "personal",
    name: "Assistant personnel",
    version: 1,
    domain: "Journée, rappels, routines, priorités, bilans et organisation personnelle.",
    triggers: /\b(rappel|rappelle|routine|briefing|bilan|qu'?est-ce que j'?ai|ma journee|aujourd'?hui|demain|priorit|objectif|remind|today|tomorrow|secteur|section)/,
    tools: ["create_task", "create_event", "move", "delete", "rename", "complete", "log", "add_area", "remove_area", "rename_area", "add_section", "remove_section", "rename_section", "navigate"],
    needs: ["agenda", "sectors", "radar"],
    instructions: [
      ...AGENDA_RULES,
      "Bilan ou question sur la journée : aucune action, réponse complète dans reply à partir de l'agenda fourni (cours, remises, tâches, et ce qui est à surveiller). N'invente aucun événement.",
      "Secteurs : ajouter un secteur ou une section → add_area / add_section ; si la bibliothèque a la section, utilise library, sinon une section sur mesure avec label, image, intro et blocks. " + BLOCKS_HELP,
      "« retire Esprit » → remove_area (rien n'est supprimé, seulement masqué).",
      "Noter ce qui s'est passé → log : eau (water, verres), poids (weight, kg), sommeil (sleep, heures), dépense (expense, title = libellé), revenu (income).",
    ],
    timeoutMs: 30000,
  },
  {
    id: "productivity",
    name: "Productivité et planification",
    version: 1,
    domain: "Priorités, charge, plans du jour et de la semaine, conflits, replanification.",
    triggers: /\b(planifi|organise|plan|semaine|journee|priorit|decale|deplace|repousse|reporte|creneau|libre|charge|retard|risque|conflit|urgent|schedule|week|reschedule|postpone)/,
    tools: ["plan_day", "plan_week", "move", "create_task", "create_event", "complete", "delete", "rename", "navigate"],
    needs: ["agenda", "radar"],
    instructions: [
      ...AGENDA_RULES,
      "« organise / planifie ma journée » → plan_day (date). « planifie ma semaine » → plan_week (date = premier jour, aujourd'hui par défaut). Les plans ne déplacent jamais cours, rendez-vous ni échéances : ils ajoutent du temps de travail dans les créneaux libres.",
      "« quelles sont mes priorités ? » : réponds à partir des échéances, du radar de risque et des tâches en retard, en disant pourquoi chacune passe en premier.",
      "« déplace mes tâches non urgentes » : move uniquement des tâches (t:…) dont l'échéance n'est pas proche ; ne touche jamais aux cours ni aux réunions.",
    ],
    timeoutMs: 30000,
  },
  {
    id: "academic",
    name: "Études",
    version: 1,
    domain: "Cours, syllabus, devoirs, examens, labos, révisions et semestre.",
    triggers: /\b(cours|syllabus|plan de cours|examen|exam|quiz|intra|mi-?session|final|devoir|labo|tp|revis|etud|semestre|session|note|course|assignment|study|lecture|prof)/,
    tools: ["create_course", "plan_revision", "create_task", "create_event", "move", "complete", "create_workspace", "navigate"],
    needs: ["agenda", "academic"],
    instructions: [
      "Cours : « crée des dossiers pour MAT1320 et PHY1121 » = un create_course par cours (code, nom complet si tu le connais).",
      "« fais-moi un plan de révision pour… » → plan_revision avec les ids des évaluations concernées (vide = toutes celles à venir).",
      "« organise mon semestre » → create_workspace template semestre : le serveur part des vrais cours ; n'invente aucun cours, aucune date, aucune pondération.",
      "Une pondération inconnue reste inconnue ; ne confonds pas le poids d'une évaluation et le temps qu'elle demande.",
      "Importer un syllabus se fait sur la page Syllabus : navigate vers /syllabus.",
    ],
    timeoutMs: 30000,
  },
  {
    id: "professional",
    name: "Travail",
    version: 1,
    domain: "Réunions, livrables, suivis, clients et journée de travail.",
    triggers: /\b(reunion|meeting|client|livrable|travail|boulot|bureau|collegue|rapport|suivi|relance|deliverable|work|call|visio|rendez-vous)/,
    tools: ["create_event", "create_task", "move", "delete", "rename", "complete", "create_workspace", "navigate"],
    needs: ["agenda", "projects"],
    instructions: [
      ...AGENDA_RULES,
      "Réunion : create_event dans la section travail:reunions (ou equipe:reunions), titre « Réunion — sujet ». N'invente ni participants ni décisions.",
      "« organise mon activité de freelance » → create_workspace template freelance (sans client fictif).",
      "Un brouillon n'est pas un envoi : tu ne peux envoyer aucun message ni courriel.",
    ],
    timeoutMs: 30000,
  },
  {
    id: "projects",
    name: "Gestion de projet",
    version: 1,
    domain: "Projets, jalons, découpage en tâches, avancement et risques.",
    triggers: /\b(projet|project|jalon|milestone|etape|decoupe|decompose|avancement|livraison)/,
    tools: ["create_project", "add_milestone", "create_task", "create_workspace", "move", "complete", "navigate"],
    needs: ["projects", "agenda"],
    instructions: [
      "Nouveau projet : create_workspace template projet avec name (le serveur crée le projet, trois jalons et des tâches de départ). Pour un projet simple sans structure : create_project (title, date d'échéance si donnée).",
      "Ajouter un jalon : add_milestone avec project = id exact p:… du projet et title (date si donnée).",
      "Découper un projet en tâches : create_task avec project = id p:… pour chaque tâche, titres concrets et actionnables.",
      "Résumé ou risques d'un projet : réponds à partir des projets fournis (jalons, tâches en retard), sans rien inventer.",
    ],
    timeoutMs: 30000,
  },
  {
    id: "team",
    name: "Coordination d'équipe",
    version: 1,
    domain: "Membres des projets, tâches en retard, avancement de l'équipe.",
    triggers: /\b(equipe|team|membre|collaborat|assign|qui fait|workload)/,
    tools: ["create_task", "create_event", "navigate"],
    needs: ["projects"],
    instructions: [
      "Tu ne vois que les projets de l'utilisateur et les membres qu'il y a inscrits (noms saisis à la main) : ce ne sont pas des comptes, tu ne peux ni leur écrire ni leur assigner une tâche dans leur propre application. Dis-le si on te le demande.",
      "Avancement ou retards de l'équipe : réponds à partir des projets fournis (jalons, tâches en retard).",
    ],
    timeoutMs: 30000,
  },
  {
    id: "nutrition",
    name: "Nutrition",
    version: 1,
    domain: "Repas, eau, courses, plans de repas et préférences alimentaires.",
    triggers: /\b(repas|mange|manger|nutrition|recette|calorie|kcal|courses|epicerie|menu|diete|regime|meal|food|eau|verre|proteine|dejeuner|diner|souper|allergi)/,
    tools: ["log", "create_task", "navigate"],
    needs: ["nutrition"],
    instructions: [
      "« j'ai mangé… » → log meal avec une estimation de kcal (c'est une estimation, dis-le). « j'ai bu 2 verres » → log water. « ajoute lait et œufs aux courses » → log grocery avec items.",
      "Plan de repas de la semaine ou liste de courses de la semaine : navigate vers /tasks/sante/nutrition (« Ma semaine de repas », qui respecte ses restrictions et ajoute la liste aux courses).",
      "Respecte toujours les restrictions NUTRITION fournies (régime, allergies, aliments refusés) : ne propose jamais un aliment exclu, même en idée de repas. Ne donne pas de conseil médical.",
    ],
    timeoutMs: 30000,
  },
  {
    id: "fitness",
    name: "Sport",
    version: 1,
    domain: "Séances, programmes, suivi d'entraînement et récupération.",
    triggers: /\b(sport|muscu|seance|entrainement|entrainer|courir|course a pied|jogging|workout|gym|exercice|velo|natation|nager|yoga|cardio|recuperation)/,
    tools: ["plan_workouts", "create_event", "log", "move", "delete", "create_workspace", "navigate"],
    needs: ["agenda"],
    instructions: [
      ...AGENDA_RULES,
      "Séance avec une heure → create_event dans sante:sport (1 h par défaut). Séance faite → log workout (minutes).",
      "« planifie 3 séances cette semaine », « trouve-moi des créneaux pour m'entraîner » → plan_workouts (sessions = nombre, 3 par défaut ; minutes = durée, 60 par défaut ; when = matin | midi | soir | libre). Le serveur choisit les créneaux libres, espacés, hors jours de repos ; tu ne choisis pas les heures toi-même.",
      "Une seule séance à une heure précise → create_event dans sante:sport.",
      "« prépare mon espace d'entraînement » → create_workspace template entrainement. Programme détaillé : navigate vers /tasks/sante/sport (générateur de programme).",
      "Rien de dangereux : pas de charge maximale sans échauffement, pas de conseil médical.",
    ],
    timeoutMs: 30000,
  },
  {
    id: "growth",
    name: "Développement personnel",
    version: 1,
    domain: "Lecture, habitudes, apprentissage, journal et objectifs personnels.",
    triggers: /\b(lecture|livre|lire|habitude|journal|meditat|gratitude|apprendre|apprentissage|langue|reading|habit|learn|objectif perso)/,
    tools: ["create_task", "create_event", "add_section", "add_area", "log", "navigate"],
    needs: ["sectors", "agenda"],
    instructions: [
      "Suivre une habitude ou une lecture : add_section dans le secteur adapté (apprentissage, esprit) avec la bibliothèque si elle existe, sinon une section sur mesure. " + BLOCKS_HELP,
      "Plan de lecture : create_task par étape (chapitres) avec une date si l'utilisateur en donne une.",
    ],
    timeoutMs: 30000,
  },
  {
    id: "documents",
    name: "Documents et connaissances",
    version: 1,
    domain: "Questions sur les fichiers de l'utilisateur (syllabus, notes, rapports), avec leurs sources.",
    triggers: /\b(document|fichier|pdf|selon mes|dans mes notes|mes notes|d'apres|rapport|contrat|que dit|ou est-il ecrit|source|cite)/,
    tools: ["create_task", "navigate"],
    needs: ["documents"],
    instructions: [
      "Question sur les documents : réponds UNIQUEMENT à partir des extraits DOCUMENTS fournis et cite la source en clair (« d'après syllabus.pdf, page 2 »). Si les extraits ne contiennent pas la réponse, dis-le ; n'invente rien.",
      "Aucun extrait fourni : dis que tu ne trouves rien dans ses documents et propose la page Documents (navigate /documents).",
      "Transformer les actions d'un document en tâches : create_task pour chacune, telles qu'écrites dans l'extrait.",
    ],
    timeoutMs: 30000,
  },
];

/** At most this many agents work on one request. */
export const MAX_AGENTS = 3;

export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'");

/**
 * Pick the fewest agents a request needs: those whose triggers match, best first, at most
 * three. A request that matches nothing goes to the personal assistant. The previous turn
 * counts a little, so « décale-la à 11 h » after a workout stays with the fitness agent.
 */
export function route(text: string, previous = ""): AgentDef[] {
  const now = fold(text);
  const before = fold(previous);
  const scored = AGENTS.map((a) => {
    const hits = now.match(new RegExp(a.triggers.source, "g"))?.length ?? 0;
    const context = before.match(new RegExp(a.triggers.source, "g"))?.length ?? 0;
    return { a, score: hits * 2 + Math.min(context, 1) };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score);
  const picked = scored.slice(0, MAX_AGENTS).map((x) => x.a);
  return picked.length ? picked : [AGENTS[0]];
}

export const agentById = (id: string) => AGENTS.find((a) => a.id === id);

/** What a set of agents may do together: the union of their tools, plus navigation. */
export function allowedOps(agents: AgentDef[]): Set<Op> {
  return new Set<Op>(["navigate", ...agents.flatMap((a) => a.tools)]);
}

/** The data slices a set of agents needs (memory and profile are always present). */
export function neededContext(agents: AgentDef[]): Set<ContextNeed> {
  return new Set(agents.flatMap((a) => a.needs));
}
