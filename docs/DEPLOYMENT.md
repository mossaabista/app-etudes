# Déployer OROM

> Rien n'a été déployé par l'agent. Ce document décrit comment le faire, toi, quand tu le décides.

## 1. Pré-requis

- Un projet Vercel relié au dépôt, et une base Postgres (Neon) — celle déjà utilisée.
- Node 20+ en local pour lancer les migrations.

## 2. Variables d'environnement

Voir `.env.example`. Obligatoires : `DATABASE_URL`, `SESSION_SECRET`.
Facultatives, et ce qui se passe sans elles :

| Variable | Sans elle |
|---|---|
| `ANTHROPIC_API_KEY` | Les commandes simples (règles) marchent ; les résumés de documents, réponses rédigées, extraction IA de syllabus et l'assistant multi-agents non. L'app le dit à l'écran (Réglages › Intégrations). |
| `ASSISTANT_MODEL` | Haiku 4.5 par défaut. **Attention** : le code force l'appel d'outil (`tool_choice: {type: "tool"}`), refusé (400) par Opus 5.5 / Sonnet 5.5. Ne pas changer de modèle sans adapter `src/server/assistant.ts`, `src/server/llm.ts`, `src/server/syllabus-ai.ts`. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Pas de notifications ; l'étape « résumé du jour » des automatisations est notée « non faite », jamais « réussie ». |
| `CRON_SECRET` | Les routes `/api/cron/*` répondent 500 : ni synchro, ni résumé, ni automatisations du matin. |

## 3. Migrations (additives, à lancer une fois, après une sauvegarde Neon)

Le projet n'a pas de dossier de migrations Prisma : chaque table ajoutée a son script
idempotent (`CREATE TABLE IF NOT EXISTS`), qui ne touche à aucune donnée existante.

```bash
DATABASE_URL=… node scripts/migrate-agent-log.mjs   # journal de l'assistant (AgentAction)
```

Sans ce script, l'app fonctionne : l'historique des actions de l'assistant et « annule ta
dernière action » côté serveur affichent « indisponible ». Toutes les autres nouveautés
(documents, automatisations, restrictions alimentaires, préférences) vivent dans la table
existante `TrackerEntry` et ne demandent aucune migration.

## 4. Tâches planifiées

`vercel.json` déclare deux crons quotidiens, inchangés :

- `/api/cron/sync` à 06:00 UTC — synchro Brightspace.
- `/api/cron/notify` à 11:00 UTC (≈ 7 h à Toronto) — **lance d'abord les automatisations
  autorisées du jour**, puis envoie le résumé push. Aucune nouvelle entrée cron : le plan
  Hobby n'autorise qu'une exécution par jour par cron.

## 5. Vérifications après déploiement

1. `GET /api/health` → `{"status":"ok","database":"ok",…}` (503 si la base ne répond pas).
   Indique seulement *si* l'IA, le push et le cron sont configurés, jamais une valeur.
2. Se connecter, ouvrir Réglages › Intégrations : chaque service doit avoir l'état attendu.
3. Lancer une automatisation à la main (Automatisations › Lancer) et lire son journal.

## 6. Limites connues pour la production

- **Limitation de débit en mémoire** (`src/server/rate-limit.ts`) : par instance serverless,
  donc indicative. Pour une vraie limite, la brancher sur un stockage partagé (Upstash/Redis).
- **Fuseau horaire unique** `America/Toronto` pour tous les utilisateurs.
- **Documents** stockés en texte dans Postgres (4 Mo par fichier, 100 par compte, 300 000
  caractères de texte) : les fichiers d'origine ne sont pas conservés.
