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
