# Audit AURUM — état initial et lot 1

_Branche `aurum-commercial`, octobre 2026. Ce document suit la mission décrite dans `docs/AURUM_prompt.md`._

## 1. Architecture constatée

| Couche | Réalité dans le dépôt |
|---|---|
| Framework | Next.js 16.3 (App Router, Server Actions, `src/proxy.ts` à la place du middleware), React 19.2, Tailwind 4 |
| Données | Prisma 7 + Neon (Postgres). **Pas de dossier `prisma/migrations`** : le schéma est appliqué par `db push` et des scripts `scripts/migrate-*.mjs` |
| Auth | Maison : cookie `etudes_session` signé HMAC (`src/server/auth/session.ts`), `requireUser()` dans chaque action |
| Profils, secteurs, préférences | Stockés en JSON dans `TrackerEntry` (`module = "app:profile"` / `"app:layout"`), registre de sections dans `src/lib/layout.ts` et `src/components/modules/registry.ts` |
| Assistant | Claude (Haiku par défaut, `ASSISTANT_MODEL`) via un outil unique `agir` (`src/server/assistant.ts`) ; exécution côté serveur dans `src/server/assistant-run.ts` ; repli sans clé API sur un parseur à règles (`src/lib/command.ts`, `src/lib/capture.ts`) |
| Voix | Web Speech API dans `src/components/capture/QuickCapture.tsx` ; **la voix et le texte passent par la même `commandAction`** |
| Annulation | Chaque commande renvoie un objet `Undo` rejoué par `undoCommandAction`, filtré par utilisateur |
| Syllabus | PDF texte uniquement (`unpdf`), extraction Claude ou règles, page de revue avant import, dédoublonnage titre + date |
| Jobs | Crons Vercel : synchro Brightspace (`/api/cron/sync`) et digest push (`/api/cron/notify`) |
| Fuseau | `America/Toronto` codé en dur (`src/lib/dates.ts`), pas de fuseau par utilisateur |

## 2. Point de référence

| Vérification | Avant le lot 1 | Après le lot 1 |
|---|---|---|
| `npx eslint` | 0 erreur, 6 avertissements | inchangé |
| `npx tsc --noEmit` | 1 erreur : `LayoutProps` (type global généré par `next build`, pas un défaut) | inchangé |
| `next build` | OK | OK |
| Tests automatisés | **aucun** | 28 tests (`npm test`) |

Aucune base de données n'est accessible dans cet environnement : les flux ci-dessous sont évalués **à la lecture du code**, pas par exécution contre Neon.

## 3. Matrice d'état (lecture du code)

| Flux | État | Remarque |
|---|---|---|
| Tâches : créer / modifier / cocher / supprimer | Fonctionnel | Défaut d'isolation corrigé au lot 1 |
| Sous-tâches | Fonctionnel | `parentId`, vérifié depuis le lot 1 |
| Secteurs et sections (« dossiers de vie ») | Fonctionnel | Ajout, renommage, masquage ; pas de modèle `Folder` générique |
| Événements : créer / supprimer | Fonctionnel | Formulaire + assistant |
| Événements : modifier | Partiel | Seulement via l'assistant ou une commande, pas d'édition dans l'UI repérée |
| Calendrier | Fonctionnel | Cours hebdomadaires, événements, échéances |
| Cours, créneaux, évaluations | Fonctionnel | Défaut de suppression inter-comptes corrigé au lot 1 |
| Import de syllabus | Partiel | PDF texte uniquement, pas d'OCR/DOCX/image, pas de source ni de confiance par élément |
| Profils (Étudiant, Pro, Entrepreneur, Sportif) | Partiel | 4 profils, un seul actif, la navigation ne varie que par « Cours » |
| Réglages | Fonctionnel | Profil, cartes Aujourd'hui, notifications push |
| Assistant texte / voix | Partiel → amélioré | Exécutait sans confirmation, et affichait la réponse du modèle même si l'action avait échoué (corrigé au lot 1) |
| Confirmation selon le risque | Implémenté (phase 2) | Voir § 7 |
| Historique des actions (« qu'as-tu changé ? ») | Implémenté, inactif tant que la migration n'est pas lancée | Voir § 7 |
| Idempotence des actions de l'agent | Implémenté, inactif tant que la migration n'est pas lancée | Voir § 7 |
| Mémoire contrôlable | Non implémenté | Historique de 6 tours côté client seulement |
| Fuseau par utilisateur | Non implémenté | |

## 4. Défauts prouvés et corrigés au lot 1

1. **Suppression inter-comptes** : `deleteScheduleAction(scheduleId, courseId)` vérifiait que le cours appartenait à l'appelant, puis supprimait n'importe quel créneau par son id. Un compte pouvait supprimer le créneau d'un autre compte.
2. **Liens non vérifiés** : `courseId`, `projectId`, `assessmentId` et `parentId` envoyés par le client étaient écrits tels quels dans `createTaskAction`, `updateTaskAction`, `quickTaskAction`, `createAssessmentAction`, `updateAssessmentAction`, `createProjectAction` et `updateProjectAction`. Une évaluation pouvait ainsi être rattachée au cours d'un autre compte, qui l'affichait ensuite, et l'attaquant voyait le code et le nom de ce cours.
3. **Fausses réussites de l'agent** : une action invalide ou en erreur était ignorée en silence (`break` / `catch {}`), mais l'utilisateur voyait et entendait la réponse que le modèle avait écrite *avant* l'exécution (« J'ai ajouté ta séance »).
4. **Annulation trompeuse** : « Annulé. » s'affichait même quand rien n'avait pu être annulé (ligne déjà supprimée, dossier de cours déjà rempli).

## 5. Ce que le lot 1 change

- `src/server/ownership.ts` : `checkRefs(userId, refs)` vérifie que chaque lien fourni appartient à l'utilisateur ; appliqué à toutes les actions listées ci-dessus. `deleteScheduleAction` filtre maintenant sur `{ id, courseId }`.
- `src/server/assistant-run.ts` : chaque action ne compte comme faite que si l'écriture a abouti. Les modifications de secteurs ne comptent qu'une fois la disposition enregistrée. `receipt()` construit le message : la réponse du modèle n'est gardée que si **toutes** les actions ont réussi ; sinon le message liste ce qui a été fait puis « Je n'ai pas pu … ». Une réponse sans action qui prétend avoir modifié quelque chose est signalée. Les opérations inconnues sont rejetées.
- `undoCommandAction` renvoie `missed`, le nombre d'étapes qui n'ont pas pu être annulées ; l'interface affiche « Annulé en partie » le cas échéant.
- `QuickCapture` : un échec partiel s'affiche comme un avertissement, avec l'annulation toujours disponible pour ce qui a réussi.
- Prompt système : le modèle ne doit jamais affirmer une action sans l'appel d'outil correspondant.
- Tests (`vitest`, base simulée en mémoire, `tests/fake-db.ts`) : isolation des liens, suppression de créneau, compte rendu de l'agent, scénario « ajoute une séance samedi à 10 h » puis « décale-la à 11 h » (une seule séance, déplacée), dates d'Ottawa autour du changement d'heure, analyse de « samedi », « demain ». Ces tests échouent sur le code d'avant le lot 1 et passent après.

Aucune migration ni modification de données ; aucun changement visuel hors du toast.

## 6. Risques et prochains lots recommandés

1. **Confirmation selon le risque** (phase 2) : classer les opérations de l'outil `agir` (faible / moyen / élevé), renvoyer un aperçu au lieu d'exécuter les suppressions en lot et les plans de plusieurs événements, avec un réglage « prudent / équilibré / autonome ».
2. **Journal d'actions persisté** (phase 2) : un modèle `AgentAction` (migration additive) pour « qu'as-tu changé ? », pour annuler depuis le serveur plutôt qu'avec un `Undo` fourni par le client, et pour l'idempotence via un identifiant d'opération.
3. **Import de syllabus** (phase 4) : source et niveau de confiance par élément, dates ambiguës signalées, DOCX et images.
4. **Fuseau par utilisateur** : `APP_TIMEZONE` est utilisé partout ; le rendre paramétrable demande un passage soigneux sur `src/lib/dates.ts` et ses appelants.
5. **Migrations Prisma** : le dépôt n'a pas d'historique de migrations. Avant toute évolution du schéma, il faut établir une migration de référence (`prisma migrate diff`) **avec l'accord du propriétaire et une sauvegarde de la base Neon**.

## 7. Phase 2 — confirmation selon le risque et journal de l'agent

### Confirmation selon le risque (sans changement de schéma)

Règle produit (révisée) : **ce que l'utilisateur demande explicitement s'exécute tout de suite**, y compris les suppressions et modifications, avec le bouton Annuler. L'assistant ne s'arrête pour demander que dans trois cas :

- **suppression massive** : plus de 10 éléments d'un coup — toujours confirmée, quel que soit le mode ;
- **grosse modification** : plus de 10 changements dans une même demande, ou un plan de révision sur *toutes* les évaluations à venir ;
- **action irréversible** : ensemble `IRREVERSIBLE` dans `src/lib/risk.ts`, vide aujourd'hui car chaque opération de l'assistant a son annulation. Une future opération sans retour possible (envoi, partage externe) devra y être ajoutée.

Les trois modes, choisis dans **Réglages → Assistant** :

- **Direct** (par défaut) : applique la règle ci-dessus.
- **Prudent** : demande avant toute modification.
- **Autonome** : comme Direct, mais exécute aussi sans demander les gros lots ou plans cochés. Ces autorisations sont révocables.

Fonctionnement de la confirmation :

- Quand une confirmation est nécessaire, **rien n'est modifié**. L'assistant affiche la liste des changements, la raison de la demande, et les boutons « Confirmer » ou « Ne rien faire ».
- La proposition voyage dans un jeton signé (HMAC, lié à l'utilisateur, valable 10 min, `src/server/pending.ts`).
- À la confirmation, elle est ré-exécutée sur des données fraîches, avec toutes les vérifications.
- Le parseur à règles (sans clé API) applique les mêmes seuils.

### Journal de l'agent (`AgentAction`)

- Modèle Prisma `AgentAction` et script additif `scripts/migrate-agent-log.mjs`. **Le script n'a pas été exécuté.**
- Une ligne par requête qui a réellement modifié quelque chose. Elle contient le message affiché et l'annulation, stockée côté serveur. **La phrase brute n'est jamais stockée** : elle peut contenir des données de santé.
- On garde les 200 dernières lignes par utilisateur ; la suppression du compte efface le journal (cascade).
- Ce que le journal permet :
  - **Idempotence** : chaque envoi porte un identifiant d'opération. La même soumission, ou la même confirmation validée deux fois, ne s'exécute qu'une fois et répond « Déjà fait ».
  - « **Qu'est-ce que tu as changé ?** » liste les dernières modifications.
  - « **Annule ta dernière action** » annule la dernière modification de moins de 24 h, avec l'annulation stockée côté serveur et jamais avec celle envoyée par le navigateur.
  - **Réglages → Ce que l'assistant a changé** : historique avec un bouton Annuler par entrée récente.
- **Avant la migration**, tout appel au journal répond « indisponible » : les commandes fonctionnent comme avant, et l'historique indique honnêtement qu'il n'est pas activé.

### Activer le journal (à lancer en local, après une sauvegarde Neon)

```bash
npm install                                   # régénère le client Prisma (postinstall)
node scripts/migrate-agent-log.mjs --dry-run  # affiche le SQL, ne touche à rien
node scripts/migrate-agent-log.mjs            # crée la table (CREATE ... IF NOT EXISTS)
```

Pour revenir en arrière : `DROP TABLE "AgentAction";` (seul le journal est perdu).

### Tests

57 tests (`npm test`) :
- risque et modes ;
- jeton de confirmation : refus d'un autre utilisateur, d'un jeton falsifié ou expiré ;
- confirmation de bout en bout, par l'assistant et par le parseur à règles ;
- idempotence ;
- historique et annulation : isolation entre comptes, élagage ;
- fonctionnement sans la table.

### Non vérifié faute d'environnement

- Exécution contre une vraie base Neon.
- Rendu du panneau de confirmation et de l'historique dans un navigateur.
- Réponse réelle de Claude : le modèle est simulé dans les tests.

## 8. Phases 3 à 7 — état au matin

Chaque étape a été commitée et poussée séparément, avec lint, types, tests et build verts avant chaque push. Les flux ont aussi été joués dans un vrai navigateur (Chromium piloté par Playwright), contre une base Postgres **locale et jetable**, jamais la base Neon (voir `docs/DEV_LOCAL.md`).

### Implémenté et testé (tests automatisés + navigateur)

| Phase | Ce qui marche |
|---|---|
| 2 (révisée) | Ce que l'utilisateur demande explicitement s'exécute tout de suite, suppressions comprises, avec Annuler. Confirmation seulement au-delà de 10 suppressions, de 10 changements, pour un plan de toute la semaine ou de toutes les évaluations, ou pour une opération irréversible. |
| 3 — Espaces | « Crée un espace pour mon semestre / mon projet X / mon activité de freelance / mon entraînement ». Modèles versionnés (`src/lib/workspaces.ts`, v1) qui réutilisent les vrais cours, projets et sections, sans rien inventer. Écriture en une transaction, relecture avant le compte rendu, annulation complète. Aussi depuis Secteurs → « Créer un espace », avec aperçu. |
| 4 — Syllabus | PDF, Word (.docx), PDF scannés et photos (ces deux derniers via l'IA si la clé existe, sinon message clair). Pour chaque évaluation : page et ligne sources, confiance en toutes lettres, année déduite, date passée, pondération inconnue, doublon avec l'existant. Phrases malveillantes signalées et ignorées. Source enregistrée dans les notes. Ré-import sans doublon. |
| 5 — Profils | 6 profils (+ Freelance, Personnel), plusieurs rôles avec un rôle actif. Navigation déclarative (`src/lib/nav.ts`) : les modules s'affichent selon les rôles **et** les données existantes, donc changer de rôle ne cache jamais les cours ou projets. Choix afficher / masquer persistés, avec la raison affichée dans Réglages. |
| 6 — Planification | Plan de semaine (Pilote → Semaine, ou « planifie ma semaine »). Ce qui n'a pas trouvé de place est nommé, avec la raison. Préférences réglables : début et fin de journée, concentration maximale, pauses, marge, jours de repos. Radar de risque sur Aujourd'hui et dans l'assistant. |
| 7 — Accessibilité | Texte posé sur l'or : environ 2,5:1 → 4,7 à 7,5:1. Listes lisibles sur téléphone (390 px, aucun débordement). Focus clavier piégé dans les fenêtres et rendu à la fermeture ; anneau de focus sur les pastilles du carrousel. Toutes les erreurs du micro ont un message. |
| Mémoire | « Retiens que… », « qu'est-ce que tu sais sur moi ? », « oublie… », et Réglages → Mémoire. Rien n'est mémorisé sans demande explicite ; les éléments retenus sont transmis au modèle comme des préférences, pas comme des ordres. |

Tests : **111** (`npm test`), dont les tests A, B, C, D, E, F, G, H et I du prompt.

### Implémenté mais non testé faute d'environnement

- **Appels réels à Claude** : assistant, extraction de syllabus, lecture de photos et de PDF scannés. Pas de clé API ici ; les tests simulent la réponse du modèle.
- **Risque si `ASSISTANT_MODEL` change** : le code force l'appel d'outil (`tool_choice` de type `tool`). Haiku 4.5, utilisé par défaut, l'accepte ; les modèles Opus 5.5 / Sonnet 5.5 le refusent (erreur 400). Il faudrait adapter ces appels avant de changer de modèle.
- **La migration `AgentAction` contre Neon** : son SQL a été validé sur Postgres 16 local (deux exécutions sans erreur, et après exécution la base correspond exactement au schéma Prisma).

### Partiellement implémenté

- **Fuseau horaire** : toujours `America/Toronto` pour tout le monde (`src/lib/dates.ts`). Le rendre propre à chaque utilisateur touche toutes les dates de l'app.
- **Anglais** : compris par l'assistant IA ; le parseur à règles (sans clé) reste francophone.
- **Verrouillage d'un créneau** : le Pilote ne déplace jamais rien, mais l'assistant peut déplacer un événement qu'on lui nomme ; il n'existe pas de verrou « intouchable ».

### Pas encore implémenté

- Calendrier externe, e-mail, nouvelles notifications (phase 8). Les intégrations existantes, Brightspace et le digest push, sont inchangées.
- Collaboration réelle (membres avec accès, partage).
- Transformer un espace existant en modèle réutilisable.

## 9. OROM — reconstruction (état au 9 octobre 2026)

Le produit s'appelle désormais **OROM** (« Dis-le. OROM s'en occupe. »). Le dépôt OpenJarvis
fourni ne contenait que ses fichiers de premier niveau (README, pyproject, licence Apache-2.0),
sans code source : ses idées (registre d'agents typés, compétences exposées comme outils, modes
d'exécution) ont été reprises en TypeScript, sans import ni marque OpenJarvis.

### Implémenté et vérifié (tests automatisés + navigateur sur base locale jetable)

| Domaine | Ce qui marche |
|---|---|
| OROM Core | 11 agents déclaratifs (personnel, productivité, études, travail, projets, équipe, nutrition, sport, développement personnel, documents, automatisations). Routage déterministe vers 3 agents au plus, un seul appel modèle, outils = union de ceux des agents choisis ; toute autre opération est refusée par le serveur. Contexte découpé selon les besoins des agents. |
| Assistant et voix | Page Assistant : conversation persistée (100 échanges), états vocaux visibles (écoute, transcription, réflexion, exécution, réponse, interrompu, annulé, erreur), mode conversation sur demande, réglages de voix. Même commande serveur pour la voix et le texte. |
| Documents | PDF / Word / texte, recherche lexicale par passages, réponses citant document et page (références inventées retirées), résumé et actions → tâches. Sans clé IA : les passages eux-mêmes, étiquetés comme tels. |
| Nutrition | Régime, allergies, aliments refusés ; aucun menu ne contient un aliment exclu (un repas reste vide plutôt). Menu de 7 jours et liste de courses agrégée, ajoutée en une fois, sans doublon, annulable. |
| Sport | Réservation des séances de la semaine dans le temps libre (cours, rendez-vous, repas, marge), jamais un jour de repos ni un jour déjà entraîné, espacées. Bouton et commande vocale, annulables. |
| Automatisations | Catalogue d'étapes sûres, validation serveur, déclenchement à la demande ou chaque matin **seulement avec autorisation explicite**, clé d'exécution (pas de double exécution), journal par étape, arrêt au premier échec, annulation d'une exécution, désactivation, suppression avec historique. |
| Calendrier | Modifier / supprimer un événement depuis la vue du jour, avec Annuler (tous les champs restaurés). |
| Toutes mes tâches | `/liste` : recherche, filtres (état, échéance, secteur), tri, cocher / supprimer en lot avec Annuler ; confirmation au-delà de 10 suppressions. |
| Compte | Suppression du compte (mot de passe + « SUPPRIMER », cascade complète, vérifiée sur base réelle). `/api/health`. Réglages › Intégrations : états réels, rien de simulé. |
| Priorité | « haute priorité », « urgent », « pas urgent »… respectés (règles et assistant). Corrigé au passage : « une » lu « un » + « e » dans les titres. |

### Tests 1 à 12 du cahier des charges

| Test | Preuve | Limite |
|---|---|---|
| 1 Résumé du jour | `tests/briefing.test.ts` : bons éléments, bon jour local, rien d'un autre utilisateur, rien d'inventé | — |
| 2 Tâche prioritaire | `tests/priority.test.ts` (commande complète) + navigateur (`/liste` affiche « priorité haute », date de demain) | — |
| 3 Déplacer une réunion | `tests/assistant-run.test.ts` : l'événement existant est déplacé, pas dupliqué | Modèle simulé (pas de clé ici) |
| 4 Syllabus | `tests/syllabus.test.ts` + navigateur (lots précédents) | Extraction IA non jouée en réel |
| 5 Semaine | `tests/pilot.test.ts`, `assistant-run` (confirmation puis écriture, non-placés nommés) | — |
| 6 Profils / modules | `tests/profiles-nav.test.ts` + navigateur | — |
| 7 Multi-agents | `tests/core-agents.test.ts` : choix, contexte limité, outils refusés, idempotence | Modèle simulé |
| 8 Isolation | `actions-isolation`, `ownership`, `assistant-run`, `documents`, `workflows`, `groceries`, `events`, `task-list`, `account` | — |
| 9 Voix | `tests/voice.test.ts` (erreurs, réglages, résumé parlé) ; page Assistant au navigateur | Dictée réelle non testée : pas de micro dans le navigateur sans écran |
| 10 Automatisations | `tests/workflows.test.ts` (11 cas) + navigateur (créer, autorisation exigée, lancer, journal, annuler, désactiver, supprimer) | Déclenchement par le cron Vercel réel non joué |
| 11 Responsive | 13 écrans × 1280 px et 390 px : HTTP 200, aucun débordement, aucune erreur console | — |
| 12 Échecs | Écriture qui échoue, étape qui plante, fournisseur absent (IA, push), transaction annulée : messages honnêtes, données intactes (`assistant-run`, `workflows`, `workspaces`, `documents`, `account`) | — |

Total : **184 tests** (`npm test`), lint, types et build verts avant chaque push.

### Toujours non vérifié faute d'environnement

- Appels réels à Claude, notifications push réelles, cron Vercel réel, base Neon (rien n'y a été exécuté).
- Changer `ASSISTANT_MODEL` vers Opus 5.5 / Sonnet 5.5 : `tool_choice` forcé refusé (400) — à adapter avant.

### Partiel ou manquant

- Fuseau horaire unique (`America/Toronto`).
- Équipe : membres saisis à la main, pas de vrais comptes partagés (demande un schéma).
- Tâches et événements récurrents.
- Limitation de débit en mémoire (par instance).
- Google Agenda / Outlook / courriel : non disponibles, affichés comme tels.
- Parseur à règles : quelques mots-clés de section devinent mal (« réserver la salle » → Sport).
