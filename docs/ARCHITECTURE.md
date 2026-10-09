# Architecture d'OROM

Next.js 16 (App Router, Server Actions, `proxy.ts`), Prisma 7 + Neon, déployé sur Vercel.

## Vue d'ensemble

```
Navigateur ── pages (App Router, rendu serveur) ── Server Actions (requireUser partout)
   │  voix : Web Speech (adaptateurs SpeechInput / SpeechOutput, src/lib/voice.ts)
   ▼
OROM Core (src/server/core/agents.ts)
   route(phrase) → ≤ 3 agents → une tranche de contexte → 1 appel modèle (outil « agir »)
   ▼
Exécuteur (src/server/assistant-run.ts : executePlan)
   valide chaque action : outil autorisé pour ces agents, ids appartenant à l'utilisateur,
   risque (src/lib/risk.ts) → confirmation signée si besoin (src/server/pending.ts)
   écrit, relit, produit un compte rendu honnête (receipt) et l'objet d'annulation
   ▼
Prisma → Postgres
```

## Agents (données, pas des processus)

personal, productivity, academic, professional, projects, team, nutrition, fitness, growth,
documents, workflows. Chacun déclare : déclencheurs, outils (opérations serveur), tranche de
contexte (`agenda`, `academic`, `sectors`, `projects`, `radar`, `documents`, `nutrition`),
consignes, délai. Pas de délégation entre agents, donc ni boucle ni coût non borné.
Sans clé IA, `src/lib/capture.ts` (règles) traite les commandes courantes.

## Stockage

Tables métier (Course, Assessment, Task, CalendarEvent, Project…) et une table générique
`TrackerEntry` (`module`, `kind`, `text`, `value`, `data` JSON) qui porte les sections de vie
et les fonctions récentes sans migration :

| module | contenu |
|---|---|
| `app:profile`, `app:layout`, `app:assistant`, `app:planning` | réglages |
| `app:memory`, `app:conversation` | mémoire explicite, conversation |
| `app:documents` | documents (texte paginé par `\f`) |
| `app:workflows`, `app:workflow-runs` | automatisations, journal d'exécution |
| `sante:nutrition` (kind `plan`) | profil nutritionnel + restrictions (`prefs`) |

`AgentAction` (script `scripts/migrate-agent-log.mjs`) : journal, idempotence (`opId`), annulation serveur.

## Briques

| Domaine | Fichiers |
|---|---|
| Assistant, voix | `src/server/assistant.ts`, `src/components/assistant/useOrom.ts`, `src/lib/voice.ts` |
| Documents | `src/lib/retrieval.ts` (TF-IDF lexical, passages ~800 car.), `src/server/documents.ts` |
| Planification | `src/server/pilot.ts` (jour, semaine), `src/server/fitness.ts` (séances), `src/server/radar.ts` |
| Nutrition | `src/lib/nutrition.ts` (besoins, recettes, restrictions, semaine, courses) |
| Automatisations | `src/lib/workflows.ts` (catalogue, validation), `src/server/workflows.ts` (exécution, journal, cron) |
| Intégrations | `src/server/integrations.ts` (état réel), `/api/health` |
| Modèle de langage | `src/server/llm.ts` (un seul point d'appel pour les fonctions hors assistant) |

## Garanties transverses

- **Autorisation** : chaque action serveur appelle `requireUser()` et filtre par `userId`.
- **Idempotence** : `opId` (assistant), clé d'exécution (automatisations : jour ou requête).
- **Annulation** : chaque écriture renvoie un objet `Undo` ; l'interface propose « Annuler ».
- **Honnêteté** : le message affiché vient de ce qui a réellement été écrit, pas de la réponse
  du modèle ; un échec partiel est dit comme tel.
- **Débit** : `src/server/rate-limit.ts` (en mémoire, par instance).

## Tests

`npm test` (Vitest) avec une fausse base en mémoire (`tests/fake-db.ts`). Vérification
complète utilisée avant chaque push : eslint, `tsc --noEmit`, vitest, `next build`.
