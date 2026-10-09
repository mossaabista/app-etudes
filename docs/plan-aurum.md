# Plan Aurum — produit commercial + Jarvis

Branche `aurum-jarvis`, partie de `aurum-commercial` (non fusionnée), donc la PR contient aussi
le travail précédent. Un commit par étape, vérification complète (lint, types, tests, build)
avant chaque push. Aucun déploiement, aucune fusion, aucun script lancé sur Neon.

## Décisions de co-fondateur (et pourquoi)

| Sujet | Décision | Raison |
|---|---|---|
| Marque | **Aurum**, « Le temps est d'or. » ; l'assistant s'appelle **Jarvis**. Les deux noms sont dans `src/lib/brand.ts`. | Un renommage = une ligne. ⚠️ « Jarvis » est très associé à Marvel/Disney : à valider avant de payer de la pub. |
| Schéma de base | **Aucune nouvelle table obligatoire.** Fuseau, langue, onboarding, mémoire, usage et récurrences vivent dans `TrackerEntry`, qui existe déjà. | Zéro migration à risque sur Neon. La seule migration en attente reste `AgentAction`. |
| Bilingue | Dictionnaires FR/EN maison (`src/i18n/`), langue stockée dans le profil et reflétée dans un cookie pour les pages publiques. | Pas de nouvelle dépendance, et fonctionne en rendu serveur comme client. |
| Fuseau horaire | Stocké par utilisateur. Les fonctions de date le lisent par requête ; les crons le passent explicitement. | Corrige le fuseau unique sans réécrire chaque appel. |
| Modèles | SDK officiel `@anthropic-ai/sdk`. `claude-haiku-5-5` par défaut, `claude-sonnet-5-5` pour la planification et les demandes multi-agents. Configurables par `JARVIS_MODEL` / `JARVIS_PLANNER_MODEL`. | Haiku 5.5 coûte 0,10 $/0,50 $ par million de tokens. |
| Erreur 400 | Plus de `tool_choice` forcé : `auto` + `strict: true` + consigne dans le prompt. | Sonnet/Opus 5.5 refusent `tool` et `any`. |
| Jarvis | Boucle d'outils : Jarvis (orchestrateur) appelle `agent_<secteur>` ; chaque spécialiste a ses propres outils, limités à son secteur et exécutés par l'exécuteur existant (validations, propriété, annulation conservées). | Ajouter un agent = ajouter un fichier dans `src/server/agents/`. |
| Plafond | Usage mensuel par utilisateur : coût Claude et caractères ElevenLabs. Au-delà du plafond voix : voix du navigateur. Au-delà du plafond IA : commandes simples sans IA, avec un message clair. | Le coût reste borné par utilisateur. |
| Voix | Écoute par le navigateur ; ElevenLabs Scribe (`scribe_v2`) en repli. Parole par ElevenLabs `eleven_flash_v2_5` en streaming, avec la voix du navigateur en secours. | Rapide et multilingue. |

## Étapes

0. Plan (ce fichier).
1. Nettoyage commercial : jargon, debug, erreurs humaines, états vides, squelettes, marque Aurum.
2. Fuseau par utilisateur + correction de l'erreur 400 (SDK, `auto` + `strict`).
3. Onboarding en 7 écrans, enregistré une seule fois.
4. Settings réorganisé (Profil, Jarvis, Secteurs, Notifications, Connexions, Abonnement, Données, Aide).
5. Jarvis : orchestrateur, registre, mémoire, usage et plafond, sans perdre les fonctions de « agir ».
6. Voix : routes ElevenLabs, micro global, présentation vocale.
7. Études (note nécessaire à l'examen final, quiz) et Tâches/Projets (récurrences).
8. Coach sportif, Nutrition, Sommeil, avec les signaux qu'ils s'échangent.
9. Briefing, cron selon le fuseau, notifications.
10. Esprit (prières via Aladhan), Social, Quotidien & Finances, Équipe, Carrière, Focus.
11. Finitions : pages légales, PWA, Open Graph, contrôle à 390 px et 1280 px.
12. Scénarios de test par agent, avec le modèle simulé.

## Ce qui ne peut pas être vérifié ici

Ce conteneur n'a ni clé Anthropic, ni clé ElevenLabs, ni accès à Neon. Les appels payants sont
donc testés avec des réponses simulées. Un script `scripts/smoke-live.mjs` permettra de lancer,
en local, les quelques vrais essais prévus (éléments « zztest… » supprimés ensuite).
